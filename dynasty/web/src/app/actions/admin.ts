"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCommissioner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getLeagueContext } from "@/lib/league";
import { importMatchdayVotes, importQuotations, type ImportOutcome } from "@/lib/import/lfc";
import { importTransfermarkt } from "@/lib/import/transfermarkt";
import { formatMoney, fromDecimal, fromMillions, toDecimalString } from "@/lib/money";
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

// ───────────────────────────────────────────────── Squadre e manager (art. 1.1)

/**
 * Una lega vera nasce vuota: nessuna squadra, il listone tutto svincolato, le
 * rose da formare all'asta. Le squadre le crea qui il commissioner, una per
 * manager, mano a mano che le adesioni si confermano.
 *
 * Creare una squadra non è solo una riga in tabella: porta con sé la dotazione
 * iniziale (art. 14), lo stadio a livello zero, il settore giovanile e le
 * scelte al draft. Farlo a mano nel database vorrebbe dire dimenticarne una.
 */

const SquadraSchema = z.object({
  name: z.string().trim().min(2, "Il nome è troppo corto").max(40, "Il nome è troppo lungo"),
  shortName: z
    .string()
    .trim()
    .min(2, "La sigla è troppo corta")
    .max(4, "La sigla non può superare quattro lettere")
    .transform((s) => s.toUpperCase()),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Il colore va scritto come #1D4ED8"),
  managerEmail: z.string().trim().toLowerCase().email("Indirizzo non valido"),
  managerName: z.string().trim().max(60).optional(),
});

export interface CredenzialiState extends ActionResult {
  /** Mostrata una volta sola: nel database resta solo l'impronta. */
  credenziali?: { team: string; email: string; password: string };
}

/** Password leggibile ma non indovinabile: quattro gruppi di quattro caratteri. */
function generaPassword(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const caratteri = [...bytes].map((b) => alfabeto[b % alfabeto.length]);
  return [0, 4, 8, 12].map((i) => caratteri.slice(i, i + 4).join("")).join("-");
}

export async function creaSquadra(_prev: CredenzialiState, formData: FormData): Promise<CredenzialiState> {
  const session = await requireCommissioner();
  const { league, season, ruleset } = await getLeagueContext();

  const parsed = SquadraSchema.safeParse({
    name: formData.get("name"),
    shortName: formData.get("shortName"),
    color: formData.get("color"),
    managerEmail: formData.get("managerEmail"),
    managerName: formData.get("managerName") || undefined,
  });
  if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? "Dati non validi");
  const dati = parsed.data;

  const quante = await db.team.count({ where: { leagueId: league.id } });
  if (quante >= ruleset.governance.teams) {
    return refuse(`La lega è già al completo: ${ruleset.governance.teams} squadre.`);
  }

  if (await db.team.findFirst({ where: { leagueId: league.id, name: dati.name } })) {
    return refuse(`Esiste già una squadra che si chiama «${dati.name}».`);
  }
  if (await db.user.findFirst({ where: { leagueId: league.id, email: dati.managerEmail } })) {
    return refuse(`L'indirizzo ${dati.managerEmail} è già usato da un altro accesso.`);
  }

  const password = generaPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const team = await db.$transaction(async (tx) => {
    const creata = await tx.team.create({
      data: { leagueId: league.id, name: dati.name, shortName: dati.shortName, color: dati.color },
    });

    await tx.user.create({
      data: {
        leagueId: league.id,
        email: dati.managerEmail,
        name: dati.managerName ?? `Manager ${dati.shortName}`,
        passwordHash,
        role: "MANAGER",
        teamId: creata.id,
      },
    });

    await tx.capitalTransaction.create({
      data: {
        teamId: creata.id,
        seasonId: season.id,
        amount: toDecimalString(fromMillions(ruleset.capital.initialEndowment)),
        kind: "INITIAL_ENDOWMENT",
        description: "Dotazione iniziale (art. 14)",
      },
    });
    await tx.stadium.create({ data: { teamId: creata.id, seasonId: season.id, level: 0 } });
    await tx.academy.create({
      data: { teamId: creata.id, seasonId: season.id, capacity: ruleset.youth.baseCapacity },
    });

    // Le scelte al draft esistono da subito perché sono scambiabili (art. 13.4):
    // una squadra deve poterle cedere ancora prima che si estragga la lotteria,
    // che ne fisserà l'ordine ma non chi le possiede.
    const draft = await tx.draft.findFirst({ where: { seasonId: season.id } });
    if (draft) {
      for (let round = 1; round <= 3; round += 1) {
        await tx.draftPick.create({
          data: {
            draftId: draft.id,
            teamId: creata.id,
            originalTeamId: creata.id,
            round,
            pickNumber: (round - 1) * ruleset.governance.teams + quante + 1,
            forYear: season.startYear,
          },
        });
      }
    }

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "TEAM_CREATED",
      summary: `Iscritta ${dati.name} (${dati.shortName}) — manager ${dati.managerEmail}`,
      payload: { teamId: creata.id, name: dati.name, managerEmail: dati.managerEmail },
    });

    return creata;
  });

  revalidatePath("/admin");
  revalidatePath("/lega");
  return {
    ok: true,
    message: `${team.name} iscritta. Sono ${quante + 1} squadre su ${ruleset.governance.teams}.`,
    credenziali: { team: team.name, email: dati.managerEmail, password },
  };
}

const ModificaSchema = SquadraSchema.omit({ managerEmail: true, managerName: true }).extend({
  teamId: z.string().min(1),
  managerEmail: z.string().trim().toLowerCase().email("Indirizzo non valido"),
});

export async function modificaSquadra(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { league, season } = await getLeagueContext();

  const parsed = ModificaSchema.safeParse({
    teamId: formData.get("teamId"),
    name: formData.get("name"),
    shortName: formData.get("shortName"),
    color: formData.get("color"),
    managerEmail: formData.get("managerEmail"),
  });
  if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? "Dati non validi");
  const dati = parsed.data;

  const team = await db.team.findFirst({
    where: { id: dati.teamId, leagueId: league.id },
    include: { manager: true },
  });
  if (!team) return refuse("Squadra inesistente.");

  const omonima = await db.team.findFirst({
    where: { leagueId: league.id, name: dati.name, id: { not: team.id } },
  });
  if (omonima) return refuse(`Esiste già una squadra che si chiama «${dati.name}».`);

  const altroAccesso = await db.user.findFirst({
    where: { leagueId: league.id, email: dati.managerEmail, NOT: { teamId: team.id } },
  });
  if (altroAccesso) return refuse(`L'indirizzo ${dati.managerEmail} è già usato da un altro accesso.`);

  await db.$transaction(async (tx) => {
    await tx.team.update({
      where: { id: team.id },
      data: { name: dati.name, shortName: dati.shortName, color: dati.color },
    });

    const manager = team.manager;
    if (manager) {
      await tx.user.update({ where: { id: manager.id }, data: { email: dati.managerEmail } });
    } else {
      // Squadra rimasta senza manager: gli si ridà un accesso, con una password
      // nuova che però da qui non si vede. Si rigenera dal pulsante apposta.
      await tx.user.create({
        data: {
          leagueId: league.id,
          email: dati.managerEmail,
          name: `Manager ${dati.shortName}`,
          passwordHash: await bcrypt.hash(generaPassword(), 12),
          role: "MANAGER",
          teamId: team.id,
        },
      });
    }

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "TEAM_UPDATED",
      summary:
        team.name === dati.name
          ? `${dati.name}: dati aggiornati`
          : `${team.name} cambia nome in ${dati.name}`,
      payload: { teamId: team.id, name: dati.name, managerEmail: dati.managerEmail },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/lega");
  return { ok: true, message: `${dati.name} aggiornata.` };
}

/**
 * Rigenera la password di un manager. Serve quando la perde: quella vecchia non
 * è recuperabile da nessuno, commissioner compreso, perché nel database c'è solo
 * la sua impronta.
 */
export async function rigeneraPassword(teamId: string): Promise<CredenzialiState> {
  const session = await requireCommissioner();
  const { league, season } = await getLeagueContext();

  const team = await db.team.findFirst({
    where: { id: teamId, leagueId: league.id },
    include: { manager: true },
  });
  if (!team) return refuse("Squadra inesistente.");
  const manager = team.manager;
  if (!manager) return refuse("Questa squadra non ha ancora un manager.");

  const password = generaPassword();
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: manager.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "PASSWORD_RESET",
      summary: `Nuova password per il manager di ${team.name}`,
      payload: { teamId: team.id, email: manager.email },
    });
  });

  revalidatePath("/admin");
  return {
    ok: true,
    message: "Password nuova. Si vede una volta sola.",
    credenziali: { team: team.name, email: manager.email, password },
  };
}

/**
 * Cancella una squadra. Possibile solo finché non ha contratti: dopo l'asta una
 * squadra non si toglie senza decidere che fine fanno i suoi giocatori, e quella
 * è una decisione di lega, non un pulsante.
 */
export async function eliminaSquadra(teamId: string): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { league, season } = await getLeagueContext();

  const team = await db.team.findFirst({
    where: { id: teamId, leagueId: league.id },
    include: { _count: { select: { contracts: true } } },
  });
  if (!team) return refuse("Squadra inesistente.");
  if (team._count.contracts > 0) {
    return refuse(
      `${team.name} ha ${team._count.contracts} contratti: vanno prima liberati, altrimenti resterebbero giocatori senza squadra e senza svincolo.`,
    );
  }

  await db.$transaction(async (tx) => {
    await tx.draftPick.deleteMany({ where: { OR: [{ teamId: team.id }, { originalTeamId: team.id }] } });
    await tx.capitalTransaction.deleteMany({ where: { teamId: team.id } });
    await tx.stadium.deleteMany({ where: { teamId: team.id } });
    await tx.academy.deleteMany({ where: { teamId: team.id } });
    await tx.scout.deleteMany({ where: { teamId: team.id } });
    await tx.sponsorship.deleteMany({ where: { teamId: team.id } });
    await tx.user.deleteMany({ where: { teamId: team.id } });
    await tx.team.delete({ where: { id: team.id } });

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "TEAM_DELETED",
      summary: `${team.name} ritirata dalla lega`,
      payload: { teamId: team.id, name: team.name },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/lega");
  return { ok: true, message: `${team.name} ritirata.` };
}

/**
 * Riporta la lega al giorno zero: via tutte le squadre, i manager, i contratti
 * e il capitale; restano la stagione, il listone, le finestre, le competizioni e
 * l'accesso del commissioner.
 *
 * Serve una volta sola, se si è partiti col piede sbagliato — per esempio con le
 * squadre di prova. Chiede di riscrivere il nome della lega perché non è un
 * pulsante da premere per sbaglio: quello che cancella non torna.
 */
export async function azzeraLega(conferma: string): Promise<ActionResult> {
  const session = await requireCommissioner();
  const { league, season } = await getLeagueContext();

  if (conferma.trim().toLowerCase() !== league.name.toLowerCase()) {
    return refuse(`Per confermare scrivi esattamente «${league.name}».`);
  }

  const quante = await db.team.count({ where: { leagueId: league.id } });

  await db.$transaction(async (tx) => {
    await tx.auctionBid.deleteMany();
    await tx.auctionLot.deleteMany();
    await tx.tradeItem.deleteMany();
    await tx.trade.deleteMany();
    await tx.waiverClaim.deleteMany();
    await tx.marketOffer.deleteMany();
    await tx.contractEvent.deleteMany();
    await tx.contract.deleteMany();
    await tx.optionUsage.deleteMany();
    await tx.youthPlayer.deleteMany();
    await tx.draftPick.deleteMany();
    await tx.capitalTransaction.deleteMany();
    await tx.stadium.deleteMany();
    await tx.academy.deleteMany();
    await tx.scout.deleteMany();
    await tx.sponsorship.deleteMany();
    await tx.standingRow.deleteMany();
    await tx.fixture.deleteMany();
    await tx.user.deleteMany({ where: { leagueId: league.id, role: "MANAGER" } });
    await tx.team.deleteMany({ where: { leagueId: league.id } });
    await tx.auction.updateMany({ where: { seasonId: season.id }, data: { status: "SCHEDULED", callOrder: [] } });

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      action: "LEAGUE_RESET",
      summary: `Lega riportata al giorno zero: ${quante} squadre rimosse, listone tutto svincolato`,
      payload: { squadreRimosse: quante },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/lega");
  revalidatePath("/mercato");
  revalidatePath("/asta");
  return {
    ok: true,
    message: `Fatto: ${quante} squadre rimosse, tutti i giocatori svincolati. Ora iscrivi le squadre vere.`,
  };
}
