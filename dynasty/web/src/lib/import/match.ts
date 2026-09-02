/**
 * Riconciliazione dei nomi dei calciatori tra fonti diverse.
 *
 * Leghe Fantacalcio scrive «Martinez L.», Transfermarkt «Lautaro Martínez»: senza
 * un identificativo comune bisogna confrontare i nomi, e i nomi non coincidono mai.
 * La strategia, in ordine:
 *
 *  1. `lfcId` — l'identificativo di Leghe Fantacalcio, quando c'è: è esatto
 *  2. nome normalizzato identico
 *  3. cognome identico più squadra di Serie A identica
 *  4. cognome identico e nessun altro candidato con quel cognome
 *
 * Quello che non si riconcilia **non si indovina**: finisce nell'elenco delle righe
 * da risolvere a mano. Un abbinamento sbagliato manderebbe voti e valori sul
 * giocatore di un'altra squadra, ed è un errore che nessuno noterebbe subito.
 */

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** «Martinez L.» → "martinez"; «Lautaro Martínez» → "martinez" */
export function surnameOf(name: string): string {
  const normalized = normalizeName(name);
  const parts = normalized.split(" ").filter((p) => p.length > 1);
  if (parts.length === 0) return normalized;

  // Nel formato Leghe Fantacalcio il cognome viene prima e l'iniziale dopo
  const trailingInitial = /\s[a-z]\.?$/.test(normalizeName(name));
  return trailingInitial ? parts[0] : parts[parts.length - 1];
}

export interface Candidate {
  id: string;
  name: string;
  normalizedName: string;
  serieATeam: string | null;
  lfcId: number | null;
}

export interface MatchResult {
  candidateId: string | null;
  confidence: "EXACT_ID" | "EXACT_NAME" | "SURNAME_AND_TEAM" | "UNIQUE_SURNAME" | "NONE";
  /** Alternative trovate quando l'abbinamento è ambiguo */
  ambiguous?: string[];
}

export function matchPlayer(
  input: { name: string; lfcId?: number | null; serieATeam?: string | null },
  candidates: Candidate[],
): MatchResult {
  if (input.lfcId != null) {
    const byId = candidates.find((c) => c.lfcId === input.lfcId);
    if (byId) return { candidateId: byId.id, confidence: "EXACT_ID" };
  }

  const normalized = normalizeName(input.name);
  const exact = candidates.filter((c) => c.normalizedName === normalized);
  if (exact.length === 1) return { candidateId: exact[0].id, confidence: "EXACT_NAME" };

  const surname = surnameOf(input.name);
  const bySurname = candidates.filter((c) => surnameOf(c.name) === surname);

  if (bySurname.length === 1) return { candidateId: bySurname[0].id, confidence: "UNIQUE_SURNAME" };

  if (bySurname.length > 1 && input.serieATeam) {
    const team = normalizeName(input.serieATeam);
    const withTeam = bySurname.filter((c) => c.serieATeam && normalizeName(c.serieATeam) === team);
    if (withTeam.length === 1) return { candidateId: withTeam[0].id, confidence: "SURNAME_AND_TEAM" };
  }

  return {
    candidateId: null,
    confidence: "NONE",
    ambiguous: bySurname.length > 1 ? bySurname.map((c) => c.name) : undefined,
  };
}
