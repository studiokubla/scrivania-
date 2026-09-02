/**
 * Popola il database con la lega pronta a partire.
 *
 * I calciatori sono quelli veri: si leggono dal listone ufficiale in
 * `dati/Quotazioni_Fantacalcio_2026_27.xlsx`, lo stesso file che il commissioner
 * ricaricherà dal pannello a ogni aggiornamento delle quotazioni. Squadre e
 * manager sono invece segnaposto, da rinominare alla prima riunione di lega.
 *
 * Il listone non contiene le date di nascita: finché non si importano i dati
 * Transfermarkt, i contratti Rookie e Veteran non si possono firmare (art. 4.2),
 * e infatti il seed non ne crea nessuno.
 *
 *   npm run db:seed
 */

import "dotenv/config";

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { fromMillions, toDecimalString, type Money } from "../src/lib/money";
import { DEFAULT_RULESET } from "../src/lib/ruleset";
import { buildSalarySchedule } from "../src/lib/rules/contracts";
import { basePriceFor, drawCallOrder } from "../src/lib/rules/auction";
import type { ContractType, PlayerRole } from "../src/lib/rules/types";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const R = DEFAULT_RULESET;
const YEAR = 2026;

// Generatore deterministico: lo stesso seed produce sempre la stessa lega demo,
// così i test manuali sono ripetibili.
let state = 20260901;
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
  mantraRoles: string[];
  serieATeam: string;
  quotation: number;
  initialQuotation: number;
  fvm: number;
}

const LISTONE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dati", "Quotazioni_Fantacalcio_2026_27.xlsx");

/**
 * Legge il listone ufficiale.
 *
 * Il foglio «Tutti» ha una riga di titolo prima dell'intestazione, quindi le
 * colonne partono dalla terza riga. Il foglio «Ceduti» elenca chi ha lasciato
 * la Serie A e si ignora: quei giocatori non si possono più tesserare (art. 13).
 */
async function readListone(): Promise<SeedPlayer[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(LISTONE);
  const ws = wb.getWorksheet("Tutti");
  if (!ws) throw new Error("Il listone non contiene il foglio «Tutti».");

  const players: SeedPlayer[] = [];
  ws.eachRow((row, index) => {
    if (index < 3) return;
    const cella = (n: number) => row.getCell(n).value;
    const role = String(cella(2) ?? "").trim() as PlayerRole;
    if (!["P", "D", "C", "A"].includes(role)) return;

    players.push({
      lfcId: Number(cella(1)),
      name: String(cella(4) ?? "").trim(),
      role,
      mantraRoles: String(cella(3) ?? "").split(";").map((r) => r.trim()).filter(Boolean),
      serieATeam: String(cella(5) ?? "").trim(),
      quotation: Number(cella(6)) || 1,
      initialQuotation: Number(cella(7)) || 1,
      fvm: Number(cella(12)) || 0,
    });
  });
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

      // Solo Annuale e Standard: Rookie e Veteran dipendono dall'età, e il
      // listone non porta le date di nascita (art. 4.2). Arrivano con l'import
      // Transfermarkt, e da lì i manager potranno usarli.
      let type: ContractType = "ANNUALE";
      let years = 1;

      if (multiYear < 7 && rnd() > 0.55) {
        type = "STANDARD";
        years = 2 + Math.floor(rnd() * 2);
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
    data: { name: "Dynasty League", slug: "dynasty", ruleset: R as never },
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
  const password = await bcrypt.hash("dynasty", 12);
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
        email: `manager${i + 1}@dynasty.it`,
        name: `Manager ${team.shortName}`,
        passwordHash: password,
        role: "MANAGER",
        teamId: team.id,
      },
    });
  }

  if (!existsSync(LISTONE)) {
    throw new Error(`Listone non trovato in ${LISTONE}. Scarica le quotazioni ufficiali e mettile lì.`);
  }
  console.log("Listone ufficiale…");
  const pool = await readListone();

  await db.player.createMany({
    data: pool.map((p) => ({
      lfcId: p.lfcId,
      name: p.name,
      normalizedName: normalize(p.name),
      role: p.role,
      mantraRoles: p.mantraRoles,
      serieATeam: p.serieATeam,
    })),
  });
  const players = await db.player.findMany();
  const byLfcId = new Map(players.map((p) => [p.lfcId as number, p]));

  await db.playerSeason.createMany({
    data: pool.map((p) => ({
      playerId: byLfcId.get(p.lfcId)!.id,
      seasonId: season.id,
      quotationInitial: toDecimalString(fromMillions(p.initialQuotation)),
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
    { kind: "APERTURA" as const, name: "Dynasty Apertura", prizeTable: R.competitions.apertura.prizes, cash: R.competitions.cash.apertura },
    { kind: "CLAUSURA" as const, name: "Dynasty Clausura", prizeTable: R.competitions.clausura.prizes, cash: R.competitions.cash.clausura },
    { kind: "DYNASTY_CUP" as const, name: "Dynasty Cup", prizeTable: R.competitions.dynastyCup, cash: R.competitions.cash.dynastyCup },
    { kind: "SUPER_CUP" as const, name: "Super Cup", prizeTable: R.competitions.superCup, cash: R.competitions.cash.superCup },
    { kind: "DYNASTY_YOUTH" as const, name: "Dynasty Youth", prizeTable: R.competitions.dynastyYouth.prizes, cash: R.competitions.cash.dynastyYouth },
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
  console.log(`  Giocatori: ${players.length} dal listone ufficiale`);
  console.log(`  Contratti: ${await db.contract.count()}`);
  console.log("");
  console.log("  Accesso commissioner: info@studiokubla.com / dynasty");
  console.log("  Accesso manager:      manager1@dynasty.it / dynasty");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
