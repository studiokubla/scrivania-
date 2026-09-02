/**
 * Tetto salariale e composizione della rosa (art. 3).
 *
 * La funzione centrale è `buildCapMatrix`: la proiezione degli ingaggi su più stagioni.
 * È la vista che nei fogli Excel della lega occupava cinque colonne compilate a mano,
 * ed è il motivo principale per cui questo software esiste.
 */

import { fromMillions, type Money, sum } from "../money";
import type { Ruleset } from "../ruleset";
import { salaryInYear } from "./contracts";
import {
  type ContractView,
  type PlayerRole,
  type ValidationResult,
  fail,
  issue,
  ok,
} from "./types";

export interface CapYear {
  year: number;
  label: string;
  /** Somma degli ingaggi dei contratti attivi in quella stagione */
  committed: Money;
  /** Quote di dead cap imputate a quella stagione (art. 12.3) */
  deadCap: Money;
  total: Money;
  cap: Money;
  /** Spazio libero; negativo significa fuori tetto */
  space: Money;
  /** Giocatori sotto contratto in quella stagione */
  playerCount: number;
  /** Contratti pluriennali attivi in quella stagione */
  multiYearCount: number;
  /** Quanti giocatori mancano per arrivare alla rosa minima */
  missingToMinimum: number;
  overCap: boolean;
}

export type CapMatrix = CapYear[];

function seasonLabel(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

/**
 * Proiezione del tetto salariale dalla stagione corrente in avanti.
 *
 * `horizon` è il numero di stagioni da mostrare: 5 riproduce esattamente la tabella
 * del foglio `Gestione squadra` (2024/25 → 2028/29).
 */
export function buildCapMatrix(input: {
  contracts: ContractView[];
  currentYear: number;
  horizon?: number;
  ruleset: Ruleset;
}): CapMatrix {
  const { contracts, currentYear, ruleset } = input;
  const horizon = input.horizon ?? 5;
  const cap = fromMillions(ruleset.roster.salaryCap);
  const active = contracts.filter((c) => c.status === "ACTIVE");

  const matrix: CapMatrix = [];
  for (let i = 0; i < horizon; i += 1) {
    const year = currentYear + i;
    const covering = active.filter((c) => c.schedule.some((row) => row.year === year));
    const committed = sum(covering.map((c) => salaryInYear(c.schedule, year)));

    // Il dead cap segue il contratto anche dopo la sua chiusura, quindi si guarda
    // a tutti i contratti, non solo agli attivi.
    const deadCap = sum(
      contracts
        .filter((c) => c.deadCapAmount && c.deadCapYear === year)
        .map((c) => c.deadCapAmount as Money),
    );

    const total = committed + deadCap;
    const playerCount = covering.length;

    matrix.push({
      year,
      label: seasonLabel(year),
      committed,
      deadCap,
      total,
      cap,
      space: cap - total,
      playerCount,
      multiYearCount: covering.filter((c) => ruleset.contracts[c.type].occupiesSlot).length,
      missingToMinimum: Math.max(0, ruleset.roster.minPlayers - playerCount),
      overCap: total > cap,
    });
  }
  return matrix;
}

export interface RosterSnapshot {
  contracts: ContractView[];
  currentYear: number;
}

export function countByRole(contracts: ContractView[]): Record<PlayerRole, number> {
  const counts: Record<PlayerRole, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const c of contracts) counts[c.role] += 1;
  return counts;
}

export function activeInYear(contracts: ContractView[], year: number): ContractView[] {
  return contracts.filter((c) => c.status === "ACTIVE" && c.schedule.some((row) => row.year === year));
}

export function usedMultiYearSlots(contracts: ContractView[], year: number, ruleset: Ruleset): number {
  return activeInYear(contracts, year).filter((c) => ruleset.contracts[c.type].occupiesSlot).length;
}

export function freeMultiYearSlots(contracts: ContractView[], year: number, ruleset: Ruleset): number {
  return Math.max(0, ruleset.roster.maxMultiYearContracts - usedMultiYearSlots(contracts, year, ruleset));
}

/**
 * Validazione completa della rosa in una stagione (art. 3).
 *
 * `strict` distingue i due momenti: durante l'asta la rosa è per forza incompleta,
 * quindi i minimi diventano avvisi; a mercato chiuso sono errori.
 */
export function validateRoster(input: {
  contracts: ContractView[];
  year: number;
  ruleset: Ruleset;
  strict?: boolean;
}): ValidationResult {
  const { contracts, year, ruleset } = input;
  const strict = input.strict ?? true;
  const errors = [];
  const warnings = [];

  const active = activeInYear(contracts, year);
  const total =
    sum(active.map((c) => salaryInYear(c.schedule, year))) +
    sum(contracts.filter((c) => c.deadCapYear === year).map((c) => c.deadCapAmount ?? 0));
  const cap = fromMillions(ruleset.roster.salaryCap);

  if (total > cap) {
    errors.push(
      issue(
        "OVER_CAP",
        "art. 3.2",
        `Il monte ingaggi ${year}/${String((year + 1) % 100).padStart(2, "0")} supera il tetto di ${((total - cap) / 100).toLocaleString("it-IT")} M.`,
      ),
    );
  }

  if (active.length > ruleset.roster.maxPlayers) {
    errors.push(
      issue("ROSTER_TOO_BIG", "art. 3.1", `La rosa non può superare ${ruleset.roster.maxPlayers} giocatori.`),
    );
  }

  const belowMinimum = active.length < ruleset.roster.minPlayers;
  if (belowMinimum) {
    const target = strict ? errors : warnings;
    target.push(
      issue(
        "ROSTER_TOO_SMALL",
        "art. 3.1",
        `Servono almeno ${ruleset.roster.minPlayers} giocatori: ne mancano ${ruleset.roster.minPlayers - active.length}.`,
      ),
    );
  }

  const counts = countByRole(active);
  for (const role of ["P", "D", "C", "A"] as PlayerRole[]) {
    const required = ruleset.roster.minByRole[role];
    if (counts[role] < required) {
      const target = strict ? errors : warnings;
      target.push(
        issue(
          `ROLE_MIN_${role}`,
          "art. 3.1",
          `Servono almeno ${required} giocatori di ruolo ${role}: ne hai ${counts[role]}.`,
        ),
      );
    }
  }

  const multiYear = usedMultiYearSlots(contracts, year, ruleset);
  if (multiYear > ruleset.roster.maxMultiYearContracts) {
    errors.push(
      issue(
        "TOO_MANY_MULTIYEAR",
        "art. 3.3",
        `Puoi avere al massimo ${ruleset.roster.maxMultiYearContracts} contratti pluriennali: ne hai ${multiYear}.`,
      ),
    );
  }

  return errors.length ? fail(errors, warnings) : ok(warnings);
}

/**
 * Può la squadra permettersi questo ingaggio in questa stagione?
 *
 * Non basta che l'importo stia sotto il tetto: bisogna che resti spazio per completare
 * la rosa minima (art. 8.6). È la regola che impedisce di spendere tutto sui primi nomi
 * dell'asta e ritrovarsi con venti giocatori e zero milioni.
 */
export function canAfford(input: {
  contracts: ContractView[];
  year: number;
  amount: Money;
  ruleset: Ruleset;
  /** Se true applica la riserva per la rosa minima; in asta serve sempre */
  enforceReserve?: boolean;
}): { ok: boolean; maxAffordable: Money; reserve: Money; space: Money } {
  const { contracts, year, amount, ruleset } = input;
  const enforceReserve = input.enforceReserve ?? true;

  const active = activeInYear(contracts, year);
  const committed =
    sum(active.map((c) => salaryInYear(c.schedule, year))) +
    sum(contracts.filter((c) => c.deadCapYear === year).map((c) => c.deadCapAmount ?? 0));
  const cap = fromMillions(ruleset.roster.salaryCap);
  const space = cap - committed;

  // Slot ancora da riempire dopo aver aggiunto questo giocatore
  const slotsAfter = Math.max(0, ruleset.roster.minPlayers - (active.length + 1));
  const reserve = enforceReserve ? slotsAfter * fromMillions(ruleset.auction.reservePerMissingSlot) : 0;
  const maxAffordable = Math.max(0, space - reserve);

  return { ok: amount <= maxAffordable, maxAffordable, reserve, space };
}
