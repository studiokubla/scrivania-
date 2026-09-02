"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCommissioner, requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getLeagueContext, getTeamContracts, scheduleToJson } from "@/lib/league";
import { appSecret } from "@/lib/secret";
import { formatMoney, fromDecimal, fromMillions, toDecimalString } from "@/lib/money";
import {
  basePriceFor,
  bidFingerprint,
  canPassTurn,
  drawCallOrder,
  resolveAuctionTie,
  resolveSealedBids,
  validateAuctionBid,
} from "@/lib/rules/auction";
import { buildSalarySchedule, validateContractSignature } from "@/lib/rules/contracts";
import type { ActionResult } from "./contracts";

function refuse(message: string, errors?: { article: string; message: string }[]): ActionResult {
  return { ok: false, message, errors };
}

async function loadAuction() {
  const { season } = await getLeagueContext();
  const auction = await db.auction.findUnique({ where: { seasonId: season.id } });
  return { season, auction };
}

/** Estrae l'ordine di chiamata e apre l'asta (art. 8.1). */
export async function startAuction(): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { league, season } = await getLeagueContext();

  const teams = await db.team.findMany({ where: { leagueId: league.id }, select: { id: true, name: true } });
  if (teams.length < 2) return refuse("Servono almeno due squadre.");

  const seed = `asta-${season.id}-${Date.now()}`;
  const callOrder = drawCallOrder(teams.map((t) => t.id), seed);
  const names = callOrder.map((id) => teams.find((t) => t.id === id)?.name).filter(Boolean);

  await db.$transaction(async (tx) => {
    await tx.auction.upsert({
      where: { seasonId: season.id },
      create: { seasonId: season.id, status: "RUNNING", callOrder, startedAt: new Date() },
      update: {
        status: "RUNNING",
        callOrder,
        currentTurn: 0,
        passedTeams: [],
        startedAt: new Date(),
        finishedAt: null,
      },
    });

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "AUCTION_STARTED",
      summary: `Asta aperta. Ordine di chiamata estratto: ${names.join(", ")}`,
      payload: { seed, callOrder },
    });
  });

  revalidatePath("/asta");
  return { ok: true, message: "Asta aperta e ordine estratto." };
}

export async function pauseAuction(paused: boolean): Promise<ActionResult> {
  await requireCommissioner();
  const { season } = await getLeagueContext();
  await db.auction.update({
    where: { seasonId: season.id },
    data: { status: paused ? "PAUSED" : "RUNNING" },
  });
  revalidatePath("/asta");
  return { ok: true, message: paused ? "Asta in pausa." : "Asta ripresa." };
}

export async function finishAuction(): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { season } = await getLeagueContext();

  await db.$transaction(async (tx) => {
    await tx.auction.update({
      where: { seasonId: season.id },
      data: { status: "FINISHED", finishedAt: new Date() },
    });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "AUCTION_FINISHED",
      summary: "Asta chiusa",
    });
  });

  revalidatePath("/asta");
  return { ok: true, message: "Asta chiusa." };
}

/** Chi tocca adesso: si scorre l'ordine saltando chi ha già chiuso la propria asta. */
function currentCaller(auction: { callOrder: string[]; currentTurn: number; passedTeams: string[] }): string | null {
  const active = auction.callOrder.filter((id) => !auction.passedTeams.includes(id));
  if (active.length === 0) return null;
  return active[auction.currentTurn % active.length];
}

async function advanceTurn(
  tx: Pick<typeof db, "auction">,
  seasonId: string,
  auction: { currentTurn: number },
): Promise<void> {
  await tx.auction.update({ where: { seasonId }, data: { currentTurn: auction.currentTurn + 1 } });
}

/** Il manager di turno chiama un giocatore all'asta (art. 8.2). */
export async function callPlayer(playerId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.teamId) return refuse("Il commissioner non chiama giocatori.");

  const { ruleset, season } = await getLeagueContext();
  const auction = await db.auction.findUnique({ where: { seasonId: season.id } });
  if (!auction || auction.status !== "RUNNING") return refuse("L'asta non è in corso.");

  if (currentCaller(auction) !== session.teamId) return refuse("Non è il tuo turno di chiamata.");

  const openLot = await db.auctionLot.findFirst({
    where: { auctionId: auction.id, status: { in: ["OPEN", "SEALED", "TIE_BREAK"] } },
  });
  if (openLot) return refuse("C'è già una chiamata in corso.");

  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      contracts: { where: { status: "ACTIVE" } },
      seasons: { where: { seasonId: season.id }, select: { quotationCurrent: true } },
    },
  });
  if (!player) return refuse("Giocatore inesistente.");
  if (player.contracts.length > 0) return refuse(`${player.name} è già sotto contratto.`);

  const quotation = player.seasons[0]?.quotationCurrent ? Number(player.seasons[0].quotationCurrent) : 0;
  const basePrice = basePriceFor(quotation, ruleset);
  const sequence = (await db.auctionLot.count({ where: { auctionId: auction.id } })) + 1;
  const closesAt = new Date(Date.now() + auction.bidWindowSeconds * 1000);

  await db.$transaction(async (tx) => {
    await tx.auctionLot.create({
      data: {
        auctionId: auction.id,
        playerId,
        calledById: session.teamId as string,
        basePrice: toDecimalString(basePrice),
        status: "OPEN",
        closesAt,
        sequence,
      },
    });

    const team = await tx.team.findUniqueOrThrow({ where: { id: session.teamId as string }, select: { name: true } });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: session.teamId,
      action: "AUCTION_CALL",
      summary: `${team.name} chiama ${player.name} (base ${formatMoney(basePrice)})`,
      payload: { playerId, basePrice, sequence },
    });
  });

  revalidatePath("/asta");
  return { ok: true, message: `${player.name} all'asta. ${auction.bidWindowSeconds} secondi per offrire.` };
}

/** Offerta segreta sulla chiamata in corso (art. 8.3). Zero significa «non mi interessa». */
export async function submitAuctionBid(lotId: string, amountMillions: number): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.teamId) return refuse("Il commissioner non fa offerte.");

  const parsed = z.coerce.number().min(0).safeParse(amountMillions);
  if (!parsed.success) return refuse("Importo non valido.");
  const amount = fromMillions(parsed.data);

  const { ruleset, currentYear, season } = await getLeagueContext();
  const lot = await db.auctionLot.findUnique({
    where: { id: lotId },
    include: { player: { select: { name: true } } },
  });
  if (!lot) return refuse("Chiamata inesistente.");
  if (lot.status !== "OPEN" && lot.status !== "TIE_BREAK") return refuse("Le offerte su questa chiamata sono chiuse.");
  if (lot.closesAt && lot.closesAt < new Date()) return refuse("Tempo scaduto.");
  if (lot.status === "TIE_BREAK") {
    const inTie = await db.auctionBid.findFirst({
      where: { lotId, teamId: session.teamId, round: lot.tieBreakRound - 1 },
    });
    if (!inTie) return refuse("Non sei tra le squadre in parità: lo spareggio è riservato a loro.");
  }

  const contracts = await getTeamContracts(session.teamId);
  const check = validateAuctionBid({
    amount,
    basePrice: fromDecimal(lot.basePrice),
    contracts,
    year: currentYear,
    ruleset,
  });
  if (!check.ok) {
    return refuse("Offerta non valida.", check.errors.map((e) => ({ article: e.article, message: e.message })));
  }

  const submittedAt = new Date();
  await db.auctionBid.upsert({
    where: { lotId_teamId_round: { lotId, teamId: session.teamId, round: lot.tieBreakRound } },
    create: {
      lotId,
      teamId: session.teamId,
      amount: toDecimalString(amount),
      round: lot.tieBreakRound,
      fingerprint: bidFingerprint({
        lotId,
        teamId: session.teamId,
        amount,
        submittedAt,
        secret: await appSecret(),
      }),
      submittedAt,
    },
    // Finché la busta non si apre, il manager può correggere l'offerta
    update: { amount: toDecimalString(amount), submittedAt },
  });

  void season;
  revalidatePath("/asta");
  return { ok: true, message: amount === 0 ? "Registrato: nessun interesse." : `Offerta di ${formatMoney(amount)} sigillata.` };
}

/**
 * Apre le buste della chiamata scaduta e assegna il giocatore.
 *
 * Come per la free agency, si risolve quando qualcuno guarda la pagina: l'esito
 * dipende solo dallo scadere del tempo.
 */
export async function resolveDueLots(): Promise<number> {
  const { ruleset, season, currentYear } = await getLeagueContext();
  const auction = await db.auction.findUnique({ where: { seasonId: season.id } });
  if (!auction || auction.status !== "RUNNING") return 0;

  const due = await db.auctionLot.findMany({
    where: { auctionId: auction.id, status: { in: ["OPEN", "TIE_BREAK"] }, closesAt: { lte: new Date() } },
    include: { player: { select: { id: true, name: true, birthDate: true } }, bids: true },
  });
  if (due.length === 0) return 0;

  for (const lot of due) {
    const bids = lot.bids.filter((b) => b.round === lot.tieBreakRound);
    const outcome = resolveSealedBids({
      bids: bids.map((b) => ({ teamId: b.teamId, amount: fromDecimal(b.amount), submittedAt: b.submittedAt })),
      minimum: fromDecimal(lot.basePrice),
      tieBreak: "REPEAT",
    });

    // Parità: si ripete l'offerta tra i pari merito. Al secondo pareggio
    // decide l'ordine di chiamata (art. 8.5).
    if (!outcome.winnerId && outcome.tiedTeamIds.length > 1) {
      if (lot.tieBreakRound === 0) {
        await db.$transaction(async (tx) => {
          await tx.auctionLot.update({
            where: { id: lot.id },
            data: {
              status: "TIE_BREAK",
              tieBreakRound: 1,
              closesAt: new Date(Date.now() + auction.bidWindowSeconds * 1000),
            },
          });
          await recordAudit(tx, {
            seasonId: season.id,
            action: "AUCTION_TIE",
            summary: `Parità su ${lot.player.name} a ${formatMoney(outcome.amount)}: si ripete l'offerta`,
            payload: { lotId: lot.id, tied: outcome.tiedTeamIds, amount: outcome.amount },
          });
        });
        continue;
      }

      const winnerId = resolveAuctionTie({ tiedTeamIds: outcome.tiedTeamIds, callOrder: auction.callOrder });
      await assignLot({
        lotId: lot.id,
        playerId: lot.playerId,
        playerName: lot.player.name,
        playerBirthDate: lot.player.birthDate,
        teamId: winnerId,
        amount: outcome.amount,
        seasonId: season.id,
        currentYear,
        note: "Assegnato per ordine di chiamata dopo il secondo pareggio (art. 8.5)",
        ruleset,
      });
      await advanceTurn(db, season.id, auction);
      continue;
    }

    if (!outcome.winnerId) {
      await db.$transaction(async (tx) => {
        await tx.auctionLot.update({ where: { id: lot.id }, data: { status: "VOIDED" } });
        await recordAudit(tx, {
          seasonId: season.id,
          action: "AUCTION_VOID",
          summary: `Nessuna offerta per ${lot.player.name}: resta svincolato`,
          payload: { lotId: lot.id },
        });
      });
      await advanceTurn(db, season.id, auction);
      continue;
    }

    await assignLot({
      lotId: lot.id,
      playerId: lot.playerId,
      playerName: lot.player.name,
      playerBirthDate: lot.player.birthDate,
      teamId: outcome.winnerId,
      amount: outcome.amount,
      seasonId: season.id,
      currentYear,
      ruleset,
    });
    await advanceTurn(db, season.id, auction);
  }

  revalidatePath("/asta");
  return due.length;
}

async function assignLot(input: {
  lotId: string;
  playerId: string;
  playerName: string;
  playerBirthDate: Date | null;
  teamId: string;
  amount: number;
  seasonId: string;
  currentYear: number;
  note?: string;
  ruleset: Awaited<ReturnType<typeof getLeagueContext>>["ruleset"];
}) {
  // Ogni acquisto nasce Annuale; il manager lo converte in pluriennale
  // dalla scrivania, se ha slot e requisiti (art. 4.1).
  const schedule = buildSalarySchedule({
    type: "ANNUALE",
    baseSalary: input.amount,
    years: 1,
    startYear: input.currentYear,
    ruleset: input.ruleset,
  });

  await db.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        teamId: input.teamId,
        playerId: input.playerId,
        seasonId: input.seasonId,
        type: "ANNUALE",
        baseSalary: toDecimalString(input.amount),
        years: 1,
        startYear: input.currentYear,
        endYear: input.currentYear,
        salarySchedule: scheduleToJson(schedule) as never,
      },
    });

    await tx.contractEvent.create({
      data: {
        contractId: contract.id,
        type: "SIGNED",
        effectiveYear: input.currentYear,
        amountAfter: toDecimalString(input.amount),
        note: input.note ?? "Aggiudicato all'asta di settembre",
      },
    });

    await tx.auctionLot.update({
      where: { id: input.lotId },
      data: {
        status: "ASSIGNED",
        wonByTeamId: input.teamId,
        winningAmount: toDecimalString(input.amount),
        contractType: "ANNUALE",
        contractYears: 1,
      },
    });

    await tx.auctionBid.updateMany({ where: { lotId: input.lotId }, data: { revealedAt: new Date() } });

    const team = await tx.team.findUniqueOrThrow({ where: { id: input.teamId }, select: { name: true } });
    const bids = await tx.auctionBid.findMany({ where: { lotId: input.lotId }, include: { team: { select: { name: true } } } });

    await recordAudit(tx, {
      seasonId: input.seasonId,
      teamId: input.teamId,
      action: "AUCTION_ASSIGNED",
      summary: `${input.playerName} a ${team.name} per ${formatMoney(input.amount)}${input.note ? ` — ${input.note}` : ""}`,
      payload: {
        lotId: input.lotId,
        playerId: input.playerId,
        amount: input.amount,
        // All'apertura tutte le offerte diventano pubbliche
        bids: bids.map((b) => ({ team: b.team.name, amount: fromDecimal(b.amount) })),
      },
    });
  });
}

/** Il manager dichiara chiusa la propria asta: decisione definitiva (art. 8.2). */
export async function passAuctionTurn(): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.teamId) return refuse("Il commissioner non partecipa all'asta.");

  const { ruleset, season, currentYear } = await getLeagueContext();
  const auction = await db.auction.findUnique({ where: { seasonId: season.id } });
  if (!auction || auction.status !== "RUNNING") return refuse("L'asta non è in corso.");

  const contracts = await getTeamContracts(session.teamId);
  if (!canPassTurn({ contracts, year: currentYear, ruleset })) {
    return refuse("Non hai ancora la rosa minima.", [
      {
        article: "art. 8.2",
        message: `Si può smettere di chiamare solo con almeno ${ruleset.roster.minPlayers} giocatori.`,
      },
    ]);
  }
  if (auction.passedTeams.includes(session.teamId)) return refuse("Hai già chiuso la tua asta.");

  await db.$transaction(async (tx) => {
    await tx.auction.update({
      where: { seasonId: season.id },
      data: { passedTeams: { push: session.teamId as string } },
    });
    const team = await tx.team.findUniqueOrThrow({ where: { id: session.teamId as string }, select: { name: true } });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: session.teamId,
      action: "AUCTION_PASS",
      summary: `${team.name} chiude la propria asta con ${contracts.filter((c) => c.status === "ACTIVE").length} giocatori`,
    });
  });

  revalidatePath("/asta");
  return { ok: true, message: "Asta chiusa per la tua squadra. La decisione è definitiva." };
}

/** Verifica se il tipo di contratto scelto è firmabile per il giocatore aggiudicato. */
export async function checkContractForPlayer(input: {
  playerId: string;
  type: "ANNUALE" | "STANDARD" | "ROOKIE" | "VETERAN" | "TAMPONE";
  salaryMillions: number;
  years: number;
}) {
  const { ruleset, currentYear } = await getLeagueContext();
  const player = await db.player.findUnique({ where: { id: input.playerId }, select: { birthDate: true } });
  const result = validateContractSignature({
    type: input.type,
    salary: fromMillions(input.salaryMillions),
    years: input.years,
    seasonStartYear: currentYear,
    playerBirthDate: player?.birthDate,
    ruleset,
  });
  return { ok: result.ok, errors: result.errors, warnings: result.warnings };
}

export async function getAuctionState() {
  const { auction } = await loadAuction();
  if (!auction) return null;
  return { caller: currentCaller(auction), status: auction.status };
}
