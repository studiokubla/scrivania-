/**
 * Economia societaria: stadio, settore giovanile, osservatori, sponsor, premi
 * (Titolo V e art. 19).
 *
 * Il Capitale è denaro vero della lega: si accumula, si investe e si può cedere.
 * Ogni funzione qui restituisce importi, mai effetti: chi scrive è il livello
 * applicativo, che registra il movimento e lascia traccia.
 */

import { fromMillions, type Money, roundToStep } from "../money";
import type { Ruleset } from "../ruleset";
import { type ValidationResult, fail, issue, ok } from "./types";

// ───────────────────────────────────────────────────────── Stadio (art. 15)

export interface StadiumTier {
  level: number;
  name: string;
  buildCost: Money;
  maintenance: Money;
  incomePerHomeMatch: Money;
  fantaPointsPerHomeMatch: number;
}

export function stadiumTiers(ruleset: Ruleset): StadiumTier[] {
  return ruleset.capital.stadium.map((s) => ({
    level: s.level,
    name: s.name,
    buildCost: fromMillions(s.buildCost),
    maintenance: fromMillions(s.maintenance),
    incomePerHomeMatch: fromMillions(s.incomePerHomeMatch),
    fantaPointsPerHomeMatch: s.fantaPointsPerHomeMatch,
  }));
}

export function stadiumTier(level: number, ruleset: Ruleset): StadiumTier | null {
  return stadiumTiers(ruleset).find((t) => t.level === level) ?? null;
}

/**
 * Costo per passare da un livello al successivo (art. 15.2): si paga la differenza,
 * ma **un livello alla volta**. Per saltare, si demolisce e si ricostruisce da zero.
 */
export function stadiumUpgradeCost(input: {
  currentLevel: number;
  targetLevel: number;
  ruleset: Ruleset;
}): { cost: Money; requiresDemolition: boolean } {
  const { currentLevel, targetLevel, ruleset } = input;
  const target = stadiumTier(targetLevel, ruleset);
  if (!target) throw new Error(`Livello stadio inesistente: ${targetLevel}`);

  if (currentLevel === 0) return { cost: target.buildCost, requiresDemolition: false };

  if (targetLevel === currentLevel + 1) {
    const current = stadiumTier(currentLevel, ruleset);
    return { cost: target.buildCost - (current?.buildCost ?? 0), requiresDemolition: false };
  }

  // Salto di più livelli: si ricostruisce, e l'investimento precedente è perduto
  return { cost: target.buildCost, requiresDemolition: true };
}

export function validateStadiumInvestment(input: {
  currentLevel: number;
  targetLevel: number;
  capital: Money;
  seasonPhase: "PRESEASON" | "REGULAR" | "POSTSEASON" | "ARCHIVED";
  ruleset: Ruleset;
}): ValidationResult {
  const { currentLevel, targetLevel, capital, seasonPhase, ruleset } = input;
  const errors = [];
  const warnings = [];

  if (seasonPhase !== "PRESEASON") {
    errors.push(
      issue("STADIUM_TIMING", "art. 15.1", "La costruzione si decide all'inizio della stagione, prima dell'asta."),
    );
  }
  if (targetLevel <= currentLevel) {
    errors.push(issue("STADIUM_NOT_UPGRADE", "art. 15.2", "Il livello scelto non è un miglioramento."));
  }

  const { cost, requiresDemolition } = stadiumUpgradeCost({ currentLevel, targetLevel, ruleset });
  if (capital < cost) {
    errors.push(
      issue(
        "STADIUM_CAPITAL",
        "art. 15",
        `Servono ${(cost / 100).toLocaleString("it-IT")} M, ne hai ${(capital / 100).toLocaleString("it-IT")}.`,
      ),
    );
  }
  if (requiresDemolition) {
    warnings.push(
      issue(
        "STADIUM_DEMOLITION",
        "art. 15.2",
        "Salti più di un livello: l'impianto attuale va demolito e l'investimento precedente è perduto.",
      ),
    );
  }

  // Un impianto che non ci si può permettere di mantenere retrocede l'anno dopo (art. 15.3)
  const target = stadiumTier(targetLevel, ruleset);
  if (target && capital - cost < target.maintenance) {
    warnings.push(
      issue(
        "STADIUM_MAINTENANCE_RISK",
        "art. 15.3",
        `Dopo l'investimento resteresti sotto la manutenzione annua di ${(target.maintenance / 100).toLocaleString("it-IT")} M: lo stadio retrocederebbe di un livello.`,
      ),
    );
  }

  return errors.length ? fail(errors, warnings) : ok(warnings);
}

/**
 * Incasso dello stadio in una stagione. Gli incassi partono dalla 20ª giornata
 * dell'anno di costruzione (art. 15.1) e sono pieni dagli anni successivi.
 */
export function stadiumIncome(input: {
  level: number;
  builtInYear: number | null;
  currentYear: number;
  homeMatchesPlayed: number;
  ruleset: Ruleset;
}): Money {
  const { level, builtInYear, currentYear, homeMatchesPlayed, ruleset } = input;
  const tier = stadiumTier(level, ruleset);
  if (!tier || level === 0) return 0;
  if (builtInYear !== null && currentYear < builtInYear) return 0;
  return tier.incomePerHomeMatch * homeMatchesPlayed;
}

/** Bonus in fantapunti per la squadra di casa (art. 15). */
export function stadiumFantaBonus(input: {
  level: number;
  serieAMatchday: number;
  builtInYear: number | null;
  currentYear: number;
  ruleset: Ruleset;
}): number {
  const { level, serieAMatchday, builtInYear, currentYear, ruleset } = input;
  const tier = stadiumTier(level, ruleset);
  if (!tier || level === 0) return 0;
  const isBuildYear = builtInYear === currentYear;
  if (isBuildYear && serieAMatchday < ruleset.capital.stadiumOperationalFromMatchday) return 0;
  return tier.fantaPointsPerHomeMatch;
}

// ───────────────────────────────────────────────────────── Settore giovanile (art. 16)

export function academyTierFor(capacity: number, ruleset: Ruleset) {
  return (
    ruleset.capital.academy.find((t) => capacity <= t.maxPlayers) ??
    ruleset.capital.academy[ruleset.capital.academy.length - 1]
  );
}

/** Costo per ampliare il settore giovanile a una nuova capienza (art. 16.2). */
export function academyUpgradeCost(input: {
  currentCapacity: number;
  targetCapacity: number;
  ruleset: Ruleset;
}): { investment: Money; maintenance: Money } {
  const current = academyTierFor(input.currentCapacity, input.ruleset);
  const target = academyTierFor(input.targetCapacity, input.ruleset);
  return {
    investment: Math.max(0, fromMillions(target.investment) - fromMillions(current.investment)),
    maintenance: fromMillions(target.maintenance),
  };
}

/** Bonus Marakà Youth per ampiezza della rosa primavera (art. 19). */
export function youthCompetitionBonus(playerCount: number, ruleset: Ruleset): number {
  const tier = ruleset.youth.youthBonus.find((t) => playerCount <= t.maxPlayers);
  return tier?.bonus ?? ruleset.youth.youthBonus[ruleset.youth.youthBonus.length - 1].bonus;
}

export function canEnterYouthCompetition(input: {
  playerCount: number;
  goalkeepers: number;
  ruleset: Ruleset;
}): boolean {
  return input.playerCount >= input.ruleset.youth.minPlayersForYouthCompetition && input.goalkeepers >= 1;
}

// ───────────────────────────────────────────────────────── Osservatori (art. 17.2)

export function scoutCost(league: string, ruleset: Ruleset): Money {
  const entry =
    ruleset.capital.scouting.find((s) => s.league.toLowerCase() === league.toLowerCase()) ??
    ruleset.capital.scouting.find((s) => s.league === "Altri");
  return fromMillions(entry?.cost ?? 6);
}

export interface ScoutRight {
  teamId: string;
  league: string;
  club: string | null;
  investedAt: Date;
}

/**
 * Chi ha il diritto di pareggio su un giocatore in arrivo da un certo club (art. 17.2.5).
 *
 * Gerarchia: prima chi ha scoutizzato il club, poi chi ha scoutizzato il campionato;
 * a parità di livello, chi ha investito prima. Se due investimenti sono nello stesso
 * istante, l'esito è un'asta ristretta tra i soli aventi diritto.
 */
export function resolveScoutingRights(input: {
  scouts: ScoutRight[];
  playerOriginClub: string | null;
  playerOriginLeague: string | null;
}): { holders: string[]; basis: "CLUB" | "LEAGUE" | "NONE"; restrictedAuction: boolean } {
  const { scouts, playerOriginClub, playerOriginLeague } = input;

  const sameClub = playerOriginClub
    ? scouts.filter((s) => s.club && s.club.toLowerCase() === playerOriginClub.toLowerCase())
    : [];

  const pool = sameClub.length
    ? sameClub
    : playerOriginLeague
      ? scouts.filter((s) => !s.club && s.league.toLowerCase() === playerOriginLeague.toLowerCase())
      : [];

  if (pool.length === 0) return { holders: [], basis: "NONE", restrictedAuction: false };

  const basis: "CLUB" | "LEAGUE" = sameClub.length ? "CLUB" : "LEAGUE";
  const earliest = Math.min(...pool.map((s) => s.investedAt.getTime()));
  const first = pool.filter((s) => s.investedAt.getTime() === earliest);

  return {
    holders: first.map((s) => s.teamId),
    basis,
    restrictedAuction: first.length > 1,
  };
}

// ───────────────────────────────────────────────────────── Premi (art. 19)

export function competitionPrize(input: {
  kind: "APERTURA" | "CLAUSURA" | "MARAKA_YOUTH";
  position: number;
  ruleset: Ruleset;
}): Money {
  const { kind, position, ruleset } = input;
  const table =
    kind === "APERTURA"
      ? ruleset.competitions.apertura.prizes
      : kind === "CLAUSURA"
        ? ruleset.competitions.clausura.prizes
        : ruleset.competitions.marakaYouth.prizes;
  const value = table[position - 1];
  return value === undefined ? 0 : fromMillions(value);
}

export function cupPrize(input: {
  kind: "MARABAO_CUP" | "SUPER_CUP";
  stage: "QUARTER" | "SEMI" | "FINAL" | "WIN";
  ruleset: Ruleset;
}): Money {
  const { kind, stage, ruleset } = input;
  if (kind === "MARABAO_CUP") {
    const c = ruleset.competitions.marabaoCup;
    return fromMillions(
      stage === "QUARTER" ? c.quarterFinals : stage === "SEMI" ? c.semiFinals : stage === "FINAL" ? c.final : c.win,
    );
  }
  const c = ruleset.competitions.superCup;
  if (stage === "QUARTER") return 0;
  return fromMillions(stage === "SEMI" ? c.semiFinals : stage === "FINAL" ? c.final : c.win);
}

// ───────────────────────────────────────────────────────── Sponsor (art. 18)

export interface SponsorOffer {
  name: string;
  annualFee: Money;
  years: number;
  objective: { type: "TOP_N"; n: number };
  penalty: Money;
}

/**
 * Genera le proposte di sponsorizzazione per una squadra, calibrate sul piazzamento
 * dell'anno precedente (art. 18.1). L'estrazione è deterministica sul seme, così
 * le proposte sono le stesse per tutti a parità di condizioni e non c'è modo di
 * "rigenerare finché non esce quella buona".
 */
export function generateSponsorOffers(input: {
  previousPosition: number;
  seed: string;
  ruleset: Ruleset;
}): SponsorOffer[] {
  const { previousPosition, seed, ruleset } = input;
  const s = ruleset.sponsors;
  const tier = s.tiers.find((t) => previousPosition <= t.maxPosition) ?? s.tiers[s.tiers.length - 1];

  const names = [
    "Aurora Bevande", "Vulcano Energia", "Sartoria Milano", "Banca del Ponte", "Ferrovie del Nord",
    "Olio Solare", "Caffè Ricciardi", "Assicurazioni Vela", "Tecnomeccanica", "Pastificio Grano Antico",
    "Editoriale Faro", "Cantine Verdi",
  ];

  let state = 0;
  for (const ch of seed) state = (state * 31 + ch.charCodeAt(0)) % 2147483647;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };

  const offers: SponsorOffer[] = [];
  const used = new Set<number>();
  for (let i = 0; i < s.offersPerSeason; i += 1) {
    let idx = Math.floor(next() * names.length);
    while (used.has(idx)) idx = (idx + 1) % names.length;
    used.add(idx);

    const spread = tier.maxFee - tier.minFee;
    const fee = roundToStep(fromMillions(tier.minFee + next() * spread));
    const years = 1 + Math.floor(next() * 3);

    offers.push({
      name: names[idx],
      annualFee: fee,
      years,
      objective: tier.objective,
      penalty: roundToStep(Math.round(fee * s.penaltyRate)),
    });
  }
  return offers;
}

/** L'obiettivo dello sponsor è stato raggiunto? (art. 18.2) */
export function sponsorObjectiveMet(input: {
  objective: { type: "TOP_N"; n: number };
  finalPosition: number;
}): boolean {
  return input.finalPosition <= input.objective.n;
}
