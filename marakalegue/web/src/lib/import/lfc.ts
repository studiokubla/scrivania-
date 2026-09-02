import "server-only";

import { db } from "../db";
import { toDecimalString, fromMillions } from "../money";
import { matchPlayer, normalizeName, type Candidate } from "./match";
import { pickColumn, readUpload, toNumber } from "./parse";

/**
 * Import dei file ufficiali di Leghe Fantacalcio (art. 21.1).
 *
 * Leghe Fantacalcio non espone un'API pubblica: i dati arrivano dai file che
 * pubblica a ogni giornata e che il commissioner scarica e carica qui. È un
 * passaggio manuale, ma è l'unico che non dipende dal fatto che un sito terzo
 * non cambi pagina, e lascia una traccia di chi ha importato cosa e quando.
 *
 * Formati attesi:
 *  - Quotazioni: Id · R · RM · Nome · Squadra · Qt.A · Qt.I · FVM …
 *  - Voti giornata: Id · R · Nome · Squadra · Cv · Gf · Gs · Rp · Rs · Rf · Au · Amm · Esp · Ass
 *
 * Le intestazioni vengono normalizzate, quindi «Qt.A» diventa `qt_a` e piccoli
 * cambi di formattazione non rompono l'import.
 */

export interface ImportOutcome {
  rowsRead: number;
  rowsApplied: number;
  created: number;
  updated: number;
  unmatched: { name: string; reason: string; ambiguous?: string[] }[];
}

const RUOLI: Record<string, "P" | "D" | "C" | "A"> = {
  p: "P",
  por: "P",
  d: "D",
  dif: "D",
  c: "C",
  cen: "C",
  a: "A",
  att: "A",
};

function parseRole(value: string | undefined): "P" | "D" | "C" | "A" | null {
  if (!value) return null;
  return RUOLI[value.trim().toLowerCase()] ?? null;
}

async function loadCandidates(): Promise<Candidate[]> {
  return db.player.findMany({
    select: { id: true, name: true, normalizedName: true, serieATeam: true, lfcId: true },
  });
}

/**
 * Listone e quotazioni. È l'import che va fatto per primo: crea l'anagrafica
 * su cui tutto il resto si aggancia, e le quotazioni determinano le basi d'asta
 * (art. 8.4) e il requisito di quotazione dei primavera (art. 16.1).
 */
export async function importQuotations(file: File, seasonId: string): Promise<ImportOutcome> {
  const sheet = await readUpload(file, { expectedHeaders: ["nome", "id"], minColumns: 4 });
  const outcome: ImportOutcome = { rowsRead: sheet.rows.length, rowsApplied: 0, created: 0, updated: 0, unmatched: [] };

  const candidates = await loadCandidates();
  const byLfcId = new Map(candidates.filter((c) => c.lfcId != null).map((c) => [c.lfcId as number, c.id]));

  for (const row of sheet.rows) {
    const name = pickColumn(row, "nome", "giocatore", "calciatore");
    if (!name) continue;

    const lfcId = toNumber(pickColumn(row, "id", "id_giocatore"));
    const role = parseRole(pickColumn(row, "r", "ruolo"));
    const mantra = pickColumn(row, "rm", "ruolo_mantra");
    const team = pickColumn(row, "squadra", "team");
    const quotation = toNumber(pickColumn(row, "qt_a", "qt_a_m", "quotazione", "qta"));
    const initial = toNumber(pickColumn(row, "qt_i", "qt_i_m", "quotazione_iniziale", "qti"));

    if (!role) {
      outcome.unmatched.push({ name, reason: "Ruolo non riconosciuto" });
      continue;
    }

    // Il listone è la fonte dell'anagrafica: se un giocatore non c'è, si crea.
    let playerId = lfcId != null ? byLfcId.get(lfcId) : undefined;
    if (!playerId) {
      const match = matchPlayer({ name, lfcId, serieATeam: team ?? null }, candidates);
      playerId = match.candidateId ?? undefined;
    }

    if (playerId) {
      await db.player.update({
        where: { id: playerId },
        data: {
          name,
          normalizedName: normalizeName(name),
          role,
          mantraRoles: mantra ? mantra.split(";").map((r) => r.trim()).filter(Boolean) : undefined,
          serieATeam: team ?? undefined,
          lfcId: lfcId ?? undefined,
        },
      });
      outcome.updated += 1;
    } else {
      const created = await db.player.create({
        data: {
          lfcId: lfcId ?? undefined,
          name,
          normalizedName: normalizeName(name),
          role,
          mantraRoles: mantra ? mantra.split(";").map((r) => r.trim()).filter(Boolean) : [],
          serieATeam: team ?? undefined,
        },
      });
      playerId = created.id;
      candidates.push({
        id: created.id,
        name,
        normalizedName: normalizeName(name),
        serieATeam: team ?? null,
        lfcId: lfcId ?? null,
      });
      if (lfcId != null) byLfcId.set(lfcId, created.id);
      outcome.created += 1;
    }

    await db.playerSeason.upsert({
      where: { playerId_seasonId: { playerId, seasonId } },
      create: {
        playerId,
        seasonId,
        quotationCurrent: quotation != null ? toDecimalString(fromMillions(quotation)) : null,
        quotationInitial: initial != null ? toDecimalString(fromMillions(initial)) : null,
      },
      update: {
        quotationCurrent: quotation != null ? toDecimalString(fromMillions(quotation)) : undefined,
        quotationInitial: initial != null ? toDecimalString(fromMillions(initial)) : undefined,
      },
    });

    outcome.rowsApplied += 1;
  }

  return outcome;
}

/**
 * Voti di una giornata.
 *
 * Ricalcola presenze, media e giornate consecutive senza voto: sono i tre numeri
 * su cui si regge il performance buy-out (art. 12.4), e devono venire dai voti
 * memorizzati, non da un contatore che si potrebbe disallineare.
 */
export async function importMatchdayVotes(
  file: File,
  seasonId: string,
  matchday: number,
): Promise<ImportOutcome> {
  const sheet = await readUpload(file, { expectedHeaders: ["nome", "cv", "id"], minColumns: 4 });
  const outcome: ImportOutcome = { rowsRead: sheet.rows.length, rowsApplied: 0, created: 0, updated: 0, unmatched: [] };

  const candidates = await loadCandidates();
  const touched = new Set<string>();

  for (const row of sheet.rows) {
    const name = pickColumn(row, "nome", "giocatore", "calciatore");
    if (!name) continue;

    const lfcId = toNumber(pickColumn(row, "id", "id_giocatore"));
    const team = pickColumn(row, "squadra", "team");
    const match = matchPlayer({ name, lfcId, serieATeam: team ?? null }, candidates);

    if (!match.candidateId) {
      outcome.unmatched.push({
        name,
        reason: match.ambiguous ? "Più giocatori con lo stesso cognome" : "Nessun giocatore corrispondente",
        ambiguous: match.ambiguous,
      });
      continue;
    }

    const vote = toNumber(pickColumn(row, "cv", "voto", "v"));
    const goals = toNumber(pickColumn(row, "gf", "gol_fatti")) ?? 0;
    const conceded = toNumber(pickColumn(row, "gs", "gol_subiti")) ?? 0;
    const penaltySaved = toNumber(pickColumn(row, "rp", "rigori_parati")) ?? 0;
    const penaltyMissed = toNumber(pickColumn(row, "rs", "rigori_sbagliati")) ?? 0;
    const penaltyScored = toNumber(pickColumn(row, "rf", "rigori_fatti")) ?? 0;
    const ownGoals = toNumber(pickColumn(row, "au", "autogol")) ?? 0;
    const yellow = (toNumber(pickColumn(row, "amm", "ammonizioni")) ?? 0) > 0;
    const red = (toNumber(pickColumn(row, "esp", "espulsioni")) ?? 0) > 0;
    const assists = toNumber(pickColumn(row, "ass", "assist")) ?? 0;

    // Fantavoto secondo il regolamento classico: la fonte dà il voto puro,
    // i bonus si sommano qui una volta sola.
    const fantaVote =
      vote === null
        ? null
        : vote +
          goals * 3 +
          penaltyScored * 3 +
          assists -
          conceded -
          penaltyMissed * 3 +
          penaltySaved * 3 -
          ownGoals * 2 -
          (yellow ? 0.5 : 0) -
          (red ? 1 : 0);

    const playerSeason = await db.playerSeason.upsert({
      where: { playerId_seasonId: { playerId: match.candidateId, seasonId } },
      create: { playerId: match.candidateId, seasonId },
      update: {},
    });

    await db.matchdayVote.upsert({
      where: { playerSeasonId_matchday: { playerSeasonId: playerSeason.id, matchday } },
      create: {
        playerSeasonId: playerSeason.id,
        matchday,
        vote: vote !== null ? String(vote) : null,
        fantaVote: fantaVote !== null ? String(fantaVote) : null,
        goals: goals + penaltyScored,
        assists,
        yellowCard: yellow,
        redCard: red,
      },
      update: {
        vote: vote !== null ? String(vote) : null,
        fantaVote: fantaVote !== null ? String(fantaVote) : null,
        goals: goals + penaltyScored,
        assists,
        yellowCard: yellow,
        redCard: red,
      },
    });

    touched.add(playerSeason.id);
    outcome.rowsApplied += 1;
  }

  await recomputeAggregates([...touched]);
  return outcome;
}

/**
 * Ricalcola i totali di stagione dai voti memorizzati.
 *
 * Le giornate consecutive senza voto si contano all'indietro dall'ultima giornata
 * con dati: è la definizione dell'art. 12.4, che parla di un infortunio in corso,
 * non di una serie qualsiasi nel passato.
 */
async function recomputeAggregates(playerSeasonIds: string[]): Promise<void> {
  for (const id of playerSeasonIds) {
    const votes = await db.matchdayVote.findMany({
      where: { playerSeasonId: id },
      orderBy: { matchday: "asc" },
    });

    const withVote = votes.filter((v) => v.vote !== null);
    const voteSum = withVote.reduce((acc, v) => acc + Number(v.vote), 0);
    const fantaSum = votes.reduce((acc, v) => acc + (v.fantaVote !== null ? Number(v.fantaVote) : 0), 0);

    let consecutive = 0;
    for (let i = votes.length - 1; i >= 0; i -= 1) {
      if (votes[i].vote === null) consecutive += 1;
      else break;
    }

    await db.playerSeason.update({
      where: { id },
      data: {
        appearances: withVote.length,
        voteSum: String(voteSum),
        fantaVoteSum: String(fantaSum),
        goals: votes.reduce((a, v) => a + v.goals, 0),
        assists: votes.reduce((a, v) => a + v.assists, 0),
        consecutiveNoVote: consecutive,
      },
    });
  }
}
