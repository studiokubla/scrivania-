import { fromMillions, type Money } from "../money";
import type { Ruleset } from "../ruleset";

/**
 * Chi può stare nel settore giovanile (art. 16.1).
 *
 * Tre requisiti: **massimo vent'anni** alla data di riferimento, **non più di
 * cinque presenze** in Serie A, **quotazione non superiore a sette milioni**.
 *
 * Il problema è che la lega possiede i tre dati in momenti diversi. La
 * quotazione arriva col listone, il primo giorno. L'età pure, adesso che il
 * listone la stampa. Le presenze della stagione precedente invece la lega non
 * le ha finché non ha vissuto una stagione intera: alla prima non esistono, e
 * nessuna fonte gliele può dare a posteriori.
 *
 * Perciò la risposta non è sì o no: è **sì**, **no**, oppure **non lo so
 * ancora**. Dire "non idoneo" a un ragazzo di diciotto anni solo perché manca
 * la sua data di nascita sarebbe una bugia comoda; dire "idoneo" sarebbe una
 * bugia pericolosa, perché il tesseramento poi verrebbe rifiutato. Il terzo
 * stato è l'unica risposta onesta, e dice anche cosa manca per scioglierlo.
 */

export type StatoPrimavera = "IDONEO" | "DA_VERIFICARE" | "NON_IDONEO";

export interface EsitoPrimavera {
  stato: StatoPrimavera;
  /** Perché non è idoneo, o cosa manca per saperlo. Vuoto se idoneo. */
  motivi: string[];
  /** Il dettaglio dei tre requisiti, per mostrarli uno per uno. */
  requisiti: {
    età: { valore: number | null; rispettato: boolean | null };
    presenze: { valore: number | null; rispettato: boolean | null };
    quotazione: { valore: Money | null; rispettato: boolean | null };
  };
}

export interface GiocatorePerPrimavera {
  /** Età alla data di riferimento, da `etàAllaStagione`. `null` se ignota. */
  età?: number | null;
  /** Presenze con voto nella stagione precedente. `null` se la lega non le ha. */
  appearances?: number | null;
  /** Quotazione corrente, in centesimi di milione. `null` se non quotato. */
  quotation?: Money | null;
}

export function youthEligibility(
  giocatore: GiocatorePerPrimavera,
  seasonStartYear: number,
  ruleset: Ruleset,
): EsitoPrimavera {
  void seasonStartYear;
  const limiteQuotazione = fromMillions(ruleset.youth.maxQuotation);

  const età = giocatore.età ?? null;
  const presenze = giocatore.appearances ?? null;
  const quotazione = giocatore.quotation ?? null;

  const requisiti = {
    età: { valore: età, rispettato: età === null ? null : età <= ruleset.youth.maxAge },
    presenze: {
      valore: presenze,
      rispettato: presenze === null ? null : presenze <= ruleset.youth.maxPreviousAppearances,
    },
    quotazione: {
      valore: quotazione,
      rispettato: quotazione === null ? null : quotazione <= limiteQuotazione,
    },
  };

  // Un requisito violato chiude il discorso: non serve sapere gli altri.
  const motivi: string[] = [];
  if (requisiti.età.rispettato === false) {
    motivi.push(`ha ${età} anni, il limite è ${ruleset.youth.maxAge}`);
  }
  if (requisiti.presenze.rispettato === false) {
    motivi.push(`${presenze} presenze in Serie A, il limite è ${ruleset.youth.maxPreviousAppearances}`);
  }
  if (requisiti.quotazione.rispettato === false) {
    motivi.push(`quotato oltre ${ruleset.youth.maxQuotation} M`);
  }
  if (motivi.length > 0) return { stato: "NON_IDONEO", motivi, requisiti };

  // Nessuna violazione, ma qualcosa non si sa ancora.
  const mancanti: string[] = [];
  if (requisiti.età.rispettato === null) mancanti.push("manca l'età");
  if (requisiti.presenze.rispettato === null) mancanti.push("mancano le presenze della stagione precedente");
  if (requisiti.quotazione.rispettato === null) mancanti.push("manca la quotazione");
  if (mancanti.length > 0) return { stato: "DA_VERIFICARE", motivi: mancanti, requisiti };

  return { stato: "IDONEO", motivi: [], requisiti };
}

/**
 * Le presenze note alla lega, ricavate dai voti importati.
 *
 * Il listone non le porta e Transfermarkt nemmeno in modo affidabile: finché
 * non si importa una giornata, per la lega nessuno ha presenze. Zero importi
 * significa `null`, non zero — sono due cose diverse, e confonderle
 * dichiarerebbe idoneo mezzo campionato.
 */
export function presenzeNote(righeVoto: number, presenze: number | null | undefined): number | null {
  if (righeVoto === 0) return null;
  return presenze ?? 0;
}

/**
 * Cosa manca, detto per esteso.
 *
 * Serve all'interfaccia: «da verificare» senza il perché è una risposta che
 * non aiuta nessuno, e il perché cambia — alla prima stagione mancano le
 * presenze e non ci si può fare niente, più avanti mancherà semmai l'età di
 * qualche nuovo arrivato.
 */
export function motivoPiùFrequente(esiti: EsitoPrimavera[]): string | null {
  const conteggio = new Map<string, number>();
  for (const e of esiti) {
    if (e.stato !== "DA_VERIFICARE") continue;
    for (const m of e.motivi) conteggio.set(m, (conteggio.get(m) ?? 0) + 1);
  }
  const ordinati = [...conteggio.entries()].sort((a, b) => b[1] - a[1]);
  return ordinati[0]?.[0] ?? null;
}
