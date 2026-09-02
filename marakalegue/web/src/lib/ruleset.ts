/**
 * I parametri del regolamento, in un posto solo.
 *
 * Il motore regole non contiene numeri: li legge tutti da qui. Cambiare il tetto
 * salariale, i premi o il costo di uno stadio è una modifica di configurazione,
 * non di codice — che è esattamente ciò che l'art. 24 prevede.
 *
 * Il ruleset è salvato su `League.ruleset` come JSON e validato con questo schema
 * a ogni lettura: una lega con parametri incoerenti non si apre.
 */

import { z } from "zod";

/** Importi espressi in milioni: qui sono leggibili, il motore li converte in centesimi. */
const millions = z.number().finite();

export const RulesetSchema = z.object({
  version: z.literal(3),

  roster: z.object({
    /** Art. 3.2 */
    salaryCap: millions,
    minPlayers: z.number().int(),
    maxPlayers: z.number().int(),
    /** Art. 3.1 — minimi per ruolo secondo la classificazione Leghe Fantacalcio */
    minByRole: z.object({ P: z.number().int(), D: z.number().int(), C: z.number().int(), A: z.number().int() }),
    /** Art. 3.3 */
    maxMultiYearContracts: z.number().int(),
    /** Art. 8.4 */
    minRaise: millions,
  }),

  contracts: z.object({
    ANNUALE: z.object({ minYears: z.literal(1), maxYears: z.literal(1), occupiesSlot: z.literal(false) }),
    STANDARD: z.object({
      minYears: z.number().int(),
      maxYears: z.number().int(),
      /** Art. 4 — +10% l'anno */
      yearlyRate: z.number(),
      occupiesSlot: z.literal(true),
    }),
    ROOKIE: z.object({
      minYears: z.number().int(),
      maxYears: z.number().int(),
      /** Art. 4 — Under 23 alla firma */
      maxAge: z.number().int(),
      maxSalary: millions,
      yearlyRate: z.number(),
      occupiesSlot: z.literal(true),
    }),
    VETERAN: z.object({
      minYears: z.number().int(),
      maxYears: z.number().int(),
      /** Art. 4 — Over 30 alla firma */
      minAge: z.number().int(),
      maxSalary: millions,
      /** Art. 4 — −20% l'anno */
      yearlyRate: z.number(),
      occupiesSlot: z.literal(true),
    }),
    TAMPONE: z.object({
      /** Art. 4.4 — 4 giornate */
      matchdays: z.number().int(),
      maxSalary: millions,
      maxPerSeason: z.number().int(),
      occupiesSlot: z.literal(false),
    }),
    /** Data a cui si calcola l'età, art. 4.2: mese 1-12, giorno 1-31 */
    ageReferenceDate: z.object({ month: z.number().int(), day: z.number().int() }),
  }),

  options: z.object({
    /** Art. 6.1 */
    teamOption: z.object({ perSeason: z.number().int(), rate: z.number(), declareWithinDays: z.number().int() }),
    /** Art. 6.2 */
    franchiseTag: z.object({
      perSeason: z.number().int(),
      /** 120% dell'ultimo ingaggio */
      minRate: z.number(),
      /** oppure la media dei N ingaggi più alti del ruolo, se maggiore */
      topSalariesByRole: z.number().int(),
      /** Art. 6.2 — non due anni di fila sullo stesso giocatore */
      consecutiveOnSamePlayer: z.literal(false),
    }),
    performanceBuyout: z.object({ perSeason: z.number().int() }),
    freeAgencyOffers: z.object({ perSeason: z.number().int() }),
    preContract: z.object({ perSeason: z.number().int() }),
  }),

  buyout: z.object({
    /** Art. 12.2 — maggiorazione per anni residui, indice = anni residui */
    penaltyByYearsRemaining: z.record(z.string(), z.number()),
    /** Art. 12.3 — dead cap del 25% dell'ingaggio corrente */
    deadCapRate: z.number(),
    /** Art. 12.4 — il performance buy-out dimezza e azzera il dead cap */
    performanceRate: z.number(),
    performanceConditions: z.object({
      /** meno del 50% delle giornate disputate */
      minAppearanceRate: z.number(),
      /** media voto sotto 6 con almeno N presenze */
      lowAverageVote: z.number(),
      lowAverageMinAppearances: z.number().int(),
      /** N giornate consecutive senza voto */
      consecutiveNoVote: z.number().int(),
    }),
  }),

  auction: z.object({
    /** Art. 8.3 */
    bidWindowSeconds: z.number().int(),
    /** Art. 8.4 — soglie sulla quotazione LFC, dalla più alta alla più bassa */
    basePriceByQuotation: z.array(z.object({ minQuotation: z.number(), basePrice: millions })),
    /** Art. 8.6 — riserva per completare la rosa minima */
    reservePerMissingSlot: millions,
  }),

  market: z.object({
    /** Art. 9.2 — 24 ore */
    freeAgencyHours: z.number().int(),
    /** Art. 11.2 — 48 ore per il diritto di pareggio */
    preContractHours: z.number().int(),
    /** Art. 10.1 — 48 ore di waiver */
    waiverHours: z.number().int(),
    /** Art. 11.1.3 */
    tradeAcceptHours: z.number().int(),
    tradeVetoHours: z.number().int(),
    /** Art. 7 — finestre e giornata di Serie A da cui si aprono */
    windows: z.array(
      z.object({
        kind: z.enum(["SETTEMBRE", "NOVEMBRE", "GENNAIO", "MARZO"]),
        label: z.string(),
        fromMatchday: z.number().int(),
        allowsPreContract: z.boolean(),
      }),
    ),
    /** Art. 13.2 — chi resta in prestito costa metà */
    loanSalaryRate: z.number(),
  }),

  capital: z.object({
    /** Art. 14 */
    initialEndowment: millions,
    /** Art. 15 */
    stadium: z.array(
      z.object({
        level: z.number().int(),
        name: z.string(),
        buildCost: millions,
        maintenance: millions,
        incomePerHomeMatch: millions,
        fantaPointsPerHomeMatch: z.number(),
      }),
    ),
    stadiumOperationalFromMatchday: z.number().int(),
    homeMatchesPerSeason: z.number().int(),
    /** Art. 16.2 */
    academy: z.array(
      z.object({ maxPlayers: z.number().int(), investment: millions, maintenance: millions }),
    ),
    /** Art. 17.2 */
    scouting: z.array(z.object({ league: z.string(), country: z.string(), cost: millions })),
  }),

  youth: z.object({
    /** Art. 16.1 */
    maxAge: z.number().int(),
    maxPreviousAppearances: z.number().int(),
    maxQuotation: millions,
    baseCapacity: z.number().int(),
    /** Art. 16.4 — ingaggio alla promozione per turno di chiamata */
    promotionSalaryByPick: z.array(z.object({ maxPick: z.number().int(), salary: millions })),
    /** Art. 17.1 — pesi della lotteria, dalla 1ª all'ultima in classifica */
    lotteryWeights: z.array(z.number()),
    /** Art. 19 — bonus Marakà Youth per ampiezza della rosa primavera */
    youthBonus: z.array(z.object({ maxPlayers: z.number().int(), bonus: z.number() })),
    minPlayersForYouthCompetition: z.number().int(),
  }),

  sponsors: z.object({
    /** Art. 18.1 */
    offersPerSeason: z.number().int(),
    maxSigned: z.number().int(),
    penaltyRate: z.number(),
    /** Art. 18 — fasce di compenso per piazzamento dell'anno precedente */
    tiers: z.array(
      z.object({
        maxPosition: z.number().int(),
        minFee: millions,
        maxFee: millions,
        objective: z.object({ type: z.literal("TOP_N"), n: z.number().int() }),
      }),
    ),
  }),

  competitions: z.object({
    /** Art. 19 */
    apertura: z.object({ fromMatchday: z.number().int(), toMatchday: z.number().int(), prizes: z.array(millions) }),
    clausura: z.object({ fromMatchday: z.number().int(), toMatchday: z.number().int(), prizes: z.array(millions) }),
    marabaoCup: z.object({ quarterFinals: millions, semiFinals: millions, final: millions, win: millions }),
    superCup: z.object({ semiFinals: millions, final: millions, win: millions }),
    marakaYouth: z.object({ prizes: z.array(millions) }),
    /** Art. 20 — premi in euro */
    cash: z.object({
      entryFee: z.number(),
      apertura: z.array(z.number()),
      clausura: z.array(z.number()),
      marabaoCup: z.array(z.number()),
      superCup: z.array(z.number()),
      marakaYouth: z.array(z.number()),
    }),
  }),

  governance: z.object({
    /** Art. 23 */
    disputeHours: z.number().int(),
    disputeOverrideVotes: z.number().int(),
    /** Art. 24 */
    rulesetChangeVotes: z.number().int(),
    teams: z.number().int(),
  }),
});

export type Ruleset = z.infer<typeof RulesetSchema>;

/** Il regolamento versione 3.0, tradotto in numeri. */
export const DEFAULT_RULESET: Ruleset = {
  version: 3,

  roster: {
    salaryCap: 85,
    minPlayers: 25,
    maxPlayers: 30,
    minByRole: { P: 3, D: 8, C: 8, A: 6 },
    maxMultiYearContracts: 9,
    minRaise: 0.25,
  },

  contracts: {
    ANNUALE: { minYears: 1, maxYears: 1, occupiesSlot: false },
    STANDARD: { minYears: 2, maxYears: 3, yearlyRate: 1.1, occupiesSlot: true },
    ROOKIE: { minYears: 2, maxYears: 4, maxAge: 22, maxSalary: 6, yearlyRate: 1.0, occupiesSlot: true },
    VETERAN: { minYears: 2, maxYears: 2, minAge: 30, maxSalary: 10, yearlyRate: 0.8, occupiesSlot: true },
    TAMPONE: { matchdays: 4, maxSalary: 1, maxPerSeason: 3, occupiesSlot: false },
    ageReferenceDate: { month: 9, day: 1 },
  },

  options: {
    teamOption: { perSeason: 3, rate: 1.2, declareWithinDays: 7 },
    franchiseTag: { perSeason: 1, minRate: 1.2, topSalariesByRole: 3, consecutiveOnSamePlayer: false },
    performanceBuyout: { perSeason: 3 },
    freeAgencyOffers: { perSeason: 5 },
    preContract: { perSeason: 3 },
  },

  buyout: {
    penaltyByYearsRemaining: { "1": 1.0, "2": 1.1, "3": 1.2, "4": 1.3 },
    deadCapRate: 0.25,
    performanceRate: 0.5,
    performanceConditions: {
      minAppearanceRate: 0.5,
      lowAverageVote: 6,
      lowAverageMinAppearances: 10,
      consecutiveNoVote: 5,
    },
  },

  auction: {
    bidWindowSeconds: 20,
    basePriceByQuotation: [
      { minQuotation: 30, basePrice: 5 },
      { minQuotation: 20, basePrice: 4 },
      { minQuotation: 15, basePrice: 3 },
      { minQuotation: 0, basePrice: 0.5 },
    ],
    reservePerMissingSlot: 0.5,
  },

  market: {
    freeAgencyHours: 24,
    preContractHours: 48,
    waiverHours: 48,
    tradeAcceptHours: 48,
    tradeVetoHours: 24,
    windows: [
      { kind: "SETTEMBRE", label: "Asta di settembre", fromMatchday: 0, allowsPreContract: false },
      { kind: "NOVEMBRE", label: "Finestra di novembre", fromMatchday: 12, allowsPreContract: false },
      { kind: "GENNAIO", label: "Finestra di gennaio", fromMatchday: 20, allowsPreContract: false },
      { kind: "MARZO", label: "Finestra di marzo", fromMatchday: 28, allowsPreContract: true },
    ],
    loanSalaryRate: 0.5,
  },

  capital: {
    initialEndowment: 40,
    stadium: [
      { level: 1, name: "Comunale", buildCost: 30, maintenance: 3, incomePerHomeMatch: 0.5, fantaPointsPerHomeMatch: 0.5 },
      { level: 2, name: "Rinnovato", buildCost: 60, maintenance: 6, incomePerHomeMatch: 0.9, fantaPointsPerHomeMatch: 1.0 },
      { level: 3, name: "Moderno", buildCost: 100, maintenance: 10, incomePerHomeMatch: 1.4, fantaPointsPerHomeMatch: 1.5 },
      { level: 4, name: "Grande impianto", buildCost: 150, maintenance: 15, incomePerHomeMatch: 2.0, fantaPointsPerHomeMatch: 2.0 },
      { level: 5, name: "Cattedrale", buildCost: 210, maintenance: 21, incomePerHomeMatch: 2.7, fantaPointsPerHomeMatch: 2.5 },
    ],
    stadiumOperationalFromMatchday: 20,
    homeMatchesPerSeason: 19,
    academy: [
      { maxPlayers: 3, investment: 0, maintenance: 0 },
      { maxPlayers: 5, investment: 5, maintenance: 1 },
      { maxPlayers: 7, investment: 7, maintenance: 1.5 },
      { maxPlayers: 9, investment: 9, maintenance: 2 },
      { maxPlayers: 11, investment: 10, maintenance: 2.5 },
    ],
    scouting: [
      { league: "Premier League", country: "Inghilterra", cost: 10 },
      { league: "La Liga", country: "Spagna", cost: 9 },
      { league: "Bundesliga", country: "Germania", cost: 9 },
      { league: "Ligue 1", country: "Francia", cost: 8 },
      { league: "Eredivisie", country: "Olanda", cost: 8 },
      { league: "Primeira Liga", country: "Portogallo", cost: 8 },
      { league: "Serie B", country: "Italia", cost: 7 },
      { league: "Brasileirão", country: "Brasile", cost: 6 },
      { league: "Primera División", country: "Argentina", cost: 6 },
      { league: "Altri", country: "Altri", cost: 6 },
    ],
  },

  youth: {
    maxAge: 20,
    maxPreviousAppearances: 5,
    maxQuotation: 7,
    baseCapacity: 3,
    promotionSalaryByPick: [
      { maxPick: 3, salary: 0.75 },
      { maxPick: 6, salary: 0.5 },
      { maxPick: 9999, salary: 0.25 },
    ],
    // Dalla 1ª classificata all'ultima: l'ultima ha il peso più alto (art. 17.1)
    lotteryWeights: [2, 4, 5, 7, 8, 10, 12, 15, 17, 20],
    youthBonus: [
      { maxPlayers: 3, bonus: 0 },
      { maxPlayers: 5, bonus: 0.2 },
      { maxPlayers: 7, bonus: 0.4 },
      { maxPlayers: 9, bonus: 0.6 },
      { maxPlayers: 11, bonus: 0.8 },
    ],
    minPlayersForYouthCompetition: 4,
  },

  sponsors: {
    offersPerSeason: 3,
    maxSigned: 2,
    penaltyRate: 0.5,
    tiers: [
      { maxPosition: 3, minFee: 18, maxFee: 25, objective: { type: "TOP_N", n: 4 } },
      { maxPosition: 7, minFee: 12, maxFee: 18, objective: { type: "TOP_N", n: 6 } },
      { maxPosition: 10, minFee: 8, maxFee: 12, objective: { type: "TOP_N", n: 9 } },
    ],
  },

  competitions: {
    apertura: { fromMatchday: 3, toMatchday: 20, prizes: [27, 25, 23, 21, 19, 17, 15, 13, 12, 10] },
    clausura: { fromMatchday: 21, toMatchday: 38, prizes: [27, 25, 23, 21, 19, 17, 15, 13, 12, 10] },
    marabaoCup: { quarterFinals: 5, semiFinals: 7, final: 10, win: 15 },
    superCup: { semiFinals: 3, final: 5, win: 7 },
    marakaYouth: { prizes: [5, 3, 1] },
    cash: {
      entryFee: 75,
      apertura: [130, 100, 70],
      clausura: [130, 100, 70],
      marabaoCup: [75, 50],
      superCup: [25],
      marakaYouth: [30, 15],
    },
  },

  governance: {
    disputeHours: 48,
    disputeOverrideVotes: 7,
    rulesetChangeVotes: 6,
    teams: 10,
  },
};

export function parseRuleset(value: unknown): Ruleset {
  return RulesetSchema.parse(value);
}
