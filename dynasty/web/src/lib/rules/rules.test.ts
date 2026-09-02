import { describe, expect, it } from "vitest";

import { formatMoney, fromMillions, roundToStep, toMillions } from "../money";
import { DEFAULT_RULESET, RulesetSchema } from "../ruleset";
import {
  basePriceFor,
  drawCallOrder,
  drawDraftOrder,
  resolveAuctionTie,
  resolveSealedBids,
  validateAuctionBid,
} from "./auction";
import { checkPerformanceConditions, quoteBuyout, validateBuyout } from "./buyout";
import { buildCapMatrix, canAfford, freeMultiYearSlots, validateRoster } from "./cap";
import {
  academyUpgradeCost,
  competitionPrize,
  generateSponsorOffers,
  resolveScoutingRights,
  stadiumIncome,
  stadiumUpgradeCost,
  validateStadiumInvestment,
  youthCompetitionBonus,
} from "./capital";
import {
  ageAtSeason,
  etàAllaStagione,
  applyTeamOption,
  buildSalarySchedule,
  franchiseTagSalary,
  halveForLoan,
  validateContractSignature,
  validateFranchiseTag,
  youthPromotionSalary,
} from "./contracts";
import { validateTrade, type TradeSide } from "./trade";
import type { ContractView, PlayerRole } from "./types";
import { presenzeNote, youthEligibility } from "./youth";

const R = DEFAULT_RULESET;
const M = fromMillions;

function contract(overrides: Partial<ContractView> & { salary?: number } = {}): ContractView {
  const type = overrides.type ?? "ANNUALE";
  const startYear = overrides.startYear ?? 2025;
  const years = overrides.years ?? 1;
  const baseSalary = overrides.baseSalary ?? M(overrides.salary ?? 1);
  const schedule = overrides.schedule ?? buildSalarySchedule({ type, baseSalary, years, startYear, ruleset: R });

  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    playerId: overrides.playerId ?? "p",
    playerName: overrides.playerName ?? "Giocatore",
    role: overrides.role ?? "C",
    type,
    baseSalary,
    years,
    startYear,
    endYear: overrides.endYear ?? schedule[schedule.length - 1].year,
    schedule,
    teamOptionsUsed: overrides.teamOptionsUsed ?? 0,
    fromFranchiseTag: overrides.fromFranchiseTag ?? false,
    status: overrides.status ?? "ACTIVE",
    deadCapAmount: overrides.deadCapAmount,
    deadCapYear: overrides.deadCapYear,
  };
}

/** Rosa valida minima: 25 giocatori con i minimi di ruolo rispettati. */
function fullRoster(salaryEach = 1, year = 2025): ContractView[] {
  const plan: [PlayerRole, number][] = [
    ["P", 3],
    ["D", 8],
    ["C", 8],
    ["A", 6],
  ];
  const out: ContractView[] = [];
  for (const [role, count] of plan) {
    for (let i = 0; i < count; i += 1) {
      out.push(contract({ role, salary: salaryEach, startYear: year, id: `${role}${i}` }));
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────── Aritmetica

describe("money", () => {
  it("lavora in centesimi di milione senza errori di virgola mobile", () => {
    expect(M(0.1) + M(0.2)).toBe(M(0.3));
    expect(toMillions(M(12.5))).toBe(12.5);
  });

  it("arrotonda per eccesso al passo di 0,25 M (art. 4.3)", () => {
    expect(roundToStep(M(1.1))).toBe(M(1.25));
    expect(roundToStep(M(1.25))).toBe(M(1.25));
    expect(roundToStep(M(1.26))).toBe(M(1.5));
  });

  it("formatta gli importi all'italiana", () => {
    expect(formatMoney(M(12.5))).toBe("12,5 M");
    expect(formatMoney(M(0.25))).toBe("0,25 M");
    expect(formatMoney(M(-3))).toBe("−3 M");
  });
});

describe("ruleset", () => {
  it("il regolamento predefinito è valido", () => {
    expect(() => RulesetSchema.parse(DEFAULT_RULESET)).not.toThrow();
  });

  it("i pesi della lotteria coprono tutte le squadre", () => {
    expect(R.youth.lotteryWeights).toHaveLength(R.governance.teams);
  });

  it("i premi di Apertura e Clausura coprono tutte le posizioni", () => {
    expect(R.competitions.apertura.prizes).toHaveLength(R.governance.teams);
    expect(R.competitions.clausura.prizes).toHaveLength(R.governance.teams);
  });

  it("ogni livello di stadio è in attivo (il difetto del vecchio regolamento)", () => {
    for (const s of R.capital.stadium) {
      const yearly = s.incomePerHomeMatch * R.capital.homeMatchesPerSeason;
      expect(yearly).toBeGreaterThan(s.maintenance);
    }
  });
});

// ─────────────────────────────────────────────────────────────── Contratti

describe("età", () => {
  it("si calcola al 1° settembre della stagione (art. 4.2)", () => {
    // Compie 23 anni il 2 settembre: al 1° settembre 2025 ne ha ancora 22
    expect(ageAtSeason(new Date(Date.UTC(2002, 8, 2)), 2025, R)).toBe(22);
    // Compiuti il 31 agosto: ne ha 23
    expect(ageAtSeason(new Date(Date.UTC(2002, 7, 31)), 2025, R)).toBe(23);
  });

  it("senza data di nascita non decide", () => {
    expect(ageAtSeason(null, 2025, R)).toBeNull();
  });
});

describe("tabella ingaggi", () => {
  it("lo Standard cresce del 10% l'anno, composto sull'anno precedente arrotondato", () => {
    const s = buildSalarySchedule({ type: "STANDARD", baseSalary: M(10), years: 3, startYear: 2025, ruleset: R });
    expect(s.map((r) => toMillions(r.salary))).toEqual([10, 11, 12.25]);
  });

  it("il Rookie resta invariato", () => {
    const s = buildSalarySchedule({ type: "ROOKIE", baseSalary: M(6), years: 4, startYear: 2025, ruleset: R });
    expect(s.map((r) => toMillions(r.salary))).toEqual([6, 6, 6, 6]);
  });

  it("il Veteran scende del 20% l'anno", () => {
    const s = buildSalarySchedule({ type: "VETERAN", baseSalary: M(10), years: 2, startYear: 2025, ruleset: R });
    expect(s.map((r) => toMillions(r.salary))).toEqual([10, 8]);
  });

  it("l'Annuale è una riga sola", () => {
    const s = buildSalarySchedule({ type: "ANNUALE", baseSalary: M(3), years: 1, startYear: 2025, ruleset: R });
    expect(s).toHaveLength(1);
    expect(s[0].source).toBe("BASE");
  });
});

describe("validazione della firma", () => {
  // Il motore riceve l'età, non la data: da dove la lega la sappia — anagrafica
  // Transfermarkt o età stampata sul listone — non è affare suo.
  const under23 = 21;
  const over30 = 33;

  it("accetta un Rookie regolare", () => {
    const r = validateContractSignature({
      type: "ROOKIE", salary: M(5), years: 3, seasonStartYear: 2025, playerAge: under23, ruleset: R,
    });
    expect(r.ok).toBe(true);
  });

  it("rifiuta un Rookie sopra i 6 M", () => {
    const r = validateContractSignature({
      type: "ROOKIE", salary: M(7), years: 3, seasonStartYear: 2025, playerAge: under23, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("ROOKIE_MAX_SALARY");
  });

  it("rifiuta un Rookie a un giocatore troppo vecchio, e lo dice con l'età", () => {
    const r = validateContractSignature({
      type: "ROOKIE", salary: M(5), years: 3, seasonStartYear: 2025, playerAge: over30, ruleset: R,
    });
    const err = r.errors.find((e) => e.code === "ROOKIE_AGE");
    expect(err?.message).toContain("33");
  });

  it("rifiuta il Veteran a un under 30", () => {
    const r = validateContractSignature({
      type: "VETERAN", salary: M(8), years: 2, seasonStartYear: 2025, playerAge: under23, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("VETERAN_AGE");
  });

  it("blocca la firma se manca l'anagrafica per un contratto che dipende dall'età", () => {
    const r = validateContractSignature({
      type: "VETERAN", salary: M(8), years: 2, seasonStartYear: 2025, playerAge: null, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("VETERAN_AGE_UNKNOWN");
  });

  it("rifiuta importi fuori dal passo di 0,25 M", () => {
    const r = validateContractSignature({
      type: "ANNUALE", salary: M(1.1), years: 1, seasonStartYear: 2025, playerAge: null, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("SALARY_OFF_STEP");
  });

  it("segnala, senza bloccare, uno Standard dove il Rookie converrebbe", () => {
    const r = validateContractSignature({
      type: "STANDARD", salary: M(5), years: 3, seasonStartYear: 2025, playerAge: under23, ruleset: R,
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain("ROOKIE_AVAILABLE");
  });
});

describe("Team Option (art. 6.1)", () => {
  it("aggiunge un anno al +20% sull'ultimo ingaggio", () => {
    const s = buildSalarySchedule({ type: "STANDARD", baseSalary: M(10), years: 2, startYear: 2025, ruleset: R });
    const extended = applyTeamOption(s, R);
    expect(extended).toHaveLength(3);
    expect(toMillions(extended[2].salary)).toBe(13.25); // 11 × 1,2 = 13,2 → 13,25
    expect(extended[2].source).toBe("TEAM_OPTION");
  });

  it("si può applicare più volte, in anni diversi", () => {
    let s = buildSalarySchedule({ type: "STANDARD", baseSalary: M(10), years: 2, startYear: 2025, ruleset: R });
    s = applyTeamOption(s, R);
    s = applyTeamOption(s, R);
    expect(s).toHaveLength(4);
    expect(s[3].year).toBe(2028);
  });
});

describe("Franchise Tag (art. 6.2)", () => {
  it("prende il maggiore tra +20% e la media dei tre ingaggi più alti del ruolo", () => {
    const low = franchiseTagSalary({
      lastSalary: M(20),
      leagueSalariesForRole: [M(10), M(9), M(8), M(2)],
      ruleset: R,
    });
    expect(low.basis).toBe("PREVIOUS_SALARY");
    expect(toMillions(low.salary)).toBe(24);

    const high = franchiseTagSalary({
      lastSalary: M(5),
      leagueSalariesForRole: [M(20), M(18), M(16)],
      ruleset: R,
    });
    expect(high.basis).toBe("ROLE_AVERAGE");
    expect(toMillions(high.salary)).toBe(18);
  });

  it("non si può usare due anni di fila sullo stesso giocatore", () => {
    const r = validateFranchiseTag({
      tagsUsedThisSeason: 0, playerWasTaggedLastSeason: true, contractExpiresThisSeason: true, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("TAG_CONSECUTIVE");
  });

  it("è uno solo per stagione", () => {
    const r = validateFranchiseTag({
      tagsUsedThisSeason: 1, playerWasTaggedLastSeason: false, contractExpiresThisSeason: true, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("TAG_EXHAUSTED");
  });
});

describe("prestito e promozione dalla primavera", () => {
  it("dimezza l'ingaggio da una certa stagione in poi (art. 13.2)", () => {
    const s = buildSalarySchedule({ type: "STANDARD", baseSalary: M(10), years: 3, startYear: 2025, ruleset: R });
    const halved = halveForLoan(s, 2026, R);
    expect(toMillions(halved[0].salary)).toBe(10);
    expect(toMillions(halved[1].salary)).toBe(5.5);
  });

  it("l'ingaggio alla promozione dipende dal turno di chiamata (art. 16.4)", () => {
    expect(toMillions(youthPromotionSalary(1, R))).toBe(0.75);
    expect(toMillions(youthPromotionSalary(5, R))).toBe(0.5);
    expect(toMillions(youthPromotionSalary(11, R))).toBe(0.25);
  });
});

// ─────────────────────────────────────────────────────────────── Tetto salariale

describe("matrice del tetto salariale", () => {
  it("proietta gli ingaggi sulle stagioni future", () => {
    const contracts = [
      contract({ type: "STANDARD", baseSalary: M(10), years: 3, startYear: 2025 }),
      contract({ type: "ANNUALE", baseSalary: M(5), years: 1, startYear: 2025 }),
    ];
    const matrix = buildCapMatrix({ contracts, currentYear: 2025, horizon: 4, ruleset: R });

    expect(matrix[0].label).toBe("2025/26");
    expect(toMillions(matrix[0].committed)).toBe(15);
    expect(toMillions(matrix[1].committed)).toBe(11); // solo lo Standard, al secondo anno
    expect(toMillions(matrix[2].committed)).toBe(12.25);
    expect(matrix[3].playerCount).toBe(0);
  });

  it("imputa il dead cap alla stagione giusta", () => {
    const contracts = [
      contract({ status: "BOUGHT_OUT", deadCapAmount: M(2.5), deadCapYear: 2025, salary: 10 }),
    ];
    const matrix = buildCapMatrix({ contracts, currentYear: 2025, horizon: 2, ruleset: R });
    expect(toMillions(matrix[0].deadCap)).toBe(2.5);
    expect(toMillions(matrix[0].total)).toBe(2.5);
    expect(toMillions(matrix[1].deadCap)).toBe(0);
  });

  it("segnala lo sforamento", () => {
    const contracts = [contract({ salary: 90 })];
    const matrix = buildCapMatrix({ contracts, currentYear: 2025, horizon: 1, ruleset: R });
    expect(matrix[0].overCap).toBe(true);
    expect(toMillions(matrix[0].space)).toBe(-5);
  });
});

describe("validazione della rosa (art. 3)", () => {
  it("accetta una rosa regolare", () => {
    expect(validateRoster({ contracts: fullRoster(1), year: 2025, ruleset: R }).ok).toBe(true);
  });

  it("rifiuta il superamento del tetto e dice di quanto", () => {
    const r = validateRoster({ contracts: fullRoster(4), year: 2025, ruleset: R });
    const err = r.errors.find((e) => e.code === "OVER_CAP");
    expect(err).toBeDefined();
    expect(err?.message).toContain("15"); // 25 × 4 = 100, cioè 15 M oltre gli 85
  });

  it("rifiuta una rosa incompleta a mercato chiuso e la tollera in asta", () => {
    const few = fullRoster(1).slice(0, 20);
    expect(validateRoster({ contracts: few, year: 2025, ruleset: R, strict: true }).ok).toBe(false);
    expect(validateRoster({ contracts: few, year: 2025, ruleset: R, strict: false }).ok).toBe(true);
  });

  it("controlla i minimi di ruolo", () => {
    const noKeepers = fullRoster(1).filter((c) => c.role !== "P");
    const r = validateRoster({ contracts: noKeepers, year: 2025, ruleset: R });
    expect(r.errors.map((e) => e.code)).toContain("ROLE_MIN_P");
  });

  it("conta gli slot pluriennali", () => {
    const contracts = [
      ...Array.from({ length: 9 }, (_, i) =>
        contract({ type: "STANDARD", years: 2, salary: 1, id: `s${i}` }),
      ),
      contract({ type: "ANNUALE", salary: 1 }),
    ];
    expect(freeMultiYearSlots(contracts, 2025, R)).toBe(0);

    const tenth = [...contracts, contract({ type: "STANDARD", years: 2, salary: 1, id: "s9" })];
    expect(validateRoster({ contracts: tenth, year: 2025, ruleset: R, strict: false }).errors.map((e) => e.code))
      .toContain("TOO_MANY_MULTIYEAR");
  });
});

describe("riserva per la rosa minima (art. 8.6)", () => {
  it("impedisce di spendere tutto e restare senza giocatori", () => {
    // 10 giocatori a 1 M: 75 M liberi, ma ne servono 14 × 0,5 = 7 per completare
    const contracts = Array.from({ length: 10 }, (_, i) => contract({ salary: 1, id: `c${i}` }));
    const check = canAfford({ contracts, year: 2025, amount: M(75), ruleset: R });
    expect(check.ok).toBe(false);
    expect(toMillions(check.reserve)).toBe(7);
    expect(toMillions(check.maxAffordable)).toBe(68);
  });

  it("a rosa completa non trattiene nulla", () => {
    const check = canAfford({ contracts: fullRoster(1), year: 2025, amount: M(60), ruleset: R });
    expect(toMillions(check.reserve)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────── Buy-out

describe("buy-out (art. 12)", () => {
  it("un anno residuo costa il 100% e lascia il 25% di dead cap", () => {
    const c = contract({ type: "ANNUALE", baseSalary: M(8), years: 1, startYear: 2025 });
    const q = quoteBuyout({ contract: c, currentYear: 2025, isPerformance: false, ruleset: R });
    expect(toMillions(q.penalty)).toBe(8);
    expect(toMillions(q.deadCap)).toBe(2);
    expect(toMillions(q.capFreedNow)).toBe(6);
  });

  it("tre anni residui costano il 120% del residuo", () => {
    const c = contract({ type: "ROOKIE", baseSalary: M(6), years: 3, startYear: 2025 });
    const q = quoteBuyout({ contract: c, currentYear: 2025, isPerformance: false, ruleset: R });
    expect(q.yearsRemaining).toBe(3);
    expect(toMillions(q.remainingSalary)).toBe(18);
    expect(toMillions(q.penalty)).toBe(21.75); // 18 × 1,2 = 21,6 → 21,75
  });

  it("il performance buy-out dimezza la penale e azzera il dead cap", () => {
    const c = contract({ type: "ANNUALE", baseSalary: M(8), years: 1, startYear: 2025 });
    const q = quoteBuyout({ contract: c, currentYear: 2025, isPerformance: true, ruleset: R });
    expect(toMillions(q.penalty)).toBe(4);
    expect(q.deadCap).toBe(0);
    expect(toMillions(q.capFreedNow)).toBe(8);
  });

  it("il residuo si conta dalla stagione in corso, non dall'inizio del contratto", () => {
    const c = contract({ type: "STANDARD", baseSalary: M(10), years: 3, startYear: 2025 });
    const q = quoteBuyout({ contract: c, currentYear: 2026, isPerformance: false, ruleset: R });
    expect(q.yearsRemaining).toBe(2);
    expect(toMillions(q.remainingSalary)).toBe(23.25); // 11 + 12,25
  });
});

describe("condizioni del performance buy-out (art. 12.4)", () => {
  it("bastano poche presenze", () => {
    const r = checkPerformanceConditions({
      stats: { matchdaysPlayed: 20, appearances: 8, voteSum: 52, consecutiveNoVote: 0 },
      ruleset: R,
    });
    expect(r.eligible).toBe(true);
    expect(r.reasons.map((x) => x.code)).toContain("LOW_APPEARANCES");
  });

  it("basta la media sotto la sufficienza, con almeno 10 presenze", () => {
    const r = checkPerformanceConditions({
      stats: { matchdaysPlayed: 20, appearances: 15, voteSum: 15 * 5.6, consecutiveNoVote: 0 },
      ruleset: R,
    });
    expect(r.eligible).toBe(true);
    expect(r.reasons.map((x) => x.code)).toContain("LOW_AVERAGE");
  });

  it("una media bassa su poche presenze non basta da sola per quella condizione", () => {
    const r = checkPerformanceConditions({
      stats: { matchdaysPlayed: 8, appearances: 6, voteSum: 6 * 5, consecutiveNoVote: 0 },
      ruleset: R,
    });
    expect(r.reasons.map((x) => x.code)).not.toContain("LOW_AVERAGE");
  });

  it("basta l'infortunio prolungato", () => {
    const r = checkPerformanceConditions({
      stats: { matchdaysPlayed: 20, appearances: 15, voteSum: 15 * 6.5, consecutiveNoVote: 6 },
      ruleset: R,
    });
    expect(r.eligible).toBe(true);
    expect(r.reasons.map((x) => x.code)).toContain("INJURY");
  });

  it("un titolare in forma non è svincolabile a metà prezzo", () => {
    const r = checkPerformanceConditions({
      stats: { matchdaysPlayed: 20, appearances: 19, voteSum: 19 * 6.8, consecutiveNoVote: 0 },
      ruleset: R,
    });
    expect(r.eligible).toBe(false);
    expect(r.missing).toHaveLength(3);
  });
});

describe("validazione dello svincolo", () => {
  const c = contract({ type: "ANNUALE", baseSalary: M(8), years: 1, startYear: 2025 });
  const quote = quoteBuyout({ contract: c, currentYear: 2025, isPerformance: false, ruleset: R });

  it("blocca se il Capitale non basta", () => {
    const r = validateBuyout({
      quote, capitalBalance: M(5), performanceBuyoutsUsed: 0, windowOpen: true, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("INSUFFICIENT_CAPITAL");
  });

  it("blocca a finestra chiusa", () => {
    const r = validateBuyout({
      quote, capitalBalance: M(50), performanceBuyoutsUsed: 0, windowOpen: false, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("WINDOW_CLOSED");
  });

  it("avvisa del dead cap quando passa", () => {
    const r = validateBuyout({
      quote, capitalBalance: M(50), performanceBuyoutsUsed: 0, windowOpen: true, ruleset: R,
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain("DEAD_CAP");
  });

  it("rifiuta il performance buy-out senza condizioni soddisfatte", () => {
    const pq = quoteBuyout({ contract: c, currentYear: 2025, isPerformance: true, ruleset: R });
    const check = checkPerformanceConditions({
      stats: { matchdaysPlayed: 20, appearances: 19, voteSum: 19 * 6.8, consecutiveNoVote: 0 },
      ruleset: R,
    });
    const r = validateBuyout({
      quote: pq, capitalBalance: M(50), performanceBuyoutsUsed: 0, windowOpen: true, performanceCheck: check, ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("PERFORMANCE_NOT_ELIGIBLE");
  });
});

// ─────────────────────────────────────────────────────────────── Asta

describe("base d'asta (art. 8.4)", () => {
  it("segue la quotazione Leghe Fantacalcio", () => {
    expect(toMillions(basePriceFor(35, R))).toBe(5);
    expect(toMillions(basePriceFor(25, R))).toBe(4);
    expect(toMillions(basePriceFor(16, R))).toBe(3);
    expect(toMillions(basePriceFor(9, R))).toBe(0.5);
    expect(toMillions(basePriceFor(null, R))).toBe(0.5);
  });
});

describe("apertura delle buste", () => {
  const now = new Date("2025-09-01T20:00:00Z");

  it("assegna all'offerta più alta", () => {
    const out = resolveSealedBids({
      bids: [
        { teamId: "A", amount: M(5), submittedAt: now },
        { teamId: "B", amount: M(7), submittedAt: now },
        { teamId: "C", amount: 0, submittedAt: now },
      ],
      minimum: M(0.5),
      tieBreak: "REPEAT",
    });
    expect(out.winnerId).toBe("B");
    expect(toMillions(out.amount)).toBe(7);
  });

  it("in asta la parità apre uno spareggio", () => {
    const out = resolveSealedBids({
      bids: [
        { teamId: "A", amount: M(7), submittedAt: now },
        { teamId: "B", amount: M(7), submittedAt: now },
      ],
      minimum: M(0.5),
      tieBreak: "REPEAT",
    });
    expect(out.winnerId).toBeNull();
    expect(out.tiedTeamIds.sort()).toEqual(["A", "B"]);
  });

  it("dopo il secondo pareggio decide l'ordine di chiamata (art. 8.5)", () => {
    expect(resolveAuctionTie({ tiedTeamIds: ["C", "A"], callOrder: ["A", "B", "C"] })).toBe("A");
  });

  it("in free agency la parità la vince la peggio classificata (art. 9.4)", () => {
    const out = resolveSealedBids({
      bids: [
        { teamId: "A", amount: M(4), submittedAt: now },
        { teamId: "B", amount: M(4), submittedAt: now },
      ],
      minimum: M(0.5),
      tieBreak: "WORST_STANDING",
      standings: { A: 2, B: 9 },
      years: { A: 2, B: 2 },
    });
    expect(out.winnerId).toBe("B");
  });

  it("in free agency la durata maggiore precede la classifica", () => {
    const out = resolveSealedBids({
      bids: [
        { teamId: "A", amount: M(4), submittedAt: now },
        { teamId: "B", amount: M(4), submittedAt: now },
      ],
      minimum: M(0.5),
      tieBreak: "WORST_STANDING",
      standings: { A: 2, B: 9 },
      years: { A: 3, B: 1 },
    });
    expect(out.winnerId).toBe("A");
  });

  it("se nessuno offre, il giocatore resta libero", () => {
    const out = resolveSealedBids({
      bids: [{ teamId: "A", amount: 0, submittedAt: now }],
      minimum: M(0.5),
      tieBreak: "REPEAT",
    });
    expect(out.winnerId).toBeNull();
    expect(out.tiedTeamIds).toHaveLength(0);
  });
});

describe("validazione dell'offerta d'asta", () => {
  const contracts = Array.from({ length: 10 }, (_, i) => contract({ salary: 1, id: `c${i}` }));

  it("zero è sempre valido: significa non mi interessa", () => {
    expect(validateAuctionBid({ amount: 0, basePrice: M(3), contracts, year: 2025, ruleset: R }).ok).toBe(true);
  });

  it("rifiuta sotto la base d'asta", () => {
    const r = validateAuctionBid({ amount: M(1), basePrice: M(3), contracts, year: 2025, ruleset: R });
    expect(r.errors.map((e) => e.code)).toContain("BELOW_BASE");
  });

  it("rifiuta l'offerta che impedirebbe di completare la rosa", () => {
    const r = validateAuctionBid({ amount: M(75), basePrice: M(0.5), contracts, year: 2025, ruleset: R });
    expect(r.errors.map((e) => e.code)).toContain("RESERVE_VIOLATION");
    expect(r.errors[0].message).toContain("68");
  });
});

describe("estrazioni riproducibili", () => {
  it("lo stesso seme dà lo stesso ordine di chiamata", () => {
    const teams = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    expect(drawCallOrder(teams, "asta-2025")).toEqual(drawCallOrder(teams, "asta-2025"));
    expect(drawCallOrder(teams, "asta-2025")).not.toEqual(drawCallOrder(teams, "asta-2026"));
    expect(drawCallOrder(teams, "asta-2025").sort()).toEqual(teams);
  });

  it("la lotteria del draft favorisce le ultime in classifica", () => {
    const standings = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    let lastGotFirst = 0;
    let firstGotFirst = 0;
    for (let i = 0; i < 400; i += 1) {
      const { order } = drawDraftOrder({ standings, weights: R.youth.lotteryWeights, seed: `s${i}` });
      if (order[0] === "10") lastGotFirst += 1;
      if (order[0] === "1") firstGotFirst += 1;
    }
    expect(lastGotFirst).toBeGreaterThan(firstGotFirst);
    // ...ma non è una certezza: la prima in classifica ogni tanto pesca bene (art. 17.1)
    expect(firstGotFirst).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────── Trade

describe("trade (art. 11.1)", () => {
  function side(teamId: string, contracts: ContractView[], out: ContractView[], capital = M(50)): TradeSide {
    return {
      teamId,
      teamName: teamId,
      contracts,
      capital,
      contractsOut: out,
      picksOut: [],
      capitalOut: 0,
    };
  }

  it("accetta uno scambio alla pari che lascia entrambe in regola", () => {
    const a = fullRoster(1);
    const b = fullRoster(1).map((c) => ({ ...c, id: `b-${c.id}` }));
    // Difensore contro difensore: i minimi di ruolo restano rispettati da entrambe le parti
    const r = validateTrade({
      sideA: side("A", a, [a[10]]),
      sideB: side("B", b, [b[10]]),
      year: 2025,
      ruleset: R,
    });
    expect(r.ok).toBe(true);
    expect(r.effects).toHaveLength(2);
  });

  it("rifiuta lo scambio che scopre un ruolo", () => {
    const a = fullRoster(1);
    const b = fullRoster(1).map((c) => ({ ...c, id: `b-${c.id}` }));
    // a[10] è un difensore, b[11] un centrocampista: A resterebbe con 7 difensori
    const r = validateTrade({
      sideA: side("A", a, [a[10]]),
      sideB: side("B", b, [b[11]]),
      year: 2025,
      ruleset: R,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("ROLE_MIN_D");
  });

  it("rifiuta lo scambio che manda una squadra fuori tetto", () => {
    const a = fullRoster(1); // 25 M
    const b = fullRoster(1).map((c) => ({ ...c, id: `b-${c.id}` }));
    const heavy = contract({ id: "heavy", salary: 70, role: "A" });
    b.push(heavy);

    const r = validateTrade({
      sideA: side("A", a, [a[10]]),
      sideB: side("B", b, [heavy]),
      year: 2025,
      ruleset: R,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "OVER_CAP" && e.message.startsWith("A —"))).toBe(true);
  });

  it("controlla anche le stagioni future toccate dai pluriennali", () => {
    const a = fullRoster(1);
    const b = fullRoster(1).map((c) => ({ ...c, id: `b-${c.id}` }));
    // Contratto che pesa poco quest'anno e moltissimo il prossimo
    const balloon = contract({ id: "bal", type: "STANDARD", baseSalary: M(80), years: 2, startYear: 2025, role: "A" });
    b.push(balloon);

    const r = validateTrade({
      sideA: side("A", a, []),
      sideB: side("B", b, [balloon]),
      year: 2025,
      ruleset: R,
    });
    expect(r.errors.some((e) => e.code === "OVER_CAP")).toBe(true);
  });

  it("rifiuta la cessione di Capitale che non si possiede", () => {
    const a = fullRoster(1);
    const b = fullRoster(1).map((c) => ({ ...c, id: `b-${c.id}` }));
    const sideA = { ...side("A", a, [], M(10)), capitalOut: M(30) };
    const r = validateTrade({ sideA, sideB: side("B", b, [b[0]]), year: 2025, ruleset: R });
    expect(r.errors.map((e) => e.code)).toContain("TRADE_CAPITAL");
  });

  it("segnala lo scambio a senso unico senza vietarlo", () => {
    const a = fullRoster(1);
    const b = fullRoster(1).map((c) => ({ ...c, id: `b-${c.id}` }));
    const r = validateTrade({
      sideA: side("A", a, [a[10]]),
      sideB: side("B", b, []),
      year: 2025,
      ruleset: R,
    });
    expect(r.warnings.map((w) => w.code)).toContain("TRADE_ONE_SIDED");
  });

  it("rifiuta lo scambio vuoto", () => {
    const a = fullRoster(1);
    const b = fullRoster(1).map((c) => ({ ...c, id: `b-${c.id}` }));
    const r = validateTrade({ sideA: side("A", a, []), sideB: side("B", b, []), year: 2025, ruleset: R });
    expect(r.errors.map((e) => e.code)).toContain("TRADE_EMPTY");
  });

  it("il contratto viaggia intatto: nessuna ristrutturazione (art. 5.3)", () => {
    const a = fullRoster(1);
    const b = fullRoster(1).map((c) => ({ ...c, id: `b-${c.id}` }));
    const moved = contract({ id: "mv", type: "STANDARD", baseSalary: M(10), years: 3, startYear: 2025, role: "A" });
    b.push(moved);
    const r = validateTrade({
      sideA: side("A", a, [a[24]]),
      sideB: side("B", b, [moved]),
      year: 2025,
      ruleset: R,
    });
    const effectA = r.effects.find((e) => e.teamId === "A");
    expect(toMillions(effectA!.salaryIn)).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────── Capitale

describe("stadio (art. 15)", () => {
  it("il passaggio di un livello costa la differenza", () => {
    const up = stadiumUpgradeCost({ currentLevel: 1, targetLevel: 2, ruleset: R });
    expect(toMillions(up.cost)).toBe(30);
    expect(up.requiresDemolition).toBe(false);
  });

  it("saltare un livello impone la demolizione e il costo pieno", () => {
    const up = stadiumUpgradeCost({ currentLevel: 1, targetLevel: 3, ruleset: R });
    expect(toMillions(up.cost)).toBe(100);
    expect(up.requiresDemolition).toBe(true);
  });

  it("si costruisce solo in precampionato", () => {
    const r = validateStadiumInvestment({
      currentLevel: 0, targetLevel: 1, capital: M(100), seasonPhase: "REGULAR", ruleset: R,
    });
    expect(r.errors.map((e) => e.code)).toContain("STADIUM_TIMING");
  });

  it("avvisa se dopo l'investimento non resta da pagare la manutenzione", () => {
    const r = validateStadiumInvestment({
      currentLevel: 0, targetLevel: 1, capital: M(31), seasonPhase: "PRESEASON", ruleset: R,
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toContain("STADIUM_MAINTENANCE_RISK");
  });

  it("l'incasso stagionale supera la manutenzione a ogni livello", () => {
    for (const tier of R.capital.stadium) {
      const income = stadiumIncome({
        level: tier.level, builtInYear: 2024, currentYear: 2025,
        homeMatchesPlayed: R.capital.homeMatchesPerSeason, ruleset: R,
      });
      expect(toMillions(income)).toBeGreaterThan(tier.maintenance);
    }
  });
});

describe("settore giovanile e osservatori", () => {
  it("l'ampliamento costa la differenza tra le fasce", () => {
    const up = academyUpgradeCost({ currentCapacity: 3, targetCapacity: 7, ruleset: R });
    expect(toMillions(up.investment)).toBe(7);
    expect(toMillions(up.maintenance)).toBe(1.5);
  });

  it("il bonus Dynasty Youth cresce con la rosa", () => {
    expect(youthCompetitionBonus(3, R)).toBe(0);
    expect(youthCompetitionBonus(5, R)).toBe(0.2);
    expect(youthCompetitionBonus(11, R)).toBe(0.8);
  });

  it("il club batte il campionato nella gerarchia di prelazione", () => {
    const r = resolveScoutingRights({
      scouts: [
        { teamId: "A", league: "Premier League", club: null, investedAt: new Date("2025-01-01") },
        { teamId: "B", league: "Premier League", club: "Everton", investedAt: new Date("2025-06-01") },
      ],
      playerOriginClub: "Everton",
      playerOriginLeague: "Premier League",
    });
    expect(r.holders).toEqual(["B"]);
    expect(r.basis).toBe("CLUB");
  });

  it("a parità di livello vince chi ha investito prima", () => {
    const r = resolveScoutingRights({
      scouts: [
        { teamId: "A", league: "La Liga", club: null, investedAt: new Date("2025-01-01") },
        { teamId: "B", league: "La Liga", club: null, investedAt: new Date("2025-02-01") },
      ],
      playerOriginClub: "Girona",
      playerOriginLeague: "La Liga",
    });
    expect(r.holders).toEqual(["A"]);
    expect(r.restrictedAuction).toBe(false);
  });

  it("investimenti simultanei aprono l'asta ristretta", () => {
    const at = new Date("2025-01-01");
    const r = resolveScoutingRights({
      scouts: [
        { teamId: "A", league: "Ligue 1", club: null, investedAt: at },
        { teamId: "B", league: "Ligue 1", club: null, investedAt: at },
      ],
      playerOriginClub: "Lens",
      playerOriginLeague: "Ligue 1",
    });
    expect(r.holders.sort()).toEqual(["A", "B"]);
    expect(r.restrictedAuction).toBe(true);
  });

  it("nessun osservatore, nessun diritto", () => {
    const r = resolveScoutingRights({ scouts: [], playerOriginClub: "Ajax", playerOriginLeague: "Eredivisie" });
    expect(r.basis).toBe("NONE");
  });
});

describe("premi e sponsor", () => {
  it("i premi di campionato seguono la posizione", () => {
    expect(toMillions(competitionPrize({ kind: "APERTURA", position: 1, ruleset: R }))).toBe(27);
    expect(toMillions(competitionPrize({ kind: "CLAUSURA", position: 10, ruleset: R }))).toBe(10);
    expect(competitionPrize({ kind: "APERTURA", position: 11, ruleset: R })).toBe(0);
  });

  it("le proposte sponsor sono deterministiche sul seme", () => {
    const a = generateSponsorOffers({ previousPosition: 2, seed: "team-A-2025", ruleset: R });
    const b = generateSponsorOffers({ previousPosition: 2, seed: "team-A-2025", ruleset: R });
    expect(a).toEqual(b);
    expect(a).toHaveLength(R.sponsors.offersPerSeason);
  });

  it("chi è arrivato in alto riceve proposte più ricche", () => {
    const top = generateSponsorOffers({ previousPosition: 1, seed: "x", ruleset: R });
    const bottom = generateSponsorOffers({ previousPosition: 10, seed: "x", ruleset: R });
    const avg = (offers: typeof top) => offers.reduce((a, o) => a + o.annualFee, 0) / offers.length;
    expect(avg(top)).toBeGreaterThan(avg(bottom));
  });

  it("le proposte non si ripetono nello stesso giro", () => {
    const offers = generateSponsorOffers({ previousPosition: 5, seed: "y", ruleset: R });
    expect(new Set(offers.map((o) => o.name)).size).toBe(offers.length);
  });
});

// ───────────────────────────────────────────── Settore giovanile (art. 16.1)

describe("idoneità al settore giovanile", () => {
  const anno = 2026;

  it("accetta chi rispetta tutti e tre i requisiti", () => {
    const esito = youthEligibility(
      { età: 2026 - 2007, appearances: 2, quotation: fromMillions(4) },
      anno,
      DEFAULT_RULESET,
    );
    expect(esito.stato).toBe("IDONEO");
    expect(esito.motivi).toEqual([]);
  });

  it("rifiuta chi ha superato l'età", () => {
    const esito = youthEligibility(
      { età: 2026 - 2000, appearances: 0, quotation: fromMillions(1) },
      anno,
      DEFAULT_RULESET,
    );
    expect(esito.stato).toBe("NON_IDONEO");
    expect(esito.motivi[0]).toContain("anni");
  });

  it("rifiuta chi ha troppe presenze", () => {
    const esito = youthEligibility(
      { età: 2026 - 2007, appearances: 12, quotation: fromMillions(1) },
      anno,
      DEFAULT_RULESET,
    );
    expect(esito.stato).toBe("NON_IDONEO");
    expect(esito.motivi[0]).toContain("presenze");
  });

  it("rifiuta chi è quotato troppo, anche se giovanissimo", () => {
    const esito = youthEligibility(
      { età: 2026 - 2008, appearances: 0, quotation: fromMillions(12) },
      anno,
      DEFAULT_RULESET,
    );
    expect(esito.stato).toBe("NON_IDONEO");
    expect(esito.motivi[0]).toContain("quotato");
  });

  // È il caso che si presenta il primo giorno di lega, su cinquecento giocatori.
  it("senza data di nascita non dice né sì né no", () => {
    const esito = youthEligibility(
      { età: null, appearances: 0, quotation: fromMillions(2) },
      anno,
      DEFAULT_RULESET,
    );
    expect(esito.stato).toBe("DA_VERIFICARE");
    expect(esito.motivi.join(" ")).toContain("età");
  });

  // Un requisito violato basta: non serve sapere gli altri per rispondere no.
  it("un requisito violato batte un requisito ignoto", () => {
    const esito = youthEligibility(
      { età: null, appearances: null, quotation: fromMillions(20) },
      anno,
      DEFAULT_RULESET,
    );
    expect(esito.stato).toBe("NON_IDONEO");
  });

  it("il limite di età è compreso", () => {
    // Vent'anni esatti al 1° settembre: dentro.
    const esito = youthEligibility(
      { età: 2026 - 2006, appearances: 0, quotation: fromMillions(1) },
      anno,
      DEFAULT_RULESET,
    );
    expect(esito.requisiti.età.valore).toBe(20);
    expect(esito.stato).toBe("IDONEO");
  });

  it("distingue «nessun voto importato» da «zero presenze»", () => {
    expect(presenzeNote(0, null)).toBeNull();
    expect(presenzeNote(3, null)).toBe(0);
    expect(presenzeNote(3, 2)).toBe(2);
  });
});

// ─────────────────────────────────────── Da dove si sa quanti anni ha uno

describe("età alla stagione", () => {
  const nascita = new Date(Date.UTC(2004, 0, 1)); // 21 anni al 1/9/2025

  it("la data di nascita, quando c'è, decide lei", () => {
    expect(etàAllaStagione({ birthDate: nascita }, 2025, R)).toBe(21);
  });

  it("e batte l'età dichiarata anche se discordano", () => {
    // Il listone stampa un numero, l'anagrafica una data: la data è esatta.
    expect(etàAllaStagione({ birthDate: nascita, declaredAge: 40, declaredAgeYear: 2025 }, 2025, R)).toBe(21);
  });

  it("senza data vale l'età dichiarata", () => {
    expect(etàAllaStagione({ declaredAge: 27, declaredAgeYear: 2026 }, 2026, R)).toBe(27);
  });

  it("che invecchia di un anno per stagione", () => {
    expect(etàAllaStagione({ declaredAge: 27, declaredAgeYear: 2026 }, 2029, R)).toBe(30);
  });

  it("e ringiovanisce guardando indietro", () => {
    expect(etàAllaStagione({ declaredAge: 27, declaredAgeYear: 2026 }, 2024, R)).toBe(25);
  });

  it("senza niente non si inventa un numero", () => {
    expect(etàAllaStagione({}, 2026, R)).toBeNull();
    expect(etàAllaStagione({ birthDate: null, declaredAge: null }, 2026, R)).toBeNull();
  });

  // Il listone stampa l'età al 2 settembre, il regolamento la calcola al 1°:
  // un giorno di scarto che non deve produrre un anno di differenza.
  it("l'età dichiarata e quella calcolata coincidono alla data di riferimento", () => {
    const chiCompieOggi = new Date(Date.UTC(1999, 7, 27)); // 27 agosto 1999
    expect(etàAllaStagione({ birthDate: chiCompieOggi }, 2026, R)).toBe(27);
    expect(etàAllaStagione({ declaredAge: 27, declaredAgeYear: 2026 }, 2026, R)).toBe(27);
  });

  // Il punto di tutta la faccenda: l'età presa dal listone deve *decidere*, non
  // solo comparire. Nessun giocatore ha la data di nascita — la lega non ce
  // l'ha — eppure Rookie e Veteran devono sapere chi possono coprire.
  it("l'età del listone comanda i contratti che dipendono dall'età", () => {
    const dalListone = (età: number) => etàAllaStagione({ declaredAge: età, declaredAgeYear: 2026 }, 2026, R);

    const ventisettenne = validateContractSignature({
      type: "ROOKIE", salary: M(5), years: 3, seasonStartYear: 2026, playerAge: dalListone(27), ruleset: R,
    });
    expect(ventisettenne.ok).toBe(false);
    expect(ventisettenne.errors.find((e) => e.code === "ROOKIE_AGE")?.message).toContain("27");

    const ventiduenne = validateContractSignature({
      type: "ROOKIE", salary: M(5), years: 3, seasonStartYear: 2026, playerAge: dalListone(22), ruleset: R,
    });
    expect(ventiduenne.ok).toBe(true);

    // E il Veteran dall'altra parte della stessa riga.
    expect(
      validateContractSignature({
        type: "VETERAN", salary: M(8), years: 2, seasonStartYear: 2026, playerAge: dalListone(33), ruleset: R,
      }).ok,
    ).toBe(true);
  });

  // Un anno dopo il listone è vecchio di una stagione: l'età va invecchiata con
  // lui, altrimenti a giugno 2027 un ventitreenne risulterebbe ancora Rookie.
  it("l'età invecchia insieme alla stagione", () => {
    const nel2027 = etàAllaStagione({ declaredAge: 22, declaredAgeYear: 2026 }, 2027, R);
    expect(nel2027).toBe(23);
    expect(
      validateContractSignature({
        type: "ROOKIE", salary: M(5), years: 3, seasonStartYear: 2027, playerAge: nel2027, ruleset: R,
      }).ok,
    ).toBe(false);
  });
});
