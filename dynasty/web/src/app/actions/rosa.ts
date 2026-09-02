"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getLeagueContext, getTeamState } from "@/lib/league";
import { formatMoney, fromDecimal, fromMillions, roundToStep, toDecimalString } from "@/lib/money";
import { matchPlayer, type Candidate } from "@/lib/import/match";
import { pickColumn, readUpload, toNumber } from "@/lib/import/parse";
import { buildSalarySchedule, etàAllaStagione, validateContractSignature } from "@/lib/rules/contracts";
import { canAfford } from "@/lib/rules/cap";
import type { ContractType } from "@/lib/rules/types";
import type { ActionResult } from "./contracts";

/**
 * Comporre una rosa dopo l'asta.
 *
 * L'asta si fa al tavolo e il foglio che ne esce è quasi sempre incompleto:
 * venticinque nomi scritti in fretta, i prezzi a matita, il tipo di contratto
 * deciso dopo, con calma. Questo modulo copre quel lavoro.
 *
 * Due strade, e la seconda esiste perché la prima è lenta quando i nomi sono
 * duecentocinquanta:
 *
 *  - **a mano**, un giocatore alla volta dal listone, con prezzo e contratto;
 *  - **da un foglio**, che porta i nomi e — se ci sono — prezzi e contratti.
 *    I nomi si abbinano al listone; le righe senza prezzo restano in attesa
 *    finché qualcuno non lo scrive.
 *
 * Il punto delicato è quest'ultimo. Un contratto senza ingaggio non può
 * esistere: falserebbe il tetto salariale di tutta la lega, e ogni controllo a
 * valle diventerebbe bugiardo. Perciò una riga senza prezzo **non è un
 * contratto**: sosta in `AuctionEntry`, il giocatore resta svincolato a tutti
 * gli effetti, e chiunque potrebbe ancora prenderlo. Diventa rosa solo quando
 * prezzo e tipo ci sono e le regole li accettano.
 */

function refuse(message: string, errors?: { article: string; message: string }[]): ActionResult {
  return { ok: false, message, errors };
}

/**
 * Chi può toccare la rosa di una squadra: il suo manager, e il commissioner
 * per chiunque. Durante l'asta è il commissioner ad avere il foglio in mano;
 * dopo, ogni presidente sistema la propria.
 */
type Autorizzazione =
  | { errore: ActionResult }
  | {
      errore?: undefined;
      session: Awaited<ReturnType<typeof requireSession>>;
      contesto: Awaited<ReturnType<typeof getLeagueContext>>;
      team: { id: string; name: string };
    };

async function autorizza(teamId: string): Promise<Autorizzazione> {
  const session = await requireSession();
  const contesto = await getLeagueContext();
  const team = await db.team.findFirst({ where: { id: teamId, leagueId: contesto.league.id } });
  if (!team) return { errore: refuse("Squadra inesistente.") };
  if (session.role !== "COMMISSIONER" && session.teamId !== teamId) {
    return { errore: refuse("Puoi comporre solo la rosa della tua squadra.") };
  }
  return { session, contesto, team };
}

const TIPI = ["ANNUALE", "STANDARD", "ROOKIE", "VETERAN", "TAMPONE"] as const;

const FirmaSchema = z.object({
  teamId: z.string().min(1),
  playerId: z.string().min(1, "Scegli un giocatore"),
  /** In milioni, come si scrive sul foglio dell'asta. */
  amount: z.coerce.number().positive("L'ingaggio dev'essere maggiore di zero"),
  type: z.enum(TIPI),
  years: z.coerce.number().int().min(1).max(4),
});

/**
 * Mette un giocatore in rosa con il suo contratto.
 *
 * Passa dagli stessi controlli di qualunque firma: requisiti del tipo di
 * contratto (età per Rookie e Veteran, tetti di ingaggio, durate), spazio
 * salariale, posti in rosa, riserva per completare la rosa minima.
 */
export async function firmaInRosa(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = FirmaSchema.safeParse({
    teamId: formData.get("teamId"),
    playerId: formData.get("playerId"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    years: formData.get("years") ?? 1,
  });
  if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? "Dati non validi");
  const dati = parsed.data;

  const auth = await autorizza(dati.teamId);
  if (auth.errore) return auth.errore;
  const { session, contesto, team } = auth;
  const { ruleset, season, currentYear } = contesto;

  const player = await db.player.findUnique({
    where: { id: dati.playerId },
    include: { contracts: { where: { status: "ACTIVE" }, include: { team: { select: { name: true } } } } },
  });
  if (!player) return refuse("Giocatore inesistente.");
  if (player.contracts.length > 0) {
    return refuse(`${player.name} è già sotto contratto con ${player.contracts[0].team.name}.`);
  }

  const importo = roundToStep(fromMillions(dati.amount));

  const firma = validateContractSignature({
    type: dati.type as ContractType,
    salary: importo,
    years: dati.years,
    seasonStartYear: currentYear,
    playerAge: etàAllaStagione(player, currentYear, ruleset),
    ruleset,
  });
  if (firma.errors.length > 0) {
    return refuse(firma.errors[0].message, firma.errors);
  }

  const state = await getTeamState({ teamId: team.id, seasonId: season.id, currentYear, ruleset });

  // Gli slot pluriennali sono nove: un contratto che ne occupa uno quando sono
  // finiti non si può firmare (art. 3.3).
  if (ruleset.contracts[dati.type].occupiesSlot && state.freeSlots <= 0) {
    return refuse(
      `${team.name} ha esaurito i ${ruleset.roster.maxMultiYearContracts} slot pluriennali: questo contratto può essere solo Annuale.`,
    );
  }

  const capienza = canAfford({
    contracts: state.contracts,
    year: currentYear,
    amount: importo,
    ruleset,
    enforceReserve: true,
  });
  if (!capienza.ok) {
    return refuse(
      `${team.name} non può arrivare a ${formatMoney(importo)}: al massimo ${formatMoney(capienza.maxAffordable)}, ` +
        `perché ${formatMoney(capienza.reserve)} restano riservati per completare la rosa (art. 8.6).`,
    );
  }

  const schedule = buildSalarySchedule({
    type: dati.type as ContractType,
    baseSalary: importo,
    years: dati.years,
    startYear: currentYear,
    ruleset,
  });

  await db.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        teamId: team.id,
        playerId: player.id,
        seasonId: season.id,
        type: dati.type as ContractType,
        baseSalary: toDecimalString(importo),
        years: dati.years,
        startYear: currentYear,
        endYear: currentYear + dati.years - 1,
        salarySchedule: schedule.map((r) => ({ year: r.year, salary: r.salary, source: r.source })) as never,
      },
    });

    await tx.contractEvent.create({
      data: {
        contractId: contract.id,
        type: "SIGNED",
        effectiveYear: currentYear,
        amountAfter: toDecimalString(importo),
        note: `${dati.type} di ${dati.years} ${dati.years === 1 ? "anno" : "anni"}, composizione rosa`,
      },
    });

    // Se veniva da una riga in attesa, quella riga ha finito il suo compito.
    await tx.auctionEntry.deleteMany({ where: { playerId: player.id, seasonId: season.id } });

    await recordAudit(tx, {
      seasonId: season.id,
      teamId: team.id,
      userId: session.userId,
      action: "CONTRACT_SIGNED",
      summary:
        `${player.name} in rosa a ${team.name} per ${formatMoney(importo)} ` +
        `(${dati.type}${dati.years > 1 ? ` ${dati.years} anni` : ""})`,
      payload: { playerId: player.id, teamId: team.id, amount: toDecimalString(importo), type: dati.type, years: dati.years },
    });
  });

  revalidatePath("/rosa");
  revalidatePath("/listone");
  revalidatePath("/lega");
  revalidatePath(`/squadra/${team.id}`);
  return { ok: true, message: `${player.name} in rosa per ${formatMoney(importo)}.` };
}

/** Toglie dalla rosa un giocatore appena messo, senza penali: è una correzione. */
export async function togliDallaRosa(contractId: string): Promise<ActionResult> {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: { player: { select: { name: true } }, team: { select: { id: true, name: true } } },
  });
  if (!contract) return refuse("Contratto inesistente.");

  const auth = await autorizza(contract.team.id);
  if (auth.errore) return auth.errore;
  const { session, contesto } = auth;

  await db.$transaction(async (tx) => {
    await tx.contractEvent.deleteMany({ where: { contractId } });
    await tx.contract.delete({ where: { id: contractId } });
    await recordAudit(tx, {
      seasonId: contesto.season.id,
      teamId: contract.team.id,
      userId: session.userId,
      action: "ROSTER_CORRECTION",
      summary: `${contract.player.name} tolto dalla rosa di ${contract.team.name} in composizione`,
      payload: { contractId, playerName: contract.player.name },
    });
  });

  revalidatePath("/rosa");
  revalidatePath("/listone");
  revalidatePath("/lega");
  revalidatePath(`/squadra/${contract.team.id}`);
  return { ok: true, message: `${contract.player.name} torna svincolato.` };
}

/**
 * Svuota una rosa in composizione.
 *
 * Serve quando si è sbagliato foglio o squadra e rifare venticinque
 * cancellazioni sarebbe assurdo. Vale solo finché nessuno di quei contratti si
 * è mosso: appena c'è stato uno scambio o uno svincolo, la rosa non è più
 * «in composizione» ed è materia di regolamento, non di correzione.
 */
export async function svuotaRosa(teamId: string): Promise<ActionResult> {
  const auth = await autorizza(teamId);
  if (auth.errore) return auth.errore;
  const { session, contesto, team } = auth;

  const mossi = await db.contract.count({
    where: { teamId, seasonId: contesto.season.id, status: { not: "ACTIVE" } },
  });
  if (mossi > 0) {
    return refuse(
      `${team.name} ha già ${mossi} contratti non più attivi: la rosa non è più in composizione e va corretta operazione per operazione.`,
    );
  }

  const contratti = await db.contract.findMany({
    where: { teamId, seasonId: contesto.season.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (contratti.length === 0) return refuse("La rosa è già vuota.");

  await db.$transaction(async (tx) => {
    await tx.contractEvent.deleteMany({ where: { contractId: { in: contratti.map((c) => c.id) } } });
    await tx.contract.deleteMany({ where: { id: { in: contratti.map((c) => c.id) } } });
    await tx.auctionEntry.deleteMany({ where: { teamId, seasonId: contesto.season.id } });
    await recordAudit(tx, {
      seasonId: contesto.season.id,
      teamId,
      userId: session.userId,
      action: "ROSTER_CLEARED",
      summary: `Rosa di ${team.name} svuotata in composizione: ${contratti.length} contratti sciolti`,
      payload: { quanti: contratti.length },
    });
  });

  revalidatePath("/rosa");
  revalidatePath("/listone");
  revalidatePath("/lega");
  revalidatePath(`/squadra/${teamId}`);
  return { ok: true, message: `${contratti.length} contratti sciolti: i giocatori tornano nel listone.` };
}

/** Toglie una riga in attesa senza firmarla. */
export async function scartaVoce(entryId: string): Promise<ActionResult> {
  const voce = await db.auctionEntry.findUnique({
    where: { id: entryId },
    include: { player: { select: { name: true } } },
  });
  if (!voce) return refuse("Riga inesistente.");

  const auth = await autorizza(voce.teamId);
  if (auth.errore) return auth.errore;

  await db.auctionEntry.delete({ where: { id: entryId } });
  revalidatePath("/rosa");
  return { ok: true, message: `${voce.player.name} tolto dall'elenco.` };
}

// ─────────────────────────────────────────────── Import del foglio dell'asta

export interface ImportRosaState extends ActionResult {
  esito?: {
    righeLette: number;
    firmati: number;
    inAttesa: number;
    nonAbbinati: { name: string; reason: string; ambiguous?: string[] }[];
    respinti: { name: string; reason: string }[];
  };
}

const TIPO_DA_TESTO: Record<string, ContractType> = {
  annuale: "ANNUALE",
  a: "ANNUALE",
  standard: "STANDARD",
  s: "STANDARD",
  rookie: "ROOKIE",
  r: "ROOKIE",
  veteran: "VETERAN",
  v: "VETERAN",
  tampone: "TAMPONE",
  t: "TAMPONE",
};

/**
 * Carica una rosa intera da un foglio.
 *
 * Il foglio minimo ha una colonna sola: i nomi. Se porta anche costo e
 * contratto, i giocatori entrano in rosa già firmati; altrimenti restano in
 * attesa e si completano dall'applicazione, che è precisamente il modo in cui
 * si lavora dopo un'asta al tavolo.
 *
 * Le righe firmate passano una per una dai controlli veri. Una che non passa
 * non blocca le altre: viene riportata alla fine con il motivo, perché un
 * foglio di venticinque nomi con un errore a metà non deve costringere a
 * ricominciare.
 */
export async function importaRosa(_prev: ImportRosaState, formData: FormData): Promise<ImportRosaState> {
  const teamId = String(formData.get("teamId") ?? "");
  const auth = await autorizza(teamId);
  if (auth.errore) return auth.errore;
  const { session, contesto, team } = auth;
  const { season } = contesto;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return refuse("Scegli un file.");

  const foglio = await readUpload(file, { minColumns: 1 });
  if (foglio.rows.length === 0) return refuse("Il foglio non contiene righe leggibili.");

  const liberi = await db.player.findMany({
    where: { contracts: { none: { status: "ACTIVE" } } },
    select: { id: true, name: true, serieATeam: true, lfcId: true, birthDate: true, declaredAge: true, declaredAgeYear: true },
  });
  const candidati: Candidate[] = liberi.map((p) => ({
    id: p.id,
    name: p.name,
    normalizedName: p.name.toLowerCase(),
    serieATeam: p.serieATeam,
    lfcId: p.lfcId,
  }));
  const perId = new Map(liberi.map((p) => [p.id, p]));

  const nonAbbinati: { name: string; reason: string; ambiguous?: string[] }[] = [];
  const respinti: { name: string; reason: string }[] = [];
  let firmati = 0;
  let inAttesa = 0;

  // Lo stato si rilegge a ogni riga: venticinque firme di fila spostano il
  // tetto, e la ventiseiesima deve fare i conti con quello aggiornato.
  for (const row of foglio.rows) {
    const nome = pickColumn(row, "giocatore", "nome", "player", "name", "calciatore");
    if (!nome) continue;

    const abbinato = matchPlayer(
      {
        name: nome,
        serieATeam: pickColumn(row, "squadra serie a", "squadra", "club", "team"),
        lfcId: toNumber(pickColumn(row, "id", "lfcid")) ?? null,
      },
      candidati,
    );
    if (!abbinato.candidateId) {
      nonAbbinati.push({
        name: nome,
        reason: abbinato.ambiguous?.length ? "più giocatori possibili" : "nessun corrispondente fra gli svincolati",
        ambiguous: abbinato.ambiguous,
      });
      continue;
    }

    const player = perId.get(abbinato.candidateId);
    if (!player) continue;

    const costo = toNumber(pickColumn(row, "costo", "prezzo", "ingaggio", "cost", "amount"));
    const tipoTesto = (pickColumn(row, "contratto", "tipo", "type") ?? "").trim().toLowerCase();
    const tipo = TIPO_DA_TESTO[tipoTesto];
    const anni = toNumber(pickColumn(row, "anni", "durata", "years"));

    // Senza prezzo o senza tipo la riga non può diventare un contratto: sosta.
    if (costo === null || costo <= 0 || !tipo) {
      await db.auctionEntry.upsert({
        where: { playerId_seasonId: { playerId: player.id, seasonId: season.id } },
        create: {
          teamId: team.id,
          playerId: player.id,
          seasonId: season.id,
          amount: costo !== null && costo > 0 ? toDecimalString(roundToStep(fromMillions(costo))) : null,
          type: tipo ?? null,
          years: anni ?? null,
          source: "FOGLIO",
        },
        update: {
          teamId: team.id,
          amount: costo !== null && costo > 0 ? toDecimalString(roundToStep(fromMillions(costo))) : null,
          type: tipo ?? null,
          years: anni ?? null,
        },
      });
      inAttesa += 1;
      continue;
    }

    const durata = anni && anni >= 1 ? Math.trunc(anni) : tipo === "ANNUALE" || tipo === "TAMPONE" ? 1 : 2;
    const corpo = new FormData();
    corpo.set("teamId", team.id);
    corpo.set("playerId", player.id);
    corpo.set("amount", String(costo));
    corpo.set("type", tipo);
    corpo.set("years", String(durata));

    const esito = await firmaInRosa({ ok: true, message: "" }, corpo);
    if (esito.ok) {
      firmati += 1;
      // Chi è appena entrato in rosa non è più un candidato per le righe dopo.
      const i = candidati.findIndex((c) => c.id === player.id);
      if (i >= 0) candidati.splice(i, 1);
    } else {
      respinti.push({ name: player.name, reason: esito.message });
    }
  }

  await recordAudit(db, {
    seasonId: season.id,
    teamId: team.id,
    userId: session.userId,
    action: "IMPORT",
    summary:
      `Rosa di ${team.name} da foglio: ${firmati} firmati, ${inAttesa} in attesa di prezzo, ` +
      `${nonAbbinati.length} non abbinati, ${respinti.length} respinti`,
    payload: { file: file.name, righeLette: foglio.rows.length, firmati, inAttesa },
  });

  revalidatePath("/rosa");
  revalidatePath("/listone");
  revalidatePath("/lega");
  revalidatePath(`/squadra/${team.id}`);

  const parti = [`${firmati} in rosa`];
  if (inAttesa > 0) parti.push(`${inAttesa} in attesa di prezzo`);
  if (nonAbbinati.length > 0) parti.push(`${nonAbbinati.length} non riconosciuti`);
  if (respinti.length > 0) parti.push(`${respinti.length} respinti`);

  return {
    ok: respinti.length === 0 && nonAbbinati.length === 0,
    message: `${foglio.rows.length} righe lette: ${parti.join(", ")}.`,
    esito: { righeLette: foglio.rows.length, firmati, inAttesa, nonAbbinati, respinti },
  };
}

/** Quanto è già stato scritto sulle righe in attesa, per mostrarlo precompilato. */
export async function vociInAttesa(teamId: string) {
  const { season } = await getLeagueContext();
  const voci = await db.auctionEntry.findMany({
    where: { teamId, seasonId: season.id },
    include: { player: { select: { id: true, name: true, role: true, serieATeam: true } } },
    orderBy: { createdAt: "asc" },
  });
  return voci.map((v) => ({
    id: v.id,
    playerId: v.player.id,
    nome: v.player.name,
    ruolo: v.player.role,
    squadraSerieA: v.player.serieATeam,
    importo: v.amount ? fromDecimal(v.amount) : null,
    tipo: v.type,
    anni: v.years,
  }));
}
