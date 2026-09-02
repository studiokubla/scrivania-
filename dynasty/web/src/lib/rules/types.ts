/**
 * Tipi del motore regole.
 *
 * Deliberatamente indipendenti da Prisma: il motore è fatto di funzioni pure che
 * ricevono dati e restituiscono decisioni, e si deve poter testare senza database.
 * La conversione da e verso le entità Prisma avviene in `src/lib/rules/adapters.ts`.
 */

import type { Money } from "../money";

export type ContractType = "ANNUALE" | "STANDARD" | "ROOKIE" | "VETERAN" | "TAMPONE";
export type PlayerRole = "P" | "D" | "C" | "A";

/** Una riga della tabella ingaggi di un contratto. */
export interface SalaryYear {
  /** Anno di apertura della stagione: 2025 = stagione 2025/26 */
  year: number;
  salary: Money;
  source: "BASE" | "ESCALATOR" | "TEAM_OPTION" | "FRANCHISE_TAG" | "LOAN_HALVED";
}

export type SalarySchedule = SalaryYear[];

export interface ContractView {
  id: string;
  playerId: string;
  playerName: string;
  role: PlayerRole;
  type: ContractType;
  baseSalary: Money;
  years: number;
  startYear: number;
  endYear: number;
  schedule: SalarySchedule;
  teamOptionsUsed: number;
  fromFranchiseTag: boolean;
  status: "ACTIVE" | "EXPIRED" | "BOUGHT_OUT" | "TERMINATED" | "TRADED";
  /** Dead cap lasciato da un buy-out, imputato a `deadCapYear` */
  deadCapAmount?: Money;
  deadCapYear?: number;
}

/** Esito di una validazione: o passa, o dice esattamente cosa non va. */
export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  /** Codice stabile, usabile per i test e per l'interfaccia */
  code: string;
  /** Articolo del regolamento che la regola applica */
  article: string;
  message: string;
}

export function ok(warnings: ValidationIssue[] = []): ValidationResult {
  return { ok: true, errors: [], warnings };
}

export function fail(errors: ValidationIssue[], warnings: ValidationIssue[] = []): ValidationResult {
  return { ok: errors.length === 0, errors, warnings };
}

export function issue(code: string, article: string, message: string): ValidationIssue {
  return { code, article, message };
}

export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings);
  return { ok: errors.length === 0, errors, warnings };
}
