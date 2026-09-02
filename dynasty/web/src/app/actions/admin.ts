"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCommissioner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getLeagueContext } from "@/lib/league";
import { importMatchdayVotes, importQuotations, type ImportOutcome } from "@/lib/import/lfc";
import { importTransfermarkt } from "@/lib/import/transfermarkt";
import { formatMoney, fromDecimal, toDecimalString } from "@/lib/money";
import { competitionPrize, cupPrize, stadiumTier } from "@/lib/rules/capital";
import type { ActionResult } from "./contracts";

function refuse(message: string, errors?: { article: string; message: string }[]): ActionResult {
  return { ok: false, message, errors };
}

// ───────────────────────────────────────────────────────── Import (art. 21)

export interface ImportState extends ActionResult {
  outcome?: ImportOutcome;
}

export async function runImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const session = await requireCommissioner();
  const { season } = await getLeagueContext();

  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return refuse("Scegli un file.");
  if (file.size > 20 * 1024 * 1024) return refuse("Il file supera i 20 MB.");

  const run = await db.importRun.create({
    data: {
      source: kind === "TRANSFERMARKT" ? "TRANSFERMARKT" : "LEGHE_FANTACALCIO",
      kind,
      fileName: file.name,
      matchday: kind === "VOTI" ? Number(formData.get("matchday") ?? 0) || null : null,
      status: "RUNNING",
    },
  });

  try {
    let outcome: ImportOutcome;

    if (kind === "QUOTAZIONI") {
      outcome = await importQuotations(file, season.id);
    } else if (kind === "VOTI") {
      const matchday = Number(formData.get("matchday") ?? 0);
      if (!Number.isInteger(matchday) || matchday < 1 || matchday > 38) {
        await db.importRun.update({ where: { id: run.id }, data: { status: "FAILED", error: "Giornata non valida" } });
        return refuse("Indica una giornata da 1 a 38.");
      }
      outcome = await importMatchdayVotes(file, season.id, matchday);
      // La giornata raggiunta serve al performance buy-out per sapere
      // su quante partite calcolare la percentuale di presenze (art. 12.4)
      if (matchday > season.matchday) {
        await db.season.update({ where: { id: season.id }, data: { matchday } });
      }
    } else if (kind === "TRANSFERMARKT") {
      outcome = await importTransfermarkt(file);
    } else {
      await db.importRun.update({ where: { id: run.id }, data: { status: "FAILED", error: "Tipo sconosciuto" } });
      return refuse("Tipo di import non riconosciuto.");
    }

    await db.importRun.update({
      where: { id: run.id },
      data: {
        status: outcome.unmatched.length > 0 ? "PARTIAL" : "COMPLETED",
        rowsRead: outcome.rowsRead,
        rowsApplied: outcome.rowsApplied,
        unmatched: outcome.unmatched as never,
        finishedAt: new Date(),
      },
    });

    await db.$transaction(async (tx) => {
      await recordAudit(tx, {
        seasonId: season.id,
        userId: session.userId,
        action: "IMPORT",
        summary:
          `Import ${kind.toLowerCase()} da «${file.name}»: ${outcome.rowsApplied} righe su ${outcome.rowsRead}` +
          (outcome.created > 0 ? `, ${outcome.created} giocatori creati` : "") +
          (outcome.unmatched.length > 0 ? `, ${outcome.unmatched.length} non riconciliate` : ""),
        payload: { kind, fileName: file.name, rowsRead: outcome.rowsRead, rowsApplied: outcome.rowsApplied },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/mercato");
    revalidatePath("/asta");

    return {
      ok: true,
      message:
        `${outcome.rowsApplied} righe applicate su ${outcome.rowsRead}.` +
        (outcome.unmatched.length > 0
          ? ` ${outcome.unmatched.length} righe non riconciliate: vanno risolte a mano.`
          : ""),
      outcome,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto";
    await db.importRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    return refuse(`Import fallito: ${message}`);
  }
}

// ───────────────────────────────────────────────────────── Finestre e fasi

export async function setWindowStatus(windowId: string, status: "SCHEDULED" | "OPEN" | "CLOSED"): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { season } = await getLeagueContext();

  const window = await db.marketWindow.findUnique({ where: { id: windowId } });
  if (!window) return refuse("Finestra inesistente.");

  // Una finestra aperta alla volta: due contemporanee renderebbero ambiguo
  // a quale sessione appartiene un'offerta.
  if (status === "OPEN") {
    await db.marketWindow.updateMany({
      where: { seasonId: season.id, status: "OPEN", id: { not: windowId } },
      data: { status: "CLOSED" },
    });
  }

  await db.$transaction(async (tx) => {
    await tx.marketWindow.update({ where: { id: windowId }, data: { status } });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "WINDOW",
      summary: `${window.label}: ${status === "OPEN" ? "aperta" : status === "CLOSED" ? "chiusa" : "riprogrammata"}`,
      payload: { windowId, status },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/mercato");
  return { ok: true, message: `${window.label} ${status === "OPEN" ? "aperta" : "chiusa"}.` };
}

export async function setSeasonPhase(phase: "PRESEASON" | "REGULAR" | "POSTSEASON" | "ARCHIVED"): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { season } = await getLeagueContext();

  await db.$transaction(async (tx) => {
    await tx.season.update({ where: { id: season.id }, data: { phase } });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "SEASON_PHASE",
      summary: `La stagione passa alla fase «${phase}»`,
      payload: { phase },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/lega");
  return { ok: true, message: "Fase aggiornata." };
}

// ───────────────────────────────────────────────────────── Classifiche e premi

const StandingSchema = z.object({
  competitionId: z.string().min(1),
  /** teamId in ordine di classifica, dal primo all'ultimo */
  order: z.array(z.string()).min(2),
});

/**
 * Registra la classifica finale di una competizione.
 *
 * Le partite si giocano su Leghe Fantacalcio: qui arriva l'ordine d'arrivo, che
 * è ciò da cui dipendono premi, lotteria del draft e spareggi di mercato.
 */
export async function setStandings(input: z.input<typeof StandingSchema>): Promise<ActionResult> {
  const session = await requireCommissioner();
  const parsed = StandingSchema.safeParse(input);
  if (!parsed.success) return refuse("Classifica non valida.");

  const { season } = await getLeagueContext();
  const competition = await db.competition.findUnique({ where: { id: parsed.data.competitionId } });
  if (!competition) return refuse("Competizione inesistente.");

  await db.$transaction(async (tx) => {
    for (const [i, teamId] of parsed.data.order.entries()) {
      await tx.standingRow.upsert({
        where: { competitionId_teamId: { competitionId: competition.id, teamId } },
        create: { competitionId: competition.id, seasonId: season.id, teamId, position: i + 1 },
        update: { position: i + 1 },
      });
    }
    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "STANDINGS",
      summary: `Classifica aggiornata: ${competition.name}`,
      payload: { competitionId: competition.id, order: parsed.data.order },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/lega");
  return { ok: true, message: "Classifica registrata." };
}

/**
 * Distribuisce i premi di una competizione conclusa (art. 19).
 *
 * Idempotente: se i premi di quella competizione risultano già versati non li
 * versa una seconda volta. Un doppio clic non deve raddoppiare il montepremi.
 */
export async function awardPrizes(competitionId: string): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { ruleset, season } = await getLeagueContext();

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    include: { standings: { orderBy: { position: "asc" }, include: { team: { select: { name: true } } } } },
  });
  if (!competition) return refuse("Competizione inesistente.");
  if (competition.standings.length === 0) return refuse("Registra prima la classifica.");

  const already = await db.capitalTransaction.findFirst({
    where: { seasonId: season.id, kind: "COMPETITION_PRIZE", refType: "Competition", refId: competitionId },
  });
  if (already) return refuse("I premi di questa competizione sono già stati versati.");

  const rows = competition.standings.map((row) => {
    const amount =
      competition.kind === "DYNASTY_CUP" || competition.kind === "SUPER_CUP"
        ? cupPrize({
            kind: competition.kind,
            stage: row.position === 1 ? "WIN" : row.position === 2 ? "FINAL" : row.position <= 4 ? "SEMI" : "QUARTER",
            ruleset,
          })
        : competitionPrize({
            kind: competition.kind as "APERTURA" | "CLAUSURA" | "DYNASTY_YOUTH",
            position: row.position,
            ruleset,
          });
    return { teamId: row.teamId, teamName: row.team.name, position: row.position, amount };
  });

  const total = rows.reduce((a, r) => a + r.amount, 0);

  await db.$transaction(async (tx) => {
    for (const row of rows) {
      if (row.amount === 0) continue;
      await tx.capitalTransaction.create({
        data: {
          teamId: row.teamId,
          seasonId: season.id,
          amount: toDecimalString(row.amount),
          kind: "COMPETITION_PRIZE",
          description: `${competition.name} — ${row.position}° posto`,
          refType: "Competition",
          refId: competitionId,
        },
      });
    }
    await tx.competition.update({ where: { id: competitionId }, data: { status: "FINISHED" } });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "PRIZE_AWARDED",
      summary: `Premi ${competition.name} versati: ${formatMoney(total)} in totale`,
      payload: { competitionId, rows: rows.map((r) => ({ team: r.teamName, position: r.position, amount: r.amount })) },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/lega");
  return { ok: true, message: `Premi versati: ${formatMoney(total)} distribuiti su ${rows.length} squadre.` };
}

/**
 * Addebita la manutenzione annuale degli stadi (art. 15.3).
 * Chi non può pagarla vede l'impianto retrocedere di un livello.
 */
export async function chargeStadiumMaintenance(): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { ruleset, season } = await getLeagueContext();

  const stadiums = await db.stadium.findMany({
    where: { seasonId: season.id, level: { gt: 0 }, maintenancePaid: false },
    include: { team: { select: { id: true, name: true } } },
  });
  if (stadiums.length === 0) return { ok: true, message: "Nessuna manutenzione da addebitare." };

  let charged = 0;
  let downgraded = 0;

  for (const stadium of stadiums) {
    const tier = stadiumTier(stadium.level, ruleset);
    if (!tier) continue;

    const transactions = await db.capitalTransaction.findMany({
      where: { teamId: stadium.teamId },
      select: { amount: true },
    });
    const balance = transactions.reduce((a, t) => a + fromDecimal(t.amount), 0);

    await db.$transaction(async (tx) => {
      if (balance >= tier.maintenance) {
        await tx.capitalTransaction.create({
          data: {
            teamId: stadium.teamId,
            seasonId: season.id,
            amount: toDecimalString(-tier.maintenance),
            kind: "STADIUM_MAINTENANCE",
            description: `Manutenzione stadio livello ${stadium.level}`,
            refType: "Stadium",
            refId: stadium.id,
          },
        });
        await tx.stadium.update({ where: { id: stadium.id }, data: { maintenancePaid: true } });
        charged += 1;
        await recordAudit(tx, {
          seasonId: season.id,
          userId: session.userId,
          teamId: stadium.teamId,
          action: "CAPITAL_INVESTMENT",
          summary: `${stadium.team.name} paga ${formatMoney(tier.maintenance)} di manutenzione stadio`,
          payload: { stadiumId: stadium.id, level: stadium.level },
        });
      } else {
        await tx.stadium.update({
          where: { id: stadium.id },
          data: { level: stadium.level - 1, downgraded: true, maintenancePaid: true },
        });
        downgraded += 1;
        await recordAudit(tx, {
          seasonId: season.id,
          userId: session.userId,
          teamId: stadium.teamId,
          action: "CAPITAL_INVESTMENT",
          summary: `${stadium.team.name} non copre la manutenzione: lo stadio scende al livello ${stadium.level - 1} (art. 15.3)`,
          payload: { stadiumId: stadium.id, from: stadium.level, to: stadium.level - 1 },
        });
      }
    });
  }

  revalidatePath("/admin");
  revalidatePath("/lega");
  return {
    ok: true,
    message: `Manutenzione addebitata a ${charged} squadre${downgraded > 0 ? `, ${downgraded} stadi retrocessi` : ""}.`,
  };
}
