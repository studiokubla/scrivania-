/**
 * Contratti: costruzione della tabella ingaggi, validazione della firma,
 * Team Option e Franchise Tag. (Titolo II e III del regolamento.)
 */

import { applyRate, fromMillions, type Money, roundToStep, isOnStep } from "../money";
import type { Ruleset } from "../ruleset";
import {
  type ContractType,
  type SalarySchedule,
  type ValidationResult,
  fail,
  issue,
  ok,
} from "./types";

/**
 * Età del giocatore alla data di riferimento della stagione (art. 4.2: il 1° settembre).
 * Restituisce null se la data di nascita non è nota: senza anagrafica non si possono
 * firmare Rookie né Veteran, e la validazione lo dice esplicitamente.
 */
/**
 * Quanti anni ha un giocatore in una certa stagione.
 *
 * Due fonti, in ordine di fiducia. La **data di nascita** è esatta e arriva
 * dall'import Transfermarkt: se c'è, decide lei. In sua assenza vale l'**età
 * stampata sul listone**, che è un numero riferito a una stagione precisa e
 * che quindi va invecchiato di un anno per ogni stagione trascorsa da allora.
 *
 * Non si costruisce una finta data di nascita a partire dall'età: sembrerebbe
 * più comodo e funzionerebbe, ma seminerebbe nel database date inventate
 * indistinguibili da quelle vere, e fra due stagioni nessuno saprebbe più
 * quali fidarsi.
 */
export function etàAllaStagione(
  anagrafica: { birthDate?: Date | null; declaredAge?: number | null; declaredAgeYear?: number | null },
  seasonStartYear: number,
  ruleset: Ruleset,
): number | null {
  const esatta = ageAtSeason(anagrafica.birthDate ?? null, seasonStartYear, ruleset);
  if (esatta !== null) return esatta;

  const dichiarata = anagrafica.declaredAge;
  if (dichiarata == null) return null;
  const anno = anagrafica.declaredAgeYear ?? seasonStartYear;
  return dichiarata + (seasonStartYear - anno);
}

export function ageAtSeason(
  birthDate: Date | null | undefined,
  seasonStartYear: number,
  ruleset: Ruleset,
): number | null {
  if (!birthDate) return null;
  const { month, day } = ruleset.contracts.ageReferenceDate;
  const reference = new Date(Date.UTC(seasonStartYear, month - 1, day));
  let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** Il fattore annuo di un tipo di contratto: 1.1 per lo Standard, 0.8 per il Veteran, 1 per il resto. */
function yearlyRate(type: ContractType, ruleset: Ruleset): number {
  switch (type) {
    case "STANDARD":
      return ruleset.contracts.STANDARD.yearlyRate;
    case "ROOKIE":
      return ruleset.contracts.ROOKIE.yearlyRate;
    case "VETERAN":
      return ruleset.contracts.VETERAN.yearlyRate;
    default:
      return 1;
  }
}

/**
 * Costruisce la tabella ingaggi anno per anno.
 *
 * L'escalator si applica **sull'ingaggio già arrotondato dell'anno precedente**, non
 * sulla base: è così che il conto lo farebbe un manager con la calcolatrice, ed è così
 * che tornano gli esempi del regolamento.
 */
export function buildSalarySchedule(input: {
  type: ContractType;
  baseSalary: Money;
  years: number;
  startYear: number;
  ruleset: Ruleset;
}): SalarySchedule {
  const { type, baseSalary, years, startYear, ruleset } = input;
  const rate = yearlyRate(type, ruleset);
  const schedule: SalarySchedule = [];
  let current = roundToStep(baseSalary);

  for (let i = 0; i < years; i += 1) {
    if (i > 0) current = applyRate(current, rate);
    schedule.push({ year: startYear + i, salary: current, source: i === 0 ? "BASE" : "ESCALATOR" });
  }
  return schedule;
}

/** L'ingaggio di un contratto in una data stagione; 0 se il contratto non la copre. */
export function salaryInYear(schedule: SalarySchedule, year: number): Money {
  return schedule.find((row) => row.year === year)?.salary ?? 0;
}

/** Somma degli ingaggi ancora da pagare a partire da una stagione compresa. */
export function remainingSalary(schedule: SalarySchedule, fromYear: number): Money {
  return schedule.filter((row) => row.year >= fromYear).reduce((acc, row) => acc + row.salary, 0);
}

export function yearsRemaining(schedule: SalarySchedule, fromYear: number): number {
  return schedule.filter((row) => row.year >= fromYear).length;
}

export function occupiesMultiYearSlot(type: ContractType, ruleset: Ruleset): boolean {
  return ruleset.contracts[type].occupiesSlot;
}

/**
 * Validazione della firma (art. 4 e 5). Controlla solo il contratto in sé:
 * i vincoli di rosa e di tetto salariale sono in `cap.ts`, perché dipendono
 * dallo stato della squadra e non dal contratto.
 */
export function validateContractSignature(input: {
  type: ContractType;
  salary: Money;
  years: number;
  seasonStartYear: number;
  /**
   * L'età alla data di riferimento, o `null` se la lega non la conosce.
   *
   * Si passa l'età e non la data di nascita perché al regolamento la data non
   * serve: serve sapere quanti anni ha. Da dove lo si sappia — dall'anagrafica
   * Transfermarkt o dall'età stampata sul listone — è un problema di chi legge
   * i dati, non delle regole. Si ricava con `etàAllaStagione`.
   */
  playerAge: number | null;
  ruleset: Ruleset;
}): ValidationResult {
  const { type, salary, years, playerAge, ruleset } = input;
  const errors = [];
  const warnings = [];
  const c = ruleset.contracts;

  if (salary <= 0) {
    errors.push(issue("SALARY_NOT_POSITIVE", "art. 4", "L'ingaggio deve essere maggiore di zero."));
  }
  if (!isOnStep(salary)) {
    errors.push(
      issue("SALARY_OFF_STEP", "art. 4.3", "Gli ingaggi si esprimono in multipli di 0,25 M."),
    );
  }

  const age = playerAge;

  switch (type) {
    case "ANNUALE": {
      if (years !== 1) {
        errors.push(issue("ANNUALE_YEARS", "art. 4", "Il contratto Annuale dura esattamente 1 anno."));
      }
      break;
    }
    case "STANDARD": {
      if (years < c.STANDARD.minYears || years > c.STANDARD.maxYears) {
        errors.push(
          issue(
            "STANDARD_YEARS",
            "art. 4",
            `Lo Standard dura da ${c.STANDARD.minYears} a ${c.STANDARD.maxYears} anni.`,
          ),
        );
      }
      break;
    }
    case "ROOKIE": {
      if (years < c.ROOKIE.minYears || years > c.ROOKIE.maxYears) {
        errors.push(
          issue("ROOKIE_YEARS", "art. 4", `Il Rookie dura da ${c.ROOKIE.minYears} a ${c.ROOKIE.maxYears} anni.`),
        );
      }
      if (salary > fromMillions(c.ROOKIE.maxSalary)) {
        errors.push(
          issue("ROOKIE_MAX_SALARY", "art. 4", `Il Rookie non può superare ${c.ROOKIE.maxSalary} M di ingaggio.`),
        );
      }
      if (age === null) {
        errors.push(
          issue(
            "ROOKIE_AGE_UNKNOWN",
            "art. 4.2",
            "Manca la data di nascita: senza anagrafica il Rookie non è verificabile. Importa i dati Transfermarkt del giocatore.",
          ),
        );
      } else if (age > c.ROOKIE.maxAge) {
        errors.push(
          issue(
            "ROOKIE_AGE",
            "art. 4",
            `Il Rookie è riservato agli Under ${c.ROOKIE.maxAge + 1}: il giocatore ne ha ${age} al 1° settembre.`,
          ),
        );
      }
      break;
    }
    case "VETERAN": {
      if (years < c.VETERAN.minYears || years > c.VETERAN.maxYears) {
        errors.push(
          issue("VETERAN_YEARS", "art. 4", `Il Veteran dura ${c.VETERAN.minYears} anni.`),
        );
      }
      if (salary > fromMillions(c.VETERAN.maxSalary)) {
        errors.push(
          issue("VETERAN_MAX_SALARY", "art. 4", `Il Veteran non può superare ${c.VETERAN.maxSalary} M di ingaggio.`),
        );
      }
      if (age === null) {
        errors.push(
          issue(
            "VETERAN_AGE_UNKNOWN",
            "art. 4.2",
            "Manca la data di nascita: senza anagrafica il Veteran non è verificabile.",
          ),
        );
      } else if (age < c.VETERAN.minAge) {
        errors.push(
          issue(
            "VETERAN_AGE",
            "art. 4",
            `Il Veteran è riservato agli Over ${c.VETERAN.minAge}: il giocatore ne ha ${age} al 1° settembre.`,
          ),
        );
      }
      break;
    }
    case "TAMPONE": {
      if (salary > fromMillions(c.TAMPONE.maxSalary)) {
        errors.push(
          issue("TAMPONE_MAX_SALARY", "art. 4.4", `Il tampone non può superare ${c.TAMPONE.maxSalary} M.`),
        );
      }
      break;
    }
  }

  // Un Under 23 firmato Standard è legittimo, ma quasi sempre è una svista:
  // il Rookie costa meno e non ha escalator.
  if (type === "STANDARD" && age !== null && age <= c.ROOKIE.maxAge && salary <= fromMillions(c.ROOKIE.maxSalary)) {
    warnings.push(
      issue(
        "ROOKIE_AVAILABLE",
        "art. 4",
        `Il giocatore ha ${age} anni: con un Rookie eviteresti il +10% annuo dello Standard.`,
      ),
    );
  }

  return errors.length ? fail(errors, warnings) : ok(warnings);
}

/**
 * Team Option (art. 6.1): estende di un anno all'ingaggio dell'ultimo anno +20%.
 * Restituisce la nuova tabella; non tocca i contatori, che stanno nel database.
 */
export function applyTeamOption(schedule: SalarySchedule, ruleset: Ruleset): SalarySchedule {
  if (schedule.length === 0) throw new Error("Tabella ingaggi vuota");
  const last = schedule[schedule.length - 1];
  const extended = applyRate(last.salary, ruleset.options.teamOption.rate);
  return [...schedule, { year: last.year + 1, salary: extended, source: "TEAM_OPTION" }];
}

/**
 * Franchise Tag (art. 6.2): il maggiore tra il 120% dell'ultimo ingaggio e la media
 * dei tre ingaggi più alti del ruolo in tutta la lega.
 */
export function franchiseTagSalary(input: {
  lastSalary: Money;
  /** Ingaggi correnti di tutti i giocatori del ruolo nella lega, in ordine qualsiasi */
  leagueSalariesForRole: Money[];
  ruleset: Ruleset;
}): { salary: Money; basis: "PREVIOUS_SALARY" | "ROLE_AVERAGE"; roleAverage: Money } {
  const { lastSalary, leagueSalariesForRole, ruleset } = input;
  const tag = ruleset.options.franchiseTag;

  const top = [...leagueSalariesForRole].sort((a, b) => b - a).slice(0, tag.topSalariesByRole);
  const roleAverage = top.length ? roundToStep(Math.round(top.reduce((a, b) => a + b, 0) / top.length)) : 0;
  const fromPrevious = applyRate(lastSalary, tag.minRate);

  return fromPrevious >= roleAverage
    ? { salary: fromPrevious, basis: "PREVIOUS_SALARY", roleAverage }
    : { salary: roleAverage, basis: "ROLE_AVERAGE", roleAverage };
}

/** Validazione del Franchise Tag: uno per stagione e mai due anni di fila (art. 6.2). */
export function validateFranchiseTag(input: {
  tagsUsedThisSeason: number;
  playerWasTaggedLastSeason: boolean;
  contractExpiresThisSeason: boolean;
  ruleset: Ruleset;
}): ValidationResult {
  const errors = [];
  const tag = input.ruleset.options.franchiseTag;

  if (input.tagsUsedThisSeason >= tag.perSeason) {
    errors.push(
      issue("TAG_EXHAUSTED", "art. 6.2", `Hai già usato il Franchise Tag di questa stagione (${tag.perSeason} disponibile).`),
    );
  }
  if (input.playerWasTaggedLastSeason) {
    errors.push(
      issue("TAG_CONSECUTIVE", "art. 6.2", "Non puoi taggare lo stesso giocatore due anni di fila."),
    );
  }
  if (!input.contractExpiresThisSeason) {
    errors.push(
      issue("TAG_NOT_EXPIRING", "art. 6.2", "Il Franchise Tag si applica solo a un giocatore in scadenza."),
    );
  }
  return errors.length ? fail(errors) : ok();
}

/** Validazione della Team Option (art. 6.1). */
export function validateTeamOption(input: {
  optionsUsedThisSeason: number;
  isMultiYear: boolean;
  contractExpiresThisSeason: boolean;
  freeMultiYearSlots: number;
  ruleset: Ruleset;
}): ValidationResult {
  const errors = [];
  const opt = input.ruleset.options.teamOption;

  if (input.optionsUsedThisSeason >= opt.perSeason) {
    errors.push(
      issue("OPTION_EXHAUSTED", "art. 6.1", `Hai già esercitato ${opt.perSeason} Team Option in questa stagione.`),
    );
  }
  if (!input.isMultiYear) {
    errors.push(
      issue("OPTION_NOT_MULTIYEAR", "art. 6.1", "La Team Option si applica solo ai contratti pluriennali."),
    );
  }
  if (!input.contractExpiresThisSeason) {
    errors.push(
      issue("OPTION_NOT_EXPIRING", "art. 6.1", "La Team Option si esercita sul contratto in scadenza."),
    );
  }
  if (input.freeMultiYearSlots <= 0) {
    errors.push(
      issue(
        "OPTION_NO_SLOT",
        "art. 6.1",
        "L'anno di estensione occupa uno slot pluriennale e non ne hai di liberi.",
      ),
    );
  }
  return errors.length ? fail(errors) : ok();
}

/** Ingaggio dimezzato per il giocatore in prestito che si decide di attendere (art. 13.2). */
export function halveForLoan(schedule: SalarySchedule, fromYear: number, ruleset: Ruleset): SalarySchedule {
  return schedule.map((row) =>
    row.year >= fromYear
      ? { ...row, salary: roundToStep(Math.round(row.salary * ruleset.market.loanSalaryRate)), source: "LOAN_HALVED" as const }
      : row,
  );
}

/** Ingaggio di un giovane promosso in prima squadra, in base al turno di draft (art. 16.4). */
export function youthPromotionSalary(pickNumber: number, ruleset: Ruleset): Money {
  const tier = ruleset.youth.promotionSalaryByPick.find((t) => pickNumber <= t.maxPick);
  if (!tier) throw new Error(`Nessuna fascia di ingaggio per la chiamata ${pickNumber}`);
  return fromMillions(tier.salary);
}
