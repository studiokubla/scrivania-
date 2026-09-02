/**
 * Svincolo, buy-out e performance buy-out (art. 12).
 *
 * Il performance buy-out è la regola che nelle stagioni precedenti generava più
 * discussioni, perché le condizioni ("scarso rendimento", "infortunio") erano
 * valutazioni. Qui sono tre condizioni misurate sui dati ufficiali, e la funzione
 * `checkPerformanceConditions` restituisce quale delle tre è soddisfatta e con
 * quali numeri: la spiegazione arriva insieme alla decisione.
 */

import { type Money, roundToStep } from "../money";
import type { Ruleset } from "../ruleset";
import { remainingSalary, salaryInYear, yearsRemaining } from "./contracts";
import { type ContractView, type ValidationResult, fail, issue, ok } from "./types";

export interface BuyoutQuote {
  /** Ingaggi residui, stagione corrente compresa */
  remainingSalary: Money;
  yearsRemaining: number;
  /** Moltiplicatore applicato (art. 12.2) */
  multiplier: number;
  /** Penale da pagare dal Capitale */
  penalty: Money;
  /** Quota che resta a carico del tetto salariale fino a fine stagione (art. 12.3) */
  deadCap: Money;
  deadCapYear: number;
  /** Spazio salariale liberato subito nella stagione corrente */
  capFreedNow: Money;
  isPerformance: boolean;
}

/**
 * Preventivo di svincolo. Non tocca nulla: serve a mostrare al manager il costo
 * *prima* che decida, perché il regolamento vuole che la scelta sia consapevole.
 */
export function quoteBuyout(input: {
  contract: ContractView;
  currentYear: number;
  isPerformance: boolean;
  ruleset: Ruleset;
}): BuyoutQuote {
  const { contract, currentYear, isPerformance, ruleset } = input;
  const b = ruleset.buyout;

  const residual = remainingSalary(contract.schedule, currentYear);
  const years = yearsRemaining(contract.schedule, currentYear);
  const key = String(Math.min(Math.max(years, 1), 4));
  const multiplier = b.penaltyByYearsRemaining[key] ?? 1;

  const gross = roundToStep(Math.round(residual * multiplier));
  const penalty = isPerformance ? roundToStep(Math.round(gross * b.performanceRate)) : gross;

  const currentSalary = salaryInYear(contract.schedule, currentYear);
  const deadCap = isPerformance ? 0 : roundToStep(Math.round(currentSalary * b.deadCapRate));

  return {
    remainingSalary: residual,
    yearsRemaining: years,
    multiplier,
    penalty,
    deadCap,
    deadCapYear: currentYear,
    capFreedNow: currentSalary - deadCap,
    isPerformance,
  };
}

export interface PerformanceInput {
  /** Giornate di campionato disputate finora */
  matchdaysPlayed: number;
  /** Giornate in cui il giocatore ha ricevuto voto */
  appearances: number;
  /** Somma dei voti puri sulle presenze */
  voteSum: number;
  /** Giornate consecutive senza voto in corso */
  consecutiveNoVote: number;
}

export interface PerformanceCheck {
  eligible: boolean;
  /** Le condizioni soddisfatte, con i numeri che le dimostrano */
  reasons: { code: string; label: string; detail: string }[];
  /** Le condizioni non soddisfatte, per spiegare un diniego */
  missing: { code: string; label: string; detail: string }[];
}

/**
 * Verifica le tre condizioni dell'art. 12.4. Ne basta una.
 */
export function checkPerformanceConditions(input: {
  stats: PerformanceInput;
  ruleset: Ruleset;
}): PerformanceCheck {
  const { stats, ruleset } = input;
  const cond = ruleset.buyout.performanceConditions;
  const reasons: PerformanceCheck["reasons"] = [];
  const missing: PerformanceCheck["missing"] = [];

  // 1. Poche presenze
  const rate = stats.matchdaysPlayed > 0 ? stats.appearances / stats.matchdaysPlayed : 0;
  const ratePct = Math.round(rate * 100);
  const entryLowUse = {
    code: "LOW_APPEARANCES",
    label: "Presenze insufficienti",
    detail: `${stats.appearances} presenze su ${stats.matchdaysPlayed} giornate (${ratePct}%), soglia ${Math.round(cond.minAppearanceRate * 100)}%.`,
  };
  if (stats.matchdaysPlayed > 0 && rate < cond.minAppearanceRate) reasons.push(entryLowUse);
  else missing.push(entryLowUse);

  // 2. Media voto sotto la sufficienza
  const average = stats.appearances > 0 ? stats.voteSum / stats.appearances : 0;
  const entryLowVote = {
    code: "LOW_AVERAGE",
    label: "Media voto sotto la sufficienza",
    detail: `Media ${average.toFixed(2)} su ${stats.appearances} presenze, soglia ${cond.lowAverageVote} con almeno ${cond.lowAverageMinAppearances} presenze.`,
  };
  if (stats.appearances >= cond.lowAverageMinAppearances && average < cond.lowAverageVote) {
    reasons.push(entryLowVote);
  } else missing.push(entryLowVote);

  // 3. Infortunio prolungato
  const entryInjury = {
    code: "INJURY",
    label: "Infortunio prolungato",
    detail: `${stats.consecutiveNoVote} giornate consecutive senza voto, soglia ${cond.consecutiveNoVote}.`,
  };
  if (stats.consecutiveNoVote >= cond.consecutiveNoVote) reasons.push(entryInjury);
  else missing.push(entryInjury);

  return { eligible: reasons.length > 0, reasons, missing };
}

/** Validazione dell'operazione di svincolo. */
export function validateBuyout(input: {
  quote: BuyoutQuote;
  capitalBalance: Money;
  performanceBuyoutsUsed: number;
  windowOpen: boolean;
  performanceCheck?: PerformanceCheck;
  ruleset: Ruleset;
}): ValidationResult {
  const { quote, capitalBalance, performanceBuyoutsUsed, windowOpen, performanceCheck, ruleset } = input;
  const errors = [];
  const warnings = [];

  if (!windowOpen) {
    errors.push(issue("WINDOW_CLOSED", "art. 12.1", "Lo svincolo si può fare solo a finestra di mercato aperta."));
  }

  if (capitalBalance < quote.penalty) {
    errors.push(
      issue(
        "INSUFFICIENT_CAPITAL",
        "art. 12.1",
        `La penale è di ${(quote.penalty / 100).toLocaleString("it-IT")} M ma il Capitale disponibile è ${(capitalBalance / 100).toLocaleString("it-IT")} M.`,
      ),
    );
  }

  if (quote.isPerformance) {
    if (performanceBuyoutsUsed >= ruleset.options.performanceBuyout.perSeason) {
      errors.push(
        issue(
          "PERFORMANCE_EXHAUSTED",
          "art. 12.4",
          `Hai già usato ${ruleset.options.performanceBuyout.perSeason} performance buy-out in questa stagione.`,
        ),
      );
    }
    if (!performanceCheck?.eligible) {
      errors.push(
        issue(
          "PERFORMANCE_NOT_ELIGIBLE",
          "art. 12.4",
          "Il giocatore non soddisfa nessuna delle tre condizioni: " +
            (performanceCheck?.missing.map((m) => m.detail).join(" ") ?? "dati di stagione non disponibili."),
        ),
      );
    }
  } else if (quote.deadCap > 0) {
    warnings.push(
      issue(
        "DEAD_CAP",
        "art. 12.3",
        `Restano ${(quote.deadCap / 100).toLocaleString("it-IT")} M di dead cap a carico del tetto fino a fine stagione.`,
      ),
    );
  }

  return errors.length ? fail(errors, warnings) : ok(warnings);
}
