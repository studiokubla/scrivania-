import "server-only";

import { db } from "./db";
import { fromDecimal, type Money, sum } from "./money";
import { DEFAULT_RULESET, parseRuleset, type Ruleset } from "./ruleset";
import { buildCapMatrix, freeMultiYearSlots, type CapMatrix } from "./rules/cap";
import type { ContractView, PlayerRole, SalarySchedule } from "./rules/types";

/**
 * Il ponte tra il database e il motore regole: qui le righe di Prisma diventano
 * i tipi puri che il motore sa maneggiare, e qui si raccoglie lo stato di una
 * squadra in un colpo solo, per non fare venti query sparse dentro le azioni.
 */

export async function getLeague() {
  const league = await db.league.findFirst({ orderBy: { createdAt: "asc" } });
  if (!league) throw new Error("Nessuna lega configurata. Esegui `npm run db:seed`.");
  return league;
}

export function rulesetOf(league: { ruleset: unknown }): Ruleset {
  try {
    return parseRuleset(league.ruleset);
  } catch {
    // Un ruleset corrotto non deve impedire di aprire l'applicazione: si ricade
    // sui valori del regolamento e il pannello del commissioner segnala il problema.
    return DEFAULT_RULESET;
  }
}

export async function getCurrentSeason(leagueId: string) {
  const season =
    (await db.season.findFirst({ where: { leagueId, isCurrent: true } })) ??
    (await db.season.findFirst({ where: { leagueId }, orderBy: { startYear: "desc" } }));
  if (!season) throw new Error("Nessuna stagione configurata.");
  return season;
}

/** Riga di contratto Prisma → vista del motore regole. */
export function toContractView(row: {
  id: string;
  playerId: string;
  type: string;
  baseSalary: unknown;
  years: number;
  startYear: number;
  endYear: number;
  salarySchedule: unknown;
  teamOptionsUsed: number;
  fromFranchiseTag: boolean;
  status: string;
  deadCapAmount: unknown;
  deadCapYear: number | null;
  player: { name: string; role: string };
}): ContractView {
  const schedule = (row.salarySchedule as { year: number; salary: string | number; source?: string }[]).map(
    (r) => ({
      year: r.year,
      salary: typeof r.salary === "number" ? r.salary : fromDecimal(r.salary),
      source: (r.source ?? "BASE") as SalarySchedule[number]["source"],
    }),
  );

  return {
    id: row.id,
    playerId: row.playerId,
    playerName: row.player.name,
    role: row.player.role as PlayerRole,
    type: row.type as ContractView["type"],
    baseSalary: fromDecimal(row.baseSalary),
    years: row.years,
    startYear: row.startYear,
    endYear: row.endYear,
    schedule,
    teamOptionsUsed: row.teamOptionsUsed,
    fromFranchiseTag: row.fromFranchiseTag,
    status: row.status as ContractView["status"],
    deadCapAmount: row.deadCapAmount ? fromDecimal(row.deadCapAmount) : undefined,
    deadCapYear: row.deadCapYear ?? undefined,
  };
}

/** La tabella ingaggi nel formato in cui va salvata su `Contract.salarySchedule`. */
export function scheduleToJson(schedule: SalarySchedule) {
  return schedule.map((r) => ({ year: r.year, salary: r.salary, source: r.source }));
}

export async function getTeamContracts(teamId: string): Promise<ContractView[]> {
  const rows = await db.contract.findMany({
    where: { teamId },
    include: { player: { select: { name: true, role: true } } },
    orderBy: [{ status: "asc" }, { baseSalary: "desc" }],
  });
  return rows.map(toContractView);
}

export async function getCapitalBalance(teamId: string): Promise<Money> {
  const rows = await db.capitalTransaction.findMany({ where: { teamId }, select: { amount: true } });
  return sum(rows.map((r) => fromDecimal(r.amount)));
}

export interface OptionCounters {
  TEAM_OPTION: number;
  FRANCHISE_TAG: number;
  PERFORMANCE_BUYOUT: number;
  FREE_AGENCY_OFFER: number;
  PRE_CONTRACT: number;
  TAMPONE: number;
}

export async function getOptionCounters(teamId: string, seasonId: string): Promise<OptionCounters> {
  const rows = await db.optionUsage.findMany({ where: { teamId, seasonId } });
  const counters: OptionCounters = {
    TEAM_OPTION: 0,
    FRANCHISE_TAG: 0,
    PERFORMANCE_BUYOUT: 0,
    FREE_AGENCY_OFFER: 0,
    PRE_CONTRACT: 0,
    TAMPONE: 0,
  };
  for (const row of rows) counters[row.type as keyof OptionCounters] = row.used;
  return counters;
}

/** Incrementa un contatore di opzioni. Va chiamata nella stessa transazione dell'operazione. */
export async function consumeOption(
  tx: Pick<typeof db, "optionUsage">,
  input: { teamId: string; seasonId: string; type: keyof OptionCounters; amount?: number },
): Promise<void> {
  const amount = input.amount ?? 1;
  await tx.optionUsage.upsert({
    where: { teamId_seasonId_type: { teamId: input.teamId, seasonId: input.seasonId, type: input.type } },
    create: { teamId: input.teamId, seasonId: input.seasonId, type: input.type, used: amount },
    update: { used: { increment: amount } },
  });
}

export interface TeamState {
  team: { id: string; name: string; shortName: string; color: string };
  contracts: ContractView[];
  capital: Money;
  counters: OptionCounters;
  capMatrix: CapMatrix;
  freeSlots: number;
  currentYear: number;
}

/** Tutto quello che serve per decidere su una squadra, in una lettura sola. */
export async function getTeamState(input: {
  teamId: string;
  seasonId: string;
  currentYear: number;
  ruleset: Ruleset;
}): Promise<TeamState> {
  const [team, contracts, capital, counters] = await Promise.all([
    db.team.findUniqueOrThrow({
      where: { id: input.teamId },
      select: { id: true, name: true, shortName: true, color: true },
    }),
    getTeamContracts(input.teamId),
    getCapitalBalance(input.teamId),
    getOptionCounters(input.teamId, input.seasonId),
  ]);

  return {
    team,
    contracts,
    capital,
    counters,
    capMatrix: buildCapMatrix({ contracts, currentYear: input.currentYear, ruleset: input.ruleset }),
    freeSlots: freeMultiYearSlots(contracts, input.currentYear, input.ruleset),
    currentYear: input.currentYear,
  };
}

/**
 * Classifica di riferimento per gli spareggi (art. 9.4 e 10.2).
 *
 * Si usa la classifica della competizione di campionato in corso; se non è ancora
 * iniziata, quella della stagione precedente; se è la prima stagione, l'ordine
 * dell'estrazione d'asta. Restituisce teamId → posizione (1 = prima).
 */
export async function getStandingPositions(seasonId: string): Promise<Record<string, number>> {
  const rows = await db.standingRow.findMany({
    where: { seasonId },
    orderBy: [{ competition: { kind: "desc" } }, { position: "asc" }],
    select: { teamId: true, position: true, competition: { select: { kind: true, status: true } } },
  });

  if (rows.length > 0) {
    const running = rows.filter((r) => r.competition.status === "RUNNING");
    const source = running.length > 0 ? running : rows;
    const positions: Record<string, number> = {};
    for (const row of source) if (positions[row.teamId] === undefined) positions[row.teamId] = row.position;
    return positions;
  }

  // Nessuna classifica ancora: si ripiega sull'ordine di chiamata dell'asta
  const auction = await db.auction.findUnique({ where: { seasonId }, select: { callOrder: true } });
  const positions: Record<string, number> = {};
  auction?.callOrder.forEach((teamId, i) => {
    positions[teamId] = i + 1;
  });
  return positions;
}

/** Gli ingaggi correnti di tutti i giocatori di un ruolo: base del Franchise Tag (art. 6.2). */
export async function getLeagueSalariesForRole(input: {
  leagueId: string;
  role: PlayerRole;
  year: number;
}): Promise<Money[]> {
  const rows = await db.contract.findMany({
    where: {
      status: "ACTIVE",
      team: { leagueId: input.leagueId },
      player: { role: input.role },
    },
    select: { salarySchedule: true },
  });

  return rows
    .map((row) => {
      const schedule = row.salarySchedule as { year: number; salary: number }[];
      return schedule.find((r) => r.year === input.year)?.salary ?? 0;
    })
    .filter((s) => s > 0);
}

/** Il contesto che quasi ogni pagina ha bisogno di avere davanti. */
export async function getLeagueContext() {
  const league = await getLeague();
  const ruleset = rulesetOf(league);
  const season = await getCurrentSeason(league.id);
  return { league, ruleset, season, currentYear: season.startYear };
}
