/**
 * Trade (art. 11.1).
 *
 * La regola che conta è la validazione a due lati: uno scambio si può proporre solo
 * se **entrambe** le squadre restano in regola dopo l'esecuzione. Nelle stagioni
 * precedenti questo controllo si faceva a occhio, e infatti le premesse del
 * regolamento parlano di «scambi poco chiari».
 */

import { type Money, sum } from "../money";
import type { Ruleset } from "../ruleset";
import { validateRoster } from "./cap";
import { type ContractView, type ValidationResult, issue, mergeResults } from "./types";

export interface TradeSide {
  teamId: string;
  teamName: string;
  /** Rosa attuale della squadra */
  contracts: ContractView[];
  /** Capitale disponibile */
  capital: Money;
  /** Contratti che questa squadra cede */
  contractsOut: ContractView[];
  /** Scelte al draft cedute, come identificativi */
  picksOut: string[];
  /** Capitale ceduto */
  capitalOut: Money;
}

export interface TradeValidation extends ValidationResult {
  /** Effetto dello scambio su ciascuna squadra, da mostrare prima di accettare */
  effects: {
    teamId: string;
    teamName: string;
    salaryIn: Money;
    salaryOut: Money;
    salaryDelta: Money;
    playersBefore: number;
    playersAfter: number;
    capitalDelta: Money;
    capitalAfter: Money;
  }[];
}

/**
 * Valida uno scambio e ne descrive gli effetti.
 *
 * `year` è la stagione su cui si misura il tetto: durante il campionato è quella
 * corrente, ma i contratti pluriennali che cambiano casacca vanno verificati anche
 * sulle stagioni successive, ed è quello che fa il ciclo su `horizonYears`.
 */
export function validateTrade(input: {
  sideA: TradeSide;
  sideB: TradeSide;
  year: number;
  horizonYears?: number;
  ruleset: Ruleset;
}): TradeValidation {
  const { sideA, sideB, year, ruleset } = input;
  const horizon = input.horizonYears ?? 3;

  const results: ValidationResult[] = [];
  const effects: TradeValidation["effects"] = [];

  for (const [self, other] of [
    [sideA, sideB],
    [sideB, sideA],
  ] as const) {
    const outIds = new Set(self.contractsOut.map((c) => c.id));
    const after: ContractView[] = [
      ...self.contracts.filter((c) => !outIds.has(c.id)),
      // Il contratto viaggia intatto: nessuna ristrutturazione (art. 5.3)
      ...other.contractsOut.map((c) => ({ ...c })),
    ];

    const salaryIn = sum(other.contractsOut.map((c) => c.schedule.find((r) => r.year === year)?.salary ?? 0));
    const salaryOut = sum(self.contractsOut.map((c) => c.schedule.find((r) => r.year === year)?.salary ?? 0));
    const capitalDelta = other.capitalOut - self.capitalOut;

    // Il tetto va rispettato in ogni stagione toccata dai contratti scambiati,
    // non solo in quella in corso.
    for (let i = 0; i < horizon; i += 1) {
      const checkYear = year + i;
      const touched = [...self.contractsOut, ...other.contractsOut].some((c) =>
        c.schedule.some((r) => r.year === checkYear),
      );
      if (i > 0 && !touched) continue;

      const result = validateRoster({
        contracts: after,
        year: checkYear,
        ruleset,
        // A metà stagione la rosa minima è già formata, quindi i minimi valgono;
        // sulle stagioni future no, perché i contratti in scadenza le svuotano.
        strict: i === 0,
      });

      results.push({
        ...result,
        errors: result.errors.map((e) => ({
          ...e,
          message: `${self.teamName} — ${e.message}`,
        })),
        warnings: result.warnings.map((w) => ({
          ...w,
          message: `${self.teamName} — ${w.message}`,
        })),
      });
    }

    if (self.capitalOut > self.capital) {
      results.push({
        ok: false,
        errors: [
          issue(
            "TRADE_CAPITAL",
            "art. 11.1.1",
            `${self.teamName} non ha abbastanza Capitale: cede ${(self.capitalOut / 100).toLocaleString("it-IT")} M e ne ha ${(self.capital / 100).toLocaleString("it-IT")} M.`,
          ),
        ],
        warnings: [],
      });
    }

    effects.push({
      teamId: self.teamId,
      teamName: self.teamName,
      salaryIn,
      salaryOut,
      salaryDelta: salaryIn - salaryOut,
      playersBefore: self.contracts.filter((c) => c.status === "ACTIVE").length,
      playersAfter: after.filter((c) => c.status === "ACTIVE").length,
      capitalDelta,
      capitalAfter: self.capital + capitalDelta,
    });
  }

  const emptyA = sideA.contractsOut.length === 0 && sideA.picksOut.length === 0 && sideA.capitalOut === 0;
  const emptyB = sideB.contractsOut.length === 0 && sideB.picksOut.length === 0 && sideB.capitalOut === 0;
  if (emptyA && emptyB) {
    results.push({
      ok: false,
      errors: [issue("TRADE_EMPTY", "art. 11.1", "Uno scambio deve muovere almeno un oggetto.")],
      warnings: [],
    });
  }

  // Uno scambio in cui una parte non riceve nulla non è vietato, ma va guardato:
  // è la forma tipica dello scambio di comodo che l'art. 11.1.3 permette di annullare.
  if (emptyA !== emptyB) {
    results.push({
      ok: true,
      errors: [],
      warnings: [
        issue(
          "TRADE_ONE_SIDED",
          "art. 11.1.3",
          "Una delle due squadre non riceve nulla: il commissioner può annullare lo scambio entro 24 ore se lo ritiene di comodo.",
        ),
      ],
    });
  }

  const merged = mergeResults(...results);
  return { ...merged, effects };
}
