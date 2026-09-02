import bcrypt from "bcryptjs";

// Import relativi e non con l'alias «@/»: questo modulo gira sia dentro Next
// sia da riga di comando col seed, e fuori da Next l'alias non è risolto.
import listone from "../../data/listone-2026-27.json";
import type { PrismaClient } from "../../generated/prisma/client";
import { fromMillions, toDecimalString, type Money } from "../money";
import { DEFAULT_RULESET } from "../ruleset";
import { basePriceFor, drawCallOrder } from "../rules/auction";
import { buildSalarySchedule } from "../rules/contracts";
import type { ContractType, PlayerRole } from "../rules/types";

/**
 * Prepara una lega da zero: squadre, manager, listone, rose iniziali,
 * finestre di mercato, draft e competizioni.
 *
 * Sta qui e non dentro `prisma/seed.ts` perché serve in due posti: da riga di
 * comando in sviluppo, e dalla rotta di inizializzazione quando la lega viene
 * pubblicata e il database è vuoto. Il listone arriva da un JSON committato,
 * non dal foglio di calcolo: una funzione serverless non ha quel file accanto
 * a sé, e questi dati non cambiano dopo la generazione.
 */

const R = DEFAULT_RULESET;

interface GiocatoreListone {
  lfcId: number;
  nome: string;
  ruolo: string;
  mantra: string[];
  squadra: string;
  quotazione: number;
  quotazioneIniziale: number;
  fvm: number;
}

const LISTONE = listone as { stagione: string; annoInizio: number; giocatori: GiocatoreListone[] };

/** Squadre segnaposto: si rinominano alla prima riunione di lega. */
const SQUADRE = [
  { name: "AS Sorata", short: "SOR", color: "#C2410C" },
  { name: "Real Marasca", short: "MRS", color: "#1D4ED8" },
  { name: "Atletico Buranello", short: "BUR", color: "#047857" },
  { name: "FC Malvasia", short: "MLV", color: "#7C3AED" },
  { name: "Sporting Verzura", short: "VRZ", color: "#B91C1C" },
  { name: "Unione Calanca", short: "CLN", color: "#0F766E" },
  { name: "Nuova Pontelabbro", short: "PNT", color: "#A16207" },
  { name: "Virtus Ardesia", short: "ARD", color: "#374151" },
  { name: "Olimpia Sarmento", short: "SRM", color: "#BE185D" },
  { name: "Città di Nevalta", short: "NVL", color: "#0369A1" },
];

export interface SeedOptions {
  /** Indirizzo del commissioner */
  commissionerEmail: string;
  /**
   * Password da assegnare a tutti. Se manca se ne genera una diversa per
   * ciascuno: è quello che si vuole in produzione, dove le credenziali si
   * mostrano una volta sola e non restano scritte da nessuna parte.
   */
  password?: string;
  /** Dominio degli indirizzi dei manager */
  managerDomain?: string;
  /** Seme dell'estrazione: lo stesso seme dà la stessa lega */
  seed?: number;
}

export interface SeedResult {
  league: string;
  season: string;
  teams: number;
  players: number;
  contracts: number;
  /** Credenziali generate, da mostrare una volta sola */
  credentials: { role: string; team: string | null; email: string; password: string }[];
}

/** Generatore deterministico: lo stesso seme produce sempre la stessa lega. */
function creaRandom(seme: number) {
  let stato = seme;
  return () => {
    stato = (stato * 1103515245 + 12345) % 2147483648;
    return stato / 2147483648;
  };
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Password leggibile ma non indovinabile: quattro gruppi di quattro caratteri. */
function generaPassword(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const caratteri = [...bytes].map((b) => alfabeto[b % alfabeto.length]);
  return [0, 4, 8, 12].map((i) => caratteri.slice(i, i + 4).join("")).join("-");
}

/**
 * Costruisce una rosa da 25 giocatori sotto il tetto, rispettando i minimi di
 * ruolo. Non è un'asta simulata: è una rosa plausibile da cui partire, che i
 * manager rifaranno all'asta di settembre.
 *
 * Solo contratti Annuali e Standard: Rookie e Veteran dipendono dall'età, e il
 * listone non porta le date di nascita (art. 4.2). Arrivano con l'import
 * Transfermarkt.
 */
function costruisciRosa(
  pool: GiocatoreListone[],
  presi: Set<number>,
  rnd: () => number,
  anno: number,
) {
  const servono: [PlayerRole, number][] = [["P", 3], ["D", 8], ["C", 8], ["A", 6]];
  const scelte: { giocatore: GiocatoreListone; salary: Money; type: ContractType; years: number }[] = [];
  const cap = fromMillions(R.roster.salaryCap);
  let speso = 0;
  let pluriennali = 0;

  for (const [ruolo, quanti] of servono) {
    for (let i = 0; i < quanti; i += 1) {
      const disponibili = pool.filter((p) => p.ruolo === ruolo && !presi.has(p.lfcId));
      if (disponibili.length === 0) break;

      // La prima scelta di ogni ruolo è la più costosa, poi si scende
      const costoso = i === 0 && rnd() > 0.4;
      const ordinati = [...disponibili].sort((a, b) => b.quotazione - a.quotazione);
      const fascia = costoso ? ordinati.slice(0, 12) : ordinati.slice(15);
      const giocatore = (fascia.length ? fascia : ordinati)[Math.floor(rnd() * (fascia.length ? fascia.length : ordinati.length))];
      if (!giocatore) break;

      const base = basePriceFor(giocatore.quotazione, R);
      const moltiplicatore = costoso ? 1.4 + rnd() * 1.8 : 1 + rnd() * 0.6;
      let salary = Math.max(fromMillions(0.5), Math.round((base * moltiplicatore) / 25) * 25);

      // Non sforare: se non resta spazio per completare la rosa, si prende al minimo
      const mancanti = 25 - scelte.length - 1;
      const riserva = mancanti * fromMillions(0.5);
      if (speso + salary + riserva > cap) salary = fromMillions(0.5);

      let type: ContractType = "ANNUALE";
      let years = 1;
      if (pluriennali < 7 && rnd() > 0.55) {
        type = "STANDARD";
        years = 2 + Math.floor(rnd() * 2);
        pluriennali += 1;
      }

      presi.add(giocatore.lfcId);
      scelte.push({ giocatore, salary, type, years });
      speso += salary;
    }
  }

  void anno;
  return scelte;
}

/** Svuota la lega. Non si usa in produzione se non su richiesta esplicita. */
export async function wipeLeague(db: PrismaClient): Promise<void> {
  await db.$transaction([
    db.auditEntry.deleteMany(),
    db.matchdayVote.deleteMany(),
    db.playerSeason.deleteMany(),
    db.tradeItem.deleteMany(),
    db.trade.deleteMany(),
    db.waiverClaim.deleteMany(),
    db.marketOffer.deleteMany(),
    db.marketWindow.deleteMany(),
    db.auctionBid.deleteMany(),
    db.auctionLot.deleteMany(),
    db.auction.deleteMany(),
    db.draftPick.deleteMany(),
    db.draft.deleteMany(),
    db.youthPlayer.deleteMany(),
    db.contractEvent.deleteMany(),
    db.contract.deleteMany(),
    db.optionUsage.deleteMany(),
    db.capitalTransaction.deleteMany(),
    db.stadium.deleteMany(),
    db.academy.deleteMany(),
    db.scout.deleteMany(),
    db.sponsorship.deleteMany(),
    db.standingRow.deleteMany(),
    db.fixture.deleteMany(),
    db.competition.deleteMany(),
    db.importRun.deleteMany(),
    db.user.deleteMany(),
    db.player.deleteMany(),
    db.team.deleteMany(),
    db.season.deleteMany(),
    db.league.deleteMany(),
  ]);
}

export async function seedLeague(db: PrismaClient, options: SeedOptions): Promise<SeedResult> {
  const anno = LISTONE.annoInizio;
  const rnd = creaRandom(options.seed ?? anno * 10000 + 901);
  const dominio = options.managerDomain ?? "dynasty.it";
  const credentials: SeedResult["credentials"] = [];

  const league = await db.league.create({
    data: { name: "Dynasty League", slug: "dynasty", ruleset: R as never },
  });

  const season = await db.season.create({
    data: {
      leagueId: league.id,
      label: LISTONE.stagione,
      startYear: anno,
      phase: "PRESEASON",
      isCurrent: true,
      matchday: 0,
    },
  });

  const teams = [];
  for (const t of SQUADRE) {
    teams.push(
      await db.team.create({
        data: { leagueId: league.id, name: t.name, shortName: t.short, color: t.color },
      }),
    );
  }

  // Utenti. Le password si generano qui e si restituiscono una volta sola:
  // nel database resta solo l'impronta.
  const passwordCommissioner = options.password ?? generaPassword();
  await db.user.create({
    data: {
      leagueId: league.id,
      email: options.commissionerEmail.toLowerCase(),
      name: "Commissioner",
      passwordHash: await bcrypt.hash(passwordCommissioner, 12),
      role: "COMMISSIONER",
    },
  });
  credentials.push({
    role: "COMMISSIONER",
    team: null,
    email: options.commissionerEmail.toLowerCase(),
    password: passwordCommissioner,
  });

  for (const [i, team] of teams.entries()) {
    const email = `manager${i + 1}@${dominio}`;
    const password = options.password ?? generaPassword();
    await db.user.create({
      data: {
        leagueId: league.id,
        email,
        name: `Manager ${team.shortName}`,
        passwordHash: await bcrypt.hash(password, 12),
        role: "MANAGER",
        teamId: team.id,
      },
    });
    credentials.push({ role: "MANAGER", team: team.name, email, password });
  }

  // Listone
  await db.player.createMany({
    data: LISTONE.giocatori.map((p) => ({
      lfcId: p.lfcId,
      name: p.nome,
      normalizedName: normalize(p.nome),
      role: p.ruolo as PlayerRole,
      mantraRoles: p.mantra,
      serieATeam: p.squadra,
    })),
  });
  const players = await db.player.findMany({ select: { id: true, lfcId: true } });
  const perLfcId = new Map(players.map((p) => [p.lfcId as number, p.id]));

  await db.playerSeason.createMany({
    data: LISTONE.giocatori.map((p) => ({
      playerId: perLfcId.get(p.lfcId) as string,
      seasonId: season.id,
      quotationInitial: toDecimalString(fromMillions(p.quotazioneIniziale)),
      quotationCurrent: toDecimalString(fromMillions(p.quotazione)),
    })),
  });

  // Rose iniziali
  const presi = new Set<number>();
  let contratti = 0;
  for (const team of teams) {
    for (const scelta of costruisciRosa(LISTONE.giocatori, presi, rnd, anno)) {
      const schedule = buildSalarySchedule({
        type: scelta.type,
        baseSalary: scelta.salary,
        years: scelta.years,
        startYear: anno,
        ruleset: R,
      });

      const contract = await db.contract.create({
        data: {
          teamId: team.id,
          playerId: perLfcId.get(scelta.giocatore.lfcId) as string,
          seasonId: season.id,
          type: scelta.type,
          baseSalary: toDecimalString(scelta.salary),
          years: scelta.years,
          startYear: anno,
          endYear: anno + scelta.years - 1,
          salarySchedule: schedule.map((r) => ({ year: r.year, salary: r.salary, source: r.source })) as never,
        },
      });

      await db.contractEvent.create({
        data: {
          contractId: contract.id,
          type: "SIGNED",
          effectiveYear: anno,
          amountAfter: toDecimalString(scelta.salary),
          note: `${scelta.type} di ${scelta.years} ${scelta.years === 1 ? "anno" : "anni"}`,
        },
      });
      contratti += 1;
    }

    await db.capitalTransaction.create({
      data: {
        teamId: team.id,
        seasonId: season.id,
        amount: toDecimalString(fromMillions(R.capital.initialEndowment)),
        kind: "INITIAL_ENDOWMENT",
        description: "Dotazione iniziale (art. 14)",
      },
    });
    await db.stadium.create({ data: { teamId: team.id, seasonId: season.id, level: 0 } });
    await db.academy.create({ data: { teamId: team.id, seasonId: season.id, capacity: R.youth.baseCapacity } });
  }

  // Finestre di mercato
  const date: Record<string, [Date, Date]> = {
    SETTEMBRE: [new Date(`${anno}-08-25`), new Date(`${anno}-09-30`)],
    NOVEMBRE: [new Date(`${anno}-11-10`), new Date(`${anno}-11-20`)],
    GENNAIO: [new Date(`${anno + 1}-01-10`), new Date(`${anno + 1}-01-31`)],
    MARZO: [new Date(`${anno + 1}-03-10`), new Date(`${anno + 1}-03-20`)],
  };
  for (const w of R.market.windows) {
    const [opensAt, closesAt] = date[w.kind];
    await db.marketWindow.create({
      data: {
        seasonId: season.id,
        kind: w.kind,
        label: w.label,
        opensAt,
        closesAt,
        status: w.kind === "SETTEMBRE" ? "OPEN" : "SCHEDULED",
      },
    });
  }

  // Asta e draft
  const callOrder = drawCallOrder(teams.map((t) => t.id), `asta-${season.id}`);
  await db.auction.create({
    data: {
      seasonId: season.id,
      status: "SCHEDULED",
      callOrder,
      bidWindowSeconds: R.auction.bidWindowSeconds,
    },
  });

  const draft = await db.draft.create({
    data: { seasonId: season.id, status: "SCHEDULED", lotterySeed: `draft-${season.id}` },
  });
  for (let round = 1; round <= 3; round += 1) {
    for (const [i, teamId] of callOrder.entries()) {
      await db.draftPick.create({
        data: {
          draftId: draft.id,
          teamId,
          originalTeamId: teamId,
          round,
          pickNumber: (round - 1) * teams.length + i + 1,
          forYear: anno,
        },
      });
    }
  }

  // Competizioni
  const competizioni = [
    { kind: "APERTURA" as const, name: "Dynasty Apertura", prizeTable: R.competitions.apertura.prizes, cash: R.competitions.cash.apertura },
    { kind: "CLAUSURA" as const, name: "Dynasty Clausura", prizeTable: R.competitions.clausura.prizes, cash: R.competitions.cash.clausura },
    { kind: "DYNASTY_CUP" as const, name: "Dynasty Cup", prizeTable: R.competitions.dynastyCup, cash: R.competitions.cash.dynastyCup },
    { kind: "SUPER_CUP" as const, name: "Super Cup", prizeTable: R.competitions.superCup, cash: R.competitions.cash.superCup },
    { kind: "DYNASTY_YOUTH" as const, name: "Dynasty Youth", prizeTable: R.competitions.dynastyYouth.prizes, cash: R.competitions.cash.dynastyYouth },
  ];
  for (const c of competizioni) {
    await db.competition.create({
      data: {
        seasonId: season.id,
        kind: c.kind,
        name: c.name,
        status: "SCHEDULED",
        prizeTable: c.prizeTable as never,
        cashPrizeTable: c.cash as never,
      },
    });
  }

  return {
    league: league.name,
    season: season.label,
    teams: teams.length,
    players: LISTONE.giocatori.length,
    contracts: contratti,
    credentials,
  };
}
