import "server-only";

import { db } from "../db";
import { matchPlayer, type Candidate } from "./match";
import { pickColumn, readUpload, toNumber } from "./parse";
import type { ImportOutcome } from "./lfc";

/**
 * Import dei dati Transfermarkt (art. 21.2).
 *
 * **Transfermarkt non ha un'API pubblica** e non consente l'estrazione automatica
 * delle sue pagine. Quindi qui non si va a leggere il sito: si carica un foglio
 * che il commissioner compila o esporta, con una riga per giocatore. Sono dati
 * che cambiano poche volte l'anno — data di nascita mai — quindi un import a
 * stagione, più un ritocco quando arriva qualcuno dal mercato reale, basta.
 *
 * Colonne riconosciute (i nomi sono flessibili):
 *   nome · data_nascita · nazionalita · club_provenienza · campionato_provenienza · valore
 *
 * Cosa fanno questi dati:
 *  - **data di nascita**: decide chi può firmare Rookie e Veteran (art. 4) e chi
 *    è idoneo alla primavera (art. 16.1). Senza, quei contratti non si firmano.
 *  - **club e campionato di provenienza**: alimentano il diritto di pareggio
 *    degli osservatori (art. 17.2).
 *  - **valore di mercato**: nessun effetto regolamentare, solo riferimento.
 */

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();

  // gg/mm/aaaa e gg-mm-aaaa
  const italian = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (italian) {
    const [, d, m, y] = italian;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  // aaaa-mm-gg
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** «12,50 mln €», «12.5m», «12500000» → 12500000 */
function parseMarketValue(value: string | undefined): bigint | null {
  if (!value) return null;
  const lower = value.toLowerCase().replace(/[€$\s]/g, "");
  const multiplier = /mln|mio|m\b|milion/.test(lower) ? 1_000_000 : /k|mila/.test(lower) ? 1_000 : 1;
  const numeric = toNumber(lower.replace(/[^0-9.,]/g, ""));
  if (numeric === null) return null;
  return BigInt(Math.round(numeric * multiplier));
}

export async function importTransfermarkt(file: File): Promise<ImportOutcome> {
  const sheet = await readUpload(file, { expectedHeaders: ["nome", "name"], minColumns: 2 });
  const outcome: ImportOutcome = { rowsRead: sheet.rows.length, rowsApplied: 0, created: 0, updated: 0, unmatched: [] };

  const candidates: Candidate[] = await db.player.findMany({
    select: { id: true, name: true, normalizedName: true, serieATeam: true, lfcId: true },
  });

  for (const row of sheet.rows) {
    const name = pickColumn(row, "nome", "name", "giocatore", "calciatore");
    if (!name) continue;

    const serieATeam = pickColumn(row, "squadra", "squadra_serie_a", "club_attuale", "team");
    const match = matchPlayer({ name, serieATeam: serieATeam ?? null }, candidates);

    if (!match.candidateId) {
      outcome.unmatched.push({
        name,
        reason: match.ambiguous
          ? "Più giocatori con lo stesso cognome: specifica la squadra di Serie A"
          : "Nessun giocatore corrispondente nel listone. Importa prima le quotazioni.",
        ambiguous: match.ambiguous,
      });
      continue;
    }

    const birthDate = parseDate(
      pickColumn(row, "data_nascita", "data_di_nascita", "nascita", "birth_date", "date_of_birth"),
    );
    const nationality = pickColumn(row, "nazionalita", "nazione", "nationality");
    const originClub = pickColumn(row, "club_provenienza", "club_di_provenienza", "provenienza", "origin_club");
    const originLeague = pickColumn(
      row,
      "campionato_provenienza",
      "campionato_di_provenienza",
      "campionato",
      "origin_league",
    );
    const marketValue = parseMarketValue(pickColumn(row, "valore", "valore_di_mercato", "market_value", "valore_mercato"));
    const tmId = toNumber(pickColumn(row, "tm_id", "id_transfermarkt"));

    await db.player.update({
      where: { id: match.candidateId },
      data: {
        birthDate: birthDate ?? undefined,
        nationality: nationality ?? undefined,
        originClub: originClub ?? undefined,
        originLeague: originLeague ?? undefined,
        tmId: tmId ?? undefined,
        tmMarketValue: marketValue ?? undefined,
        tmMarketValueAt: marketValue !== null ? new Date() : undefined,
      },
    });

    outcome.updated += 1;
    outcome.rowsApplied += 1;
  }

  return outcome;
}

/** Modello del foglio, da dare a chi deve compilarlo. */
export const TRANSFERMARKT_TEMPLATE = [
  "nome;squadra;data_nascita;nazionalita;club_provenienza;campionato_provenienza;valore",
  "Rossi M.;Inter;12/04/2001;Italia;;;8,50 mln €",
  "Silva J.;Napoli;03/09/1996;Brasile;Palmeiras;Brasileirão;22 mln €",
].join("\n");
