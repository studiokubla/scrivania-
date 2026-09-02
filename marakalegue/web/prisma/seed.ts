/**
 * Popola il database con una lega dimostrativa completa.
 *
 * I nomi dei calciatori sono **inventati**, di proposito: i dati veri arrivano
 * dall'import ufficiale di Leghe Fantacalcio, e una rosa demo con nomi reali e
 * quotazioni inventate si confonderebbe con quella buona. I club di Serie A sono
 * invece quelli veri, perché servono a rendere leggibile la riconciliazione.
 *
 *   npm run db:seed
 */

import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { fromMillions, toDecimalString, type Money } from "../src/lib/money";
import { DEFAULT_RULESET } from "../src/lib/ruleset";
import { buildSalarySchedule } from "../src/lib/rules/contracts";
import { basePriceFor, drawCallOrder } from "../src/lib/rules/auction";
import type { ContractType, PlayerRole } from "../src/lib/rules/types";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const R = DEFAULT_RULESET;
const YEAR = 2025;

// Generatore deterministico: lo stesso seed produce sempre la stessa lega demo,
// così i test manuali sono ripetibili.
let state = 20250901;
function rnd(): number {
  state = (state * 1103515245 + 12345) % 2147483648;
  return state / 2147483648;
}
function pick<T>(items: T[]): T {
  return items[Math.floor(rnd() * items.length)];
}
function between(min: number, max: number): number {
  return min + rnd() * (max - min);
}

const SERIE_A = [
  "Atalanta", "Bologna", "Cagliari", "Como", "Empoli", "Fiorentina", "Genoa", "Inter",
  "Juventus", "Lazio", "Lecce", "Milan", "Monza", "Napoli", "Parma", "Roma",
  "Torino", "Udinese", "Venezia", "Verona",
];

const FOREIGN = [
  { league: "Premier League", clubs: ["Everton", "Brentford", "Fulham", "Southampton"] },
  { league: "La Liga", clubs: ["Girona", "Osasuna", "Getafe", "Celta Vigo"] },
  { league: "Bundesliga", clubs: ["Augsburg", "Mainz", "Werder Brema", "Bochum"] },
  { league: "Ligue 1", clubs: ["Lens", "Reims", "Tolosa", "Nantes"] },
  { league: "Eredivisie", clubs: ["AZ Alkmaar", "Twente", "Utrecht", "Feyenoord"] },
  { league: "Primeira Liga", clubs: ["Braga", "Vitoria Guimaraes", "Boavista", "Famalicao"] },
  { league: "Serie B", clubs: ["Palermo", "Sampdoria", "Cremonese", "Bari"] },
  { league: "Brasileirão", clubs: ["Palmeiras", "Flamengo", "Gremio", "Internacional"] },
  { league: "Primera División", clubs: ["River Plate", "Boca Juniors", "Racing", "Velez"] },
];

const NOMI = [
  "Adriano", "Alberto", "Alessio", "Andrea", "Antonio", "Bruno", "Carlo", "Cesare", "Dario",
  "Davide", "Diego", "Edoardo", "Elia", "Emanuele", "Enrico", "Fabio", "Federico", "Filippo",
  "Francesco", "Gabriele", "Giacomo", "Gianluca", "Giorgio", "Giovanni", "Giulio", "Guido",
  "Ivan", "Jacopo", "Leonardo", "Lorenzo", "Luca", "Marco", "Mattia", "Maurizio", "Michele",
  "Nicola", "Paolo", "Pietro", "Riccardo", "Roberto", "Samuele", "Sergio", "Simone", "Stefano",
  "Tommaso", "Valerio", "Vittorio", "Alvaro", "Mateo", "Joel", "Ousmane", "Nuno", "Kevin",
];

const COGNOMI = [
  "Aliprandi", "Bastianelli", "Beltrame", "Bonaventura", "Cadorin", "Calvani", "Carnesecchi",
  "Cattaneo", "Cerruti", "Chiodini", "Colombera", "Dal Pozzo", "Danesi", "De Bortoli",
  "Fabbrini", "Falzone", "Ferraresi", "Fiorentini", "Gagliardo", "Garbin", "Giannotti",
  "Guerrieri", "Innocenti", "Lazzarini", "Lombardo", "Maggiolo", "Malaspina", "Mancinelli",
  "Marcheselli", "Melandri", "Micheletti", "Monteverdi", "Nardini", "Olivotto", "Padovani",
  "Pagliaro", "Pellizzari", "Perotti", "Pignatelli", "Quadrelli", "Ravasi", "Rigamonti",
  "Rovelli", "Sabatini", "Salvestrini", "Sartori", "Scarpellini", "Sgarbi", "Solimena",
  "Tagliabue", "Tessaro", "Toscani", "Trevisani", "Vaccaro", "Vanzetti", "Zaffaroni",
  "Zanchetta", "Zerbini", "Ziliani", "Bordignon", "Cristofori", "Della Valle", "Ercolani",
  "Fontanelli", "Grimaldi", "Lanzoni", "Mazzocchi", "Nicoletti", "Ongaro", "Petrucci",
  "Roverato", "Silvestrini", "Turrini", "Vergani",
];

const SQUADRE = [
  { name: "AS Sorata", short: "SOR", color: "#C2410C" },
  { name: "Real Marasca", short: "MRS", color: "#1D4ED8" },
  { name: "Atletico Buranello", short: "BUR", color: "#047857" },
  { name: "FC Malvasia", short: "MLV", color: "#7C3AED" },
  { name: "Sporting Verzura", short: "VRZ", color: "#B91C1C" },
  { name: "Unione Calanca", short: "CLN", color: "#0F766E" },
  { name: "Nuova Pontelabbro", short: "PNT", color: "#A16207" },
  { name: "Virtus Ardesia", short: "ARD", color: "#374151" },
  { name: "Olimpia Sarmento", short: "SRM", color: "#BE185D", },
  { name: "Città di Nevalta", short: "NVL", color: "#0369A1" },
];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface SeedPlayer {
  lfcId: number;
  name: string;
  role: PlayerRole;
  serieATeam: string;
  birthDate: Date;
  quotation: number;
  tmMarketValue: bigint;
  originLeague: string | null;
  originClub: string | null;
  nationality: string;
}

function makePlayers(): SeedPlayer[] {
  const players: SeedPlayer[] = [];
  const used = new Set<string>();
  let lfcId = 1000;

  // Distribuzione simile a quella del listone: molti difensori e centrocampisti
  const plan: [PlayerRole, number][] = [
    ["P", 60],
    ["D", 130],
    ["C", 130],
    ["A", 80],
  ];

  for (const [role, count] of plan) {
    for (let i = 0; i < count; i += 1) {
      let name = `${pick(COGNOMI)} ${pick(NOMI)[0]}.`;
      let guard = 0;
      while (used.has(name) && guard < 50) {
        name = `${pick(COGNOMI)} ${pick(NOMI)[0]}.`;
        guard += 1;
      }
      if (used.has(name)) name = `${name}${i}`;
      used.add(name);

      // Pochi giocatori di fascia alta, molti da listone
      const roll = rnd();
      const quotation =
        roll > 0.95 ? Math.round(between(28, 40)) :
        roll > 0.85 ? Math.round(between(18, 28)) :
        roll > 0.6 ? Math.round(between(9, 18)) :
        Math.round(between(1, 9));

      const age = Math.round(between(17, 38));
      const foreign = rnd() > 0.55 ? pick(FOREIGN) : null;

      players.push({
        lfcId: (lfcId += 1),
        name,
        role,
        serieATeam: pick(SERIE_A),
        birthDate: new Date(Date.UTC(YEAR - age, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))),
        quotation,
        tmMarketValue: BigInt(Math.round(quotation * between(0.6, 1.8)) * 1_000_000),
        originLeague: foreign?.league ?? null,
        originClub: foreign ? pick(foreign.clubs) : null,
        nationality: foreign ? "Estero" : "Italia",
      });
    }
  }
  return players;
}

/**
 * Costruisce una rosa da 25 giocatori sotto gli 85 M, con qualche pluriennale.
 * Non è un'asta simulata: è una rosa plausibile su cui provare l'interfaccia.
 */
function buildRoster(pool: SeedPlayer[], taken: Set<number>) {
  // Deve rispettare i minimi di ruolo dell'art. 3.1: 3 P, 8 D, 8 C, 6 A
  const need: [PlayerRole, number][] = [["P", 3], ["D", 8], ["C", 8], ["A", 6]];
  const picks: { player: SeedPlayer; salary: Money; type: ContractType; years: number }[] = [];
  let spent = 0;
  const cap = fromMillions(R.roster.salaryCap);
  let multiYear = 0;

  for (const [role, count] of need) {
    const candidates = pool.filter((p) => p.role === role && !taken.has(p.lfcId));
    for (let i = 0; i < count; i += 1) {
      // Le prime scelte di ogni ruolo sono le più costose, poi si scende
      const wantExpensive = i === 0 && rnd() > 0.4;
      const sorted = [...candidates].sort((a, b) => b.quotation - a.quotation);
      const slice = wantExpensive ? sorted.slice(0, 12) : sorted.slice(15);
      const player = slice.length ? pick(slice) : sorted[0];
      if (!player || taken.has(player.lfcId)) {
        i -= 1;
        continue;
      }

      const base = basePriceFor(player.quotation, R);
      const multiplier = wantExpensive ? between(1.4, 3.2) : between(1, 1.6);
      let salary = Math.max(fromMillions(0.5), Math.round((base * multiplier) / 25) * 25);

      // Non sforare: se non c'è spazio, si prende al minimo
      const slotsLeft = 25 - picks.length - 1;
      const reserve = slotsLeft * fromMillions(0.5);
      if (spent + salary + reserve > cap) salary = fromMillions(0.5);

      const age = YEAR - player.birthDate.getUTCFullYear();
      let type: ContractType = "ANNUALE";
      let years = 1;

      if (multiYear < 7 && rnd() > 0.55) {
        if (age <= R.contracts.ROOKIE.maxAge && salary <= fromMillions(R.contracts.ROOKIE.maxSalary)) {
          type = "ROOKIE";
          years = 2 + Math.floor(rnd() * 3);
        } else if (age >= R.contracts.VETERAN.minAge && salary <= fromMillions(R.contracts.VETERAN.maxSalary)) {
          type = "VETERAN";
          years = 2;
        } else {
          type = "STANDARD";
          years = 2 + Math.floor(rnd() * 2);
        }
        multiYear += 1;
      }

      taken.add(player.lfcId);
      picks.push({ player, salary, type, years });
      spent += salary;
    }
  }
  return picks;
}

async function main() {
  console.log("Pulizia del database…");
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

  console.log("Lega e stagione…");
  const league = await db.league.create({
    data: { name: "Marakalegue", slug: "marakalegue", ruleset: R as never },
  });

  const season = await db.season.create({
    data: {
      leagueId: league.id,
      label: `${YEAR}/${String((YEAR + 1) % 100)}`,
      startYear: YEAR,
      phase: "PRESEASON",
      isCurrent: true,
      matchday: 0,
    },
  });

  console.log("Squadre…");
  const teams = [];
  for (const t of SQUADRE) {
    teams.push(
      await db.team.create({
        data: { leagueId: league.id, name: t.name, shortName: t.short, color: t.color },
      }),
    );
  }

  console.log("Utenti…");
  const password = await bcrypt.hash("marakalegue", 12);
  await db.user.create({
    data: {
      leagueId: league.id,
      email: "info@studiokubla.com",
      name: "Commissioner",
      passwordHash: password,
      role: "COMMISSIONER",
    },
  });
  for (const [i, team] of teams.entries()) {
    await db.user.create({
      data: {
        leagueId: league.id,
        email: `manager${i + 1}@marakalegue.it`,
        name: `Manager ${team.shortName}`,
        passwordHash: password,
        role: "MANAGER",
        teamId: team.id,
      },
    });
  }

  console.log("Listone dimostrativo…");
  const pool = makePlayers();
  await db.player.createMany({
    data: pool.map((p) => ({
      lfcId: p.lfcId,
      name: p.name,
      normalizedName: normalize(p.name),
      role: p.role,
      serieATeam: p.serieATeam,
      birthDate: p.birthDate,
      nationality: p.nationality,
      tmMarketValue: p.tmMarketValue,
      tmMarketValueAt: new Date(),
      originLeague: p.originLeague,
      originClub: p.originClub,
    })),
  });
  const players = await db.player.findMany();
  const byLfcId = new Map(players.map((p) => [p.lfcId as number, p]));

  await db.playerSeason.createMany({
    data: pool.map((p) => ({
      playerId: byLfcId.get(p.lfcId)!.id,
      seasonId: season.id,
      quotationInitial: toDecimalString(fromMillions(p.quotation)),
      quotationCurrent: toDecimalString(fromMillions(p.quotation)),
    })),
  });

  console.log("Rose e contratti…");
  const taken = new Set<number>();
  for (const team of teams) {
    const roster = buildRoster(pool, taken);
    for (const entry of roster) {
      const player = byLfcId.get(entry.player.lfcId)!;
      const schedule = buildSalarySchedule({
        type: entry.type,
        baseSalary: entry.salary,
        years: entry.years,
        startYear: YEAR,
        ruleset: R,
      });

      const contract = await db.contract.create({
        data: {
          teamId: team.id,
          playerId: player.id,
          seasonId: season.id,
          type: entry.type,
          baseSalary: toDecimalString(entry.salary),
          years: entry.years,
          startYear: YEAR,
          endYear: YEAR + entry.years - 1,
          salarySchedule: schedule.map((r) => ({ year: r.year, salary: r.salary, source: r.source })) as never,
        },
      });

      await db.contractEvent.create({
        data: {
          contractId: contract.id,
          type: "SIGNED",
          effectiveYear: YEAR,
          amountAfter: toDecimalString(entry.salary),
          note: `${entry.type} di ${entry.years} ${entry.years === 1 ? "anno" : "anni"} all'asta di settembre`,
        },
      });
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
    await db.academy.create({
      data: { teamId: team.id, seasonId: season.id, capacity: R.youth.baseCapacity },
    });
  }

  console.log("Finestre di mercato…");
  const windowDates: Record<string, [Date, Date]> = {
    SETTEMBRE: [new Date(`${YEAR}-08-25`), new Date(`${YEAR}-09-15`)],
    NOVEMBRE: [new Date(`${YEAR}-11-10`), new Date(`${YEAR}-11-20`)],
    GENNAIO: [new Date(`${YEAR + 1}-01-10`), new Date(`${YEAR + 1}-01-31`)],
    MARZO: [new Date(`${YEAR + 1}-03-10`), new Date(`${YEAR + 1}-03-20`)],
  };
  for (const w of R.market.windows) {
    const [opensAt, closesAt] = windowDates[w.kind];
    await db.marketWindow.create({
      data: {
        seasonId: season.id,
        kind: w.kind,
        label: w.label,
        opensAt,
        closesAt,
        // La finestra di settembre è quella aperta nella lega demo
        status: w.kind === "SETTEMBRE" ? "OPEN" : "SCHEDULED",
      },
    });
  }

  console.log("Asta e draft…");
  const callOrder = drawCallOrder(teams.map((t) => t.id), `asta-${YEAR}`);
  await db.auction.create({
    data: {
      seasonId: season.id,
      status: "FINISHED",
      callOrder,
      currentTurn: 0,
      bidWindowSeconds: R.auction.bidWindowSeconds,
      startedAt: new Date(`${YEAR}-08-28T20:30:00Z`),
      finishedAt: new Date(`${YEAR}-08-28T23:45:00Z`),
    },
  });

  const draft = await db.draft.create({
    data: { seasonId: season.id, status: "SCHEDULED", lotterySeed: `draft-${YEAR}` },
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
          forYear: YEAR,
        },
      });
    }
  }

  console.log("Competizioni…");
  const competitions = [
    { kind: "APERTURA" as const, name: "Marakalegue Apertura", prizeTable: R.competitions.apertura.prizes, cash: R.competitions.cash.apertura },
    { kind: "CLAUSURA" as const, name: "Marakalegue Clausura", prizeTable: R.competitions.clausura.prizes, cash: R.competitions.cash.clausura },
    { kind: "MARABAO_CUP" as const, name: "Marabao Cup", prizeTable: R.competitions.marabaoCup, cash: R.competitions.cash.marabaoCup },
    { kind: "SUPER_CUP" as const, name: "Super Cup", prizeTable: R.competitions.superCup, cash: R.competitions.cash.superCup },
    { kind: "MARAKA_YOUTH" as const, name: "Marakà Youth", prizeTable: R.competitions.marakaYouth.prizes, cash: R.competitions.cash.marakaYouth },
  ];
  for (const c of competitions) {
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

  console.log("");
  console.log("Fatto.");
  console.log(`  Lega:      ${league.name} — stagione ${season.label}`);
  console.log(`  Squadre:   ${teams.length}`);
  console.log(`  Giocatori: ${players.length} (dimostrativi)`);
  console.log(`  Contratti: ${await db.contract.count()}`);
  console.log("");
  console.log("  Accesso commissioner: info@studiokubla.com / marakalegue");
  console.log("  Accesso manager:      manager1@marakalegue.it / marakalegue");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
