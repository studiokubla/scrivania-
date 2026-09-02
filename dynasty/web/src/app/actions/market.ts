"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession, type Session } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  consumeOption,
  getLeagueContext,
  getStandingPositions,
  getTeamContracts,
  scheduleToJson,
} from "@/lib/league";
import { formatMoney, fromDecimal, fromMillions, isOnStep, toDecimalString, type Money } from "@/lib/money";
import { appSecret } from "@/lib/secret";
import { resolveSealedBids } from "@/lib/rules/auction";
import { canAfford } from "@/lib/rules/cap";
import { ageAtSeason, buildSalarySchedule, validateContractSignature } from "@/lib/rules/contracts";
import type { ActionResult } from "./contracts";

function refuse(message: string, errors?: { article: string; message: string }[]): ActionResult {
  return { ok: false, message, errors };
}

async function fingerprint(parts: (string | number)[]): Promise<string> {
  return createHash("sha256")
    .update([...parts, await appSecret()].join("|"))
    .digest("hex");
}

// ───────────────────────────────────────────────────── Free agency (art. 9)

const OfferSchema = z.object({
  playerId: z.string().min(1),
  /** In milioni, come lo scrive il manager */
  salary: z.coerce.number().positive(),
  years: z.coerce.number().int().min(1).max(4),
  contractType: z.enum(["ANNUALE", "STANDARD", "ROOKIE", "VETERAN", "TAMPONE"]),
  /** Offerta di rilancio su una contesa già aperta */
  parentOfferId: z.string().optional(),
});

export async function submitFreeAgencyOffer(input: z.input<typeof OfferSchema>): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "MANAGER" || !session.teamId) {
    return refuse("Solo un manager con una squadra può presentare offerte.");
  }

  const parsed = OfferSchema.safeParse(input);
  if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? "Dati non validi.");

  const { ruleset, season, currentYear } = await getLeagueContext();
  const salary = fromMillions(parsed.data.salary);

  if (!isOnStep(salary)) {
    return refuse("Le offerte sono multipli di 0,25 M.", [
      { article: "art. 4.3", message: "Gli importi si esprimono in multipli di 0,25 M." },
    ]);
  }

  const window = await db.marketWindow.findFirst({ where: { seasonId: season.id, status: "OPEN" } });
  if (!window) {
    return refuse("Nessuna finestra di mercato aperta.", [
      { article: "art. 7", message: "Le offerte si presentano solo a finestra aperta." },
    ]);
  }

  const player = await db.player.findUnique({
    where: { id: parsed.data.playerId },
    include: { contracts: { where: { status: "ACTIVE" } } },
  });
  if (!player) return refuse("Giocatore inesistente.");
  if (player.contracts.length > 0) {
    return refuse(`${player.name} è già sotto contratto. Per averlo serve uno scambio o un pre-contract.`);
  }

  // Il waiver ha la precedenza sulla free agency (art. 10.1)
  const inWaiver = await db.waiverClaim.findFirst({
    where: { playerId: player.id, seasonId: season.id, status: "PENDING", closesAt: { gt: new Date() } },
  });
  if (inWaiver) {
    return refuse(`${player.name} è in waiver: si può solo reclamare, non offrire.`, [
      { article: "art. 10.1", message: "Un giocatore appena svincolato resta 48 ore in waiver." },
    ]);
  }

  const contractCheck = validateContractSignature({
    type: parsed.data.contractType,
    salary,
    years: parsed.data.years,
    seasonStartYear: currentYear,
    playerBirthDate: player.birthDate,
    ruleset,
  });
  if (!contractCheck.ok) {
    return refuse(
      "Il contratto offerto non rispetta il regolamento.",
      contractCheck.errors.map((e) => ({ article: e.article, message: e.message })),
    );
  }

  const contracts = await getTeamContracts(session.teamId);
  const afford = canAfford({ contracts, year: currentYear, amount: salary, ruleset, enforceReserve: false });
  if (!afford.ok) {
    return refuse("Non hai spazio salariale sufficiente.", [
      {
        article: "art. 3.2",
        message: `Spazio disponibile ${formatMoney(afford.space)}, offerta ${formatMoney(salary)}.`,
      },
    ]);
  }

  // Il contatore delle offerte conta le contese aperte dal manager, non i rilanci:
  // rilanciare su una contesa altrui non deve consumare una delle cinque (art. 9.1).
  if (!parsed.data.parentOfferId) {
    const usage = await db.optionUsage.findUnique({
      where: {
        teamId_seasonId_type: { teamId: session.teamId, seasonId: season.id, type: "FREE_AGENCY_OFFER" },
      },
    });
    if ((usage?.used ?? 0) >= ruleset.options.freeAgencyOffers.perSeason) {
      return refuse("Offerte esaurite.", [
        {
          article: "art. 9.1",
          message: `Hai già presentato ${ruleset.options.freeAgencyOffers.perSeason} offerte di free agency in questa stagione.`,
        },
      ]);
    }
  }

  const existing = await db.marketOffer.findFirst({
    where: { playerId: player.id, kind: "FREE_AGENCY", status: { in: ["SEALED", "REVEALED"] } },
    orderBy: { closesAt: "asc" },
  });

  if (existing) {
    const mine = await db.marketOffer.findFirst({
      where: { playerId: player.id, teamId: session.teamId, status: { in: ["SEALED", "REVEALED"] } },
    });
    if (mine) return refuse("Hai già un'offerta aperta su questo giocatore.");
  }

  // La contesa dura 24 ore dalla prima offerta; i rilanci non la prolungano,
  // altrimenti non si chiuderebbe mai.
  const closesAt = existing?.closesAt ?? new Date(Date.now() + ruleset.market.freeAgencyHours * 3600_000);
  const submittedAt = new Date();

  await db.$transaction(async (tx) => {
    const offer = await tx.marketOffer.create({
      data: {
        windowId: window.id,
        teamId: session.teamId as string,
        playerId: player.id,
        kind: "FREE_AGENCY",
        salary: toDecimalString(salary),
        years: parsed.data.years,
        contractType: parsed.data.contractType,
        status: "SEALED",
        closesAt,
        parentOfferId: existing?.id ?? null,
        fingerprint: await fingerprint([player.id, session.teamId as string, salary, submittedAt.toISOString()]),
        submittedAt,
      },
    });

    if (!parsed.data.parentOfferId && !existing) {
      await consumeOption(tx, {
        teamId: session.teamId as string,
        seasonId: season.id,
        type: "FREE_AGENCY_OFFER",
      });
    }

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: session.teamId,
      action: "OFFER_SUBMITTED",
      // L'importo NON entra nel sommario: il registro è pubblico e l'offerta è segreta
      // fino all'apertura. Ciò che è pubblico è che una contesa è aperta (art. 9.2).
      summary: existing
        ? `Nuova offerta sulla contesa per ${player.name}`
        : `Aperta una contesa per ${player.name}: le buste si aprono ${closesAt.toLocaleString("it-IT")}`,
      payload: { offerId: offer.id, playerId: player.id, closesAt },
    });
  });

  revalidatePath("/mercato");
  revalidatePath("/registro");

  return {
    ok: true,
    message: existing
      ? `Offerta inviata. Le buste si aprono ${closesAt.toLocaleString("it-IT")}.`
      : `Contesa aperta per ${player.name}. Gli altri manager hanno ${ruleset.market.freeAgencyHours} ore per rilanciare.`,
  };
}

/**
 * Apre le buste scadute e assegna i giocatori.
 *
 * Non c'è un processo in background: la risoluzione avviene quando qualcuno guarda
 * il mercato. Per una lega di dieci persone è sufficiente e non richiede
 * infrastruttura, ma la decisione dipende solo da `closesAt`, non da chi apre la
 * pagina né da quando: l'esito è lo stesso per tutti.
 */
export async function resolveDueOffers(): Promise<number> {
  const { ruleset, season, currentYear } = await getLeagueContext();
  const now = new Date();

  const due = await db.marketOffer.findMany({
    where: { status: { in: ["SEALED", "REVEALED"] }, closesAt: { lte: now }, kind: "FREE_AGENCY" },
    include: { player: { select: { id: true, name: true, birthDate: true } } },
  });
  if (due.length === 0) return 0;

  const byPlayer = new Map<string, typeof due>();
  for (const offer of due) {
    const list = byPlayer.get(offer.playerId) ?? [];
    list.push(offer);
    byPlayer.set(offer.playerId, list);
  }

  const standings = await getStandingPositions(season.id);
  let resolved = 0;

  for (const [playerId, offers] of byPlayer) {
    const outcome = resolveSealedBids({
      bids: offers.map((o) => ({
        teamId: o.teamId,
        amount: fromDecimal(o.salary),
        submittedAt: o.submittedAt,
      })),
      minimum: fromMillions(0.25),
      tieBreak: "WORST_STANDING",
      standings,
      years: Object.fromEntries(offers.map((o) => [o.teamId, o.years])),
    });

    const winning = outcome.winnerId ? offers.find((o) => o.teamId === outcome.winnerId) : null;
    const player = offers[0].player;

    await db.$transaction(async (tx) => {
      if (winning) {
        const salary = fromDecimal(winning.salary);
        const schedule = buildSalarySchedule({
          type: winning.contractType as "ANNUALE" | "STANDARD" | "ROOKIE" | "VETERAN" | "TAMPONE",
          baseSalary: salary,
          years: winning.years,
          startYear: currentYear,
          ruleset,
        });

        const contract = await tx.contract.create({
          data: {
            teamId: winning.teamId,
            playerId,
            seasonId: season.id,
            type: winning.contractType,
            baseSalary: toDecimalString(salary),
            years: winning.years,
            startYear: currentYear,
            endYear: currentYear + winning.years - 1,
            salarySchedule: scheduleToJson(schedule) as never,
          },
        });

        await tx.contractEvent.create({
          data: {
            contractId: contract.id,
            type: "SIGNED",
            effectiveYear: currentYear,
            amountAfter: toDecimalString(salary),
            note: "Free agency, offerta a busta chiusa",
          },
        });

        await tx.marketOffer.update({
          where: { id: winning.id },
          data: { status: "WON", revealedAt: now, resolvedAt: now },
        });

        const team = await tx.team.findUniqueOrThrow({ where: { id: winning.teamId }, select: { name: true } });

        await recordAudit(tx, {
          seasonId: season.id,
          teamId: winning.teamId,
          action: "OFFER_RESOLVED",
          summary:
            `${player.name} va a ${team.name} per ${formatMoney(salary)} × ${winning.years} ` +
            `${winning.years === 1 ? "anno" : "anni"} (${offers.length} ${offers.length === 1 ? "offerta" : "offerte"})`,
          payload: {
            playerId,
            winner: winning.teamId,
            amount: salary,
            // All'apertura tutte le offerte diventano pubbliche (art. 9.3)
            offers: offers.map((o) => ({ teamId: o.teamId, salary: fromDecimal(o.salary), years: o.years })),
          },
        });
      } else {
        await recordAudit(tx, {
          seasonId: season.id,
          action: "OFFER_RESOLVED",
          summary: `Nessuna offerta valida per ${player.name}: resta svincolato`,
          payload: { playerId },
        });
      }

      await tx.marketOffer.updateMany({
        where: {
          id: { in: offers.filter((o) => o.id !== winning?.id).map((o) => o.id) },
        },
        data: { status: "LOST", revealedAt: now, resolvedAt: now },
      });
    });

    resolved += 1;
  }

  return resolved;
}

// ───────────────────────────────────────────────────────── Waiver (art. 10)

export async function claimWaiver(playerId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "MANAGER" || !session.teamId) return refuse("Solo un manager può reclamare.");

  const { ruleset, season, currentYear } = await getLeagueContext();
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return refuse("Giocatore inesistente.");

  const open = await db.waiverClaim.findFirst({
    where: { playerId, seasonId: season.id, status: "PENDING", closesAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
  });

  const closesAt = open?.closesAt ?? new Date(Date.now() + ruleset.market.waiverHours * 3600_000);
  const standings = await getStandingPositions(season.id);
  const position = standings[session.teamId] ?? ruleset.governance.teams;

  const contracts = await getTeamContracts(session.teamId);
  const afford = canAfford({
    contracts,
    year: currentYear,
    amount: fromMillions(0.5),
    ruleset,
    enforceReserve: false,
  });
  if (!afford.ok) return refuse("Non hai spazio salariale per assumerne il contratto.");

  const already = await db.waiverClaim.findUnique({
    where: { seasonId_teamId_playerId: { seasonId: season.id, teamId: session.teamId, playerId } },
  });
  if (already) return refuse("Hai già reclamato questo giocatore.");

  await db.$transaction(async (tx) => {
    await tx.waiverClaim.create({
      data: {
        seasonId: season.id,
        teamId: session.teamId as string,
        playerId,
        closesAt,
        standingPosition: position,
      },
    });

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: session.teamId,
      action: "WAIVER_CLAIM",
      summary: `Reclamo waiver su ${player.name}`,
      payload: { playerId, closesAt, position },
    });
  });

  revalidatePath("/mercato");
  return { ok: true, message: `Reclamo registrato. Si decide ${closesAt.toLocaleString("it-IT")}.` };
}

/** Assegna i waiver scaduti alla squadra peggio classificata tra i reclamanti (art. 10.2). */
export async function resolveDueWaivers(): Promise<number> {
  const { season, currentYear, ruleset } = await getLeagueContext();
  const now = new Date();

  const due = await db.waiverClaim.findMany({
    where: { status: "PENDING", closesAt: { lte: now } },
    include: { player: { select: { name: true } } },
  });
  if (due.length === 0) return 0;

  const byPlayer = new Map<string, typeof due>();
  for (const claim of due) {
    const list = byPlayer.get(claim.playerId) ?? [];
    list.push(claim);
    byPlayer.set(claim.playerId, list);
  }

  for (const [playerId, claims] of byPlayer) {
    // Peggio classificata = numero di posizione più alto
    const winner = claims.reduce((acc, c) => (c.standingPosition > acc.standingPosition ? c : acc));
    const salary = fromMillions(0.5);

    await db.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          teamId: winner.teamId,
          playerId,
          seasonId: season.id,
          type: "ANNUALE",
          baseSalary: toDecimalString(salary),
          years: 1,
          startYear: currentYear,
          endYear: currentYear,
          salarySchedule: [{ year: currentYear, salary, source: "BASE" }] as never,
        },
      });

      await tx.contractEvent.create({
        data: {
          contractId: contract.id,
          type: "SIGNED",
          effectiveYear: currentYear,
          amountAfter: toDecimalString(salary),
          note: "Assegnato tramite waiver",
        },
      });

      await tx.waiverClaim.update({ where: { id: winner.id }, data: { status: "AWARDED", resolvedAt: now } });
      await tx.waiverClaim.updateMany({
        where: { id: { in: claims.filter((c) => c.id !== winner.id).map((c) => c.id) } },
        data: { status: "LOST", resolvedAt: now },
      });

      const team = await tx.team.findUniqueOrThrow({ where: { id: winner.teamId }, select: { name: true } });
      await recordAudit(tx, {
        seasonId: season.id,
        teamId: winner.teamId,
        action: "WAIVER_AWARDED",
        summary: `${winner.player.name} assegnato a ${team.name} dal waiver (${claims.length} ${claims.length === 1 ? "reclamo" : "reclami"}, priorità alla ${winner.standingPosition}ª in classifica)`,
        payload: { playerId, claims: claims.map((c) => ({ teamId: c.teamId, position: c.standingPosition })) },
      });
    });
  }

  void ruleset;
  return byPlayer.size;
}

// ───────────────────────────────────────────────────────── Trade (art. 11.1)

const TradeSchema = z.object({
  receiverId: z.string().min(1),
  /** Contratti che il proponente cede */
  contractsOut: z.array(z.string()).default([]),
  /** Contratti che il proponente chiede */
  contractsIn: z.array(z.string()).default([]),
  capitalOut: z.coerce.number().min(0).default(0),
  capitalIn: z.coerce.number().min(0).default(0),
  message: z.string().max(500).optional(),
});

export async function proposeTrade(input: z.input<typeof TradeSchema>): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "MANAGER" || !session.teamId) return refuse("Solo un manager può proporre scambi.");

  const parsed = TradeSchema.safeParse(input);
  if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? "Dati non validi.");
  if (parsed.data.receiverId === session.teamId) return refuse("Non puoi scambiare con te stesso.");

  const { ruleset, season, currentYear } = await getLeagueContext();
  const window = await db.marketWindow.findFirst({ where: { seasonId: season.id, status: "OPEN" } });
  if (!window) {
    return refuse("Nessuna finestra di mercato aperta.", [
      { article: "art. 7", message: "Gli scambi si concludono a finestra aperta." },
    ]);
  }

  const validation = await validateTradeProposal({
    proposerId: session.teamId,
    receiverId: parsed.data.receiverId,
    contractsOut: parsed.data.contractsOut,
    contractsIn: parsed.data.contractsIn,
    capitalOut: fromMillions(parsed.data.capitalOut),
    capitalIn: fromMillions(parsed.data.capitalIn),
  });

  if (!validation.ok) {
    return refuse(
      "Lo scambio non è valido per una delle due squadre.",
      validation.errors.map((e) => ({ article: e.article, message: e.message })),
    );
  }

  const expiresAt = new Date(Date.now() + ruleset.market.tradeAcceptHours * 3600_000);

  await db.$transaction(async (tx) => {
    const created = await tx.trade.create({
      data: {
        seasonId: season.id,
        windowId: window.id,
        proposerId: session.teamId as string,
        receiverId: parsed.data.receiverId,
        status: "PROPOSED",
        expiresAt,
        message: parsed.data.message,
        validation: { effects: validation.effects, warnings: validation.warnings } as never,
        items: {
          create: [
            ...parsed.data.contractsOut.map((contractId) => ({
              fromTeamId: session.teamId as string,
              kind: "PLAYER" as const,
              contractId,
            })),
            ...parsed.data.contractsIn.map((contractId) => ({
              fromTeamId: parsed.data.receiverId,
              kind: "PLAYER" as const,
              contractId,
            })),
            ...(parsed.data.capitalOut > 0
              ? [
                  {
                    fromTeamId: session.teamId as string,
                    kind: "CAPITAL" as const,
                    capitalAmount: toDecimalString(fromMillions(parsed.data.capitalOut)),
                  },
                ]
              : []),
            ...(parsed.data.capitalIn > 0
              ? [
                  {
                    fromTeamId: parsed.data.receiverId,
                    kind: "CAPITAL" as const,
                    capitalAmount: toDecimalString(fromMillions(parsed.data.capitalIn)),
                  },
                ]
              : []),
          ],
        },
      },
    });

    const [from, to] = await Promise.all([
      tx.team.findUniqueOrThrow({ where: { id: session.teamId as string }, select: { name: true } }),
      tx.team.findUniqueOrThrow({ where: { id: parsed.data.receiverId }, select: { name: true } }),
    ]);

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: session.teamId,
      action: "TRADE_PROPOSED",
      summary: `${from.name} propone uno scambio a ${to.name} (${parsed.data.contractsOut.length + parsed.data.contractsIn.length} giocatori)`,
      payload: { tradeId: created.id },
    });

    return created;
  });

  void currentYear;
  revalidatePath("/mercato");
  revalidatePath("/registro");

  return {
    ok: true,
    message: `Proposta inviata. Scade ${expiresAt.toLocaleString("it-IT")}.`,
    errors: validation.warnings.map((w) => ({ article: w.article, message: w.message })),
  };
}

/** Validazione condivisa tra proposta e accettazione: le due devono dire la stessa cosa. */
async function validateTradeProposal(input: {
  proposerId: string;
  receiverId: string;
  contractsOut: string[];
  contractsIn: string[];
  capitalOut: Money;
  capitalIn: Money;
}) {
  const { ruleset, currentYear } = await getLeagueContext();
  const { validateTrade } = await import("@/lib/rules/trade");

  const [proposer, receiver] = await Promise.all([
    db.team.findUniqueOrThrow({ where: { id: input.proposerId }, select: { id: true, name: true } }),
    db.team.findUniqueOrThrow({ where: { id: input.receiverId }, select: { id: true, name: true } }),
  ]);

  const [proposerContracts, receiverContracts] = await Promise.all([
    getTeamContracts(input.proposerId),
    getTeamContracts(input.receiverId),
  ]);

  const [proposerCapital, receiverCapital] = await Promise.all([
    db.capitalTransaction.findMany({ where: { teamId: input.proposerId }, select: { amount: true } }),
    db.capitalTransaction.findMany({ where: { teamId: input.receiverId }, select: { amount: true } }),
  ]);

  const outSet = new Set(input.contractsOut);
  const inSet = new Set(input.contractsIn);

  return validateTrade({
    sideA: {
      teamId: proposer.id,
      teamName: proposer.name,
      contracts: proposerContracts,
      capital: proposerCapital.reduce((a, x) => a + fromDecimal(x.amount), 0),
      contractsOut: proposerContracts.filter((c) => outSet.has(c.id)),
      picksOut: [],
      capitalOut: input.capitalOut,
    },
    sideB: {
      teamId: receiver.id,
      teamName: receiver.name,
      contracts: receiverContracts,
      capital: receiverCapital.reduce((a, x) => a + fromDecimal(x.amount), 0),
      contractsOut: receiverContracts.filter((c) => inSet.has(c.id)),
      picksOut: [],
      capitalOut: input.capitalIn,
    },
    year: currentYear,
    ruleset,
  });
}

export async function respondToTrade(tradeId: string, accept: boolean): Promise<ActionResult> {
  const session = await requireSession();
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      items: { include: { contract: { include: { player: { select: { name: true } } } } } },
      proposer: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
  });
  if (!trade) return refuse("Scambio inesistente.");
  if (session.teamId !== trade.receiverId) return refuse("Solo la squadra destinataria può rispondere.");
  if (trade.status !== "PROPOSED") return refuse("Lo scambio non è più in attesa di risposta.");
  if (trade.expiresAt < new Date()) return refuse("La proposta è scaduta.");

  const { ruleset, season } = await getLeagueContext();

  if (!accept) {
    await db.$transaction(async (tx) => {
      await tx.trade.update({ where: { id: tradeId }, data: { status: "REJECTED", respondedAt: new Date() } });
      await recordAudit(tx, {
        seasonId: season.id,
        userId: session.userId,
        teamId: trade.receiverId,
        action: "TRADE_REJECTED",
        summary: `${trade.receiver.name} rifiuta lo scambio proposto da ${trade.proposer.name}`,
        payload: { tradeId },
      });
    });
    revalidatePath("/mercato");
    return { ok: true, message: "Proposta rifiutata." };
  }

  // Si rivalida al momento dell'accettazione: tra proposta e risposta possono
  // essere passate 48 ore e le rose possono essere cambiate.
  const capitalItems = trade.items.filter((i) => i.kind === "CAPITAL");
  const revalidation = await validateTradeProposal({
    proposerId: trade.proposerId,
    receiverId: trade.receiverId,
    contractsOut: trade.items.filter((i) => i.kind === "PLAYER" && i.fromTeamId === trade.proposerId).map((i) => i.contractId as string),
    contractsIn: trade.items.filter((i) => i.kind === "PLAYER" && i.fromTeamId === trade.receiverId).map((i) => i.contractId as string),
    capitalOut: capitalItems.filter((i) => i.fromTeamId === trade.proposerId).reduce((a, i) => a + fromDecimal(i.capitalAmount), 0),
    capitalIn: capitalItems.filter((i) => i.fromTeamId === trade.receiverId).reduce((a, i) => a + fromDecimal(i.capitalAmount), 0),
  });

  if (!revalidation.ok) {
    return refuse(
      "Le rose sono cambiate dalla proposta: lo scambio non è più valido.",
      revalidation.errors.map((e) => ({ article: e.article, message: e.message })),
    );
  }

  const vetoableUntil = new Date(Date.now() + ruleset.market.tradeVetoHours * 3600_000);

  await db.$transaction(async (tx) => {
    for (const item of trade.items) {
      if (item.kind === "PLAYER" && item.contractId) {
        const destination = item.fromTeamId === trade.proposerId ? trade.receiverId : trade.proposerId;
        // Il contratto cambia squadra ma non cambia contenuto (art. 5.3)
        await tx.contract.update({ where: { id: item.contractId }, data: { teamId: destination } });
        await tx.contractEvent.create({
          data: {
            contractId: item.contractId,
            type: "TRADED",
            effectiveYear: season.startYear,
            note: `Scambio tra ${trade.proposer.name} e ${trade.receiver.name}`,
          },
        });
      }
      if (item.kind === "CAPITAL" && item.capitalAmount) {
        const amount = fromDecimal(item.capitalAmount);
        const destination = item.fromTeamId === trade.proposerId ? trade.receiverId : trade.proposerId;
        await tx.capitalTransaction.createMany({
          data: [
            {
              teamId: item.fromTeamId,
              seasonId: season.id,
              amount: toDecimalString(-amount),
              kind: "TRADE_TRANSFER",
              description: "Capitale ceduto in uno scambio",
              refType: "Trade",
              refId: tradeId,
            },
            {
              teamId: destination,
              seasonId: season.id,
              amount: toDecimalString(amount),
              kind: "TRADE_TRANSFER",
              description: "Capitale ricevuto in uno scambio",
              refType: "Trade",
              refId: tradeId,
            },
          ],
        });
      }
    }

    await tx.trade.update({
      where: { id: tradeId },
      data: { status: "EXECUTED", respondedAt: new Date(), vetoableUntil },
    });

    const players = trade.items
      .filter((i) => i.kind === "PLAYER")
      .map((i) => i.contract?.player.name)
      .filter(Boolean)
      .join(", ");

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: trade.receiverId,
      action: "TRADE_EXECUTED",
      summary: `Scambio eseguito tra ${trade.proposer.name} e ${trade.receiver.name}: ${players || "solo capitale"}`,
      payload: { tradeId, effects: revalidation.effects },
    });
  });

  revalidatePath("/mercato");
  revalidatePath("/lega");
  revalidatePath("/registro");

  return {
    ok: true,
    message: `Scambio eseguito. Il commissioner può annullarlo entro ${ruleset.market.tradeVetoHours} ore se lo ritiene di comodo.`,
  };
}

/** Anteprima degli effetti, per mostrarli prima di proporre o accettare. */
export async function previewTrade(input: {
  receiverId: string;
  contractsOut: string[];
  contractsIn: string[];
  capitalOut: number;
  capitalIn: number;
}) {
  const session: Session = await requireSession();
  if (!session.teamId) return null;

  return validateTradeProposal({
    proposerId: session.teamId,
    receiverId: input.receiverId,
    contractsOut: input.contractsOut,
    contractsIn: input.contractsIn,
    capitalOut: fromMillions(input.capitalOut),
    capitalIn: fromMillions(input.capitalIn),
  });
}

/** Il commissioner annulla uno scambio manifestamente collusivo (art. 11.1.3). */
export async function vetoTrade(tradeId: string, reason: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "COMMISSIONER") return refuse("Solo il commissioner può annullare uno scambio.");
  if (reason.trim().length < 10) return refuse("Serve una motivazione: l'annullamento va spiegato pubblicamente.");

  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: { items: true, proposer: { select: { name: true } }, receiver: { select: { name: true } } },
  });
  if (!trade) return refuse("Scambio inesistente.");
  if (trade.status !== "EXECUTED") return refuse("Si può annullare solo uno scambio eseguito.");
  if (trade.vetoableUntil && trade.vetoableUntil < new Date()) {
    return refuse("Il termine per l'annullamento è scaduto.");
  }

  const { season } = await getLeagueContext();

  await db.$transaction(async (tx) => {
    // Si riporta tutto indietro invertendo i movimenti, senza cancellare nulla
    for (const item of trade.items) {
      if (item.kind === "PLAYER" && item.contractId) {
        await tx.contract.update({ where: { id: item.contractId }, data: { teamId: item.fromTeamId } });
      }
      if (item.kind === "CAPITAL" && item.capitalAmount) {
        const amount = fromDecimal(item.capitalAmount);
        const destination = item.fromTeamId === trade.proposerId ? trade.receiverId : trade.proposerId;
        await tx.capitalTransaction.createMany({
          data: [
            {
              teamId: item.fromTeamId,
              seasonId: season.id,
              amount: toDecimalString(amount),
              kind: "TRADE_TRANSFER",
              description: "Storno: scambio annullato dal commissioner",
              refType: "Trade",
              refId: tradeId,
            },
            {
              teamId: destination,
              seasonId: season.id,
              amount: toDecimalString(-amount),
              kind: "TRADE_TRANSFER",
              description: "Storno: scambio annullato dal commissioner",
              refType: "Trade",
              refId: tradeId,
            },
          ],
        });
      }
    }

    await tx.trade.update({ where: { id: tradeId }, data: { status: "VETOED", vetoReason: reason } });

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "TRADE_VETOED",
      summary: `Il commissioner annulla lo scambio tra ${trade.proposer.name} e ${trade.receiver.name}: ${reason}`,
      payload: { tradeId, reason },
    });
  });

  revalidatePath("/mercato");
  revalidatePath("/registro");
  return { ok: true, message: "Scambio annullato e riportato indietro." };
}

/** Età del giocatore, per mostrare quali contratti gli si possono offrire. */
export async function playerAge(playerId: string): Promise<number | null> {
  const { ruleset, currentYear } = await getLeagueContext();
  const player = await db.player.findUnique({ where: { id: playerId }, select: { birthDate: true } });
  return ageAtSeason(player?.birthDate, currentYear, ruleset);
}
