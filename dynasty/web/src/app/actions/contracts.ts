"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  consumeOption,
  getLeagueContext,
  getLeagueSalariesForRole,
  getTeamContracts,
  getCapitalBalance,
  getOptionCounters,
  scheduleToJson,
  toContractView,
} from "@/lib/league";
import { formatMoney, toDecimalString } from "@/lib/money";
import { freeMultiYearSlots } from "@/lib/rules/cap";
import { checkPerformanceConditions, quoteBuyout, validateBuyout, type PerformanceCheck } from "@/lib/rules/buyout";
import {
  applyTeamOption,
  franchiseTagSalary,
  validateFranchiseTag,
  validateTeamOption,
} from "@/lib/rules/contracts";
import type { PlayerRole } from "@/lib/rules/types";

export interface ActionResult {
  ok: boolean;
  message: string;
  /** Errori del motore regole, con l'articolo che li motiva */
  errors?: { article: string; message: string }[];
}

function refuse(message: string, errors?: { article: string; message: string }[]): ActionResult {
  return { ok: false, message, errors };
}

/** Il contratto appartiene alla squadra del manager che sta agendo? */
async function loadOwnContract(contractId: string) {
  const session = await requireSession();
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: { player: { select: { name: true, role: true } }, team: { select: { id: true, name: true } } },
  });
  if (!contract) return { ok: false as const, error: refuse("Contratto inesistente.") };
  if (session.role !== "MANAGER" || session.teamId !== contract.teamId) {
    return { ok: false as const, error: refuse("Puoi agire solo sui contratti della tua squadra.") };
  }
  return { ok: true as const, session, contract };
}

// ───────────────────────────────────────────────────────── Buy-out (art. 12)

const BuyoutSchema = z.object({
  contractId: z.string().min(1),
  performance: z.boolean(),
});

export async function buyoutContract(input: z.input<typeof BuyoutSchema>): Promise<ActionResult> {
  const parsed = BuyoutSchema.safeParse(input);
  if (!parsed.success) return refuse("Dati non validi.");

  const loaded = await loadOwnContract(parsed.data.contractId);
  if (!loaded.ok) return loaded.error;
  const { session, contract } = loaded;

  const { ruleset, season, currentYear } = await getLeagueContext();
  if (contract.status !== "ACTIVE") return refuse("Il contratto non è attivo.");

  const view = toContractView(contract);
  const quote = quoteBuyout({
    contract: view,
    currentYear,
    isPerformance: parsed.data.performance,
    ruleset,
  });

  const openWindow = await db.marketWindow.findFirst({ where: { seasonId: season.id, status: "OPEN" } });
  const capital = await getCapitalBalance(contract.teamId);
  const counters = await getOptionCounters(contract.teamId, season.id);

  let performanceCheck: PerformanceCheck | undefined;
  if (parsed.data.performance) {
    const stats = await db.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId: contract.playerId, seasonId: season.id } },
    });
    performanceCheck = checkPerformanceConditions({
      stats: {
        matchdaysPlayed: season.matchday,
        appearances: stats?.appearances ?? 0,
        voteSum: stats ? Number(stats.voteSum) : 0,
        consecutiveNoVote: stats?.consecutiveNoVote ?? 0,
      },
      ruleset,
    });
  }

  const check = validateBuyout({
    quote,
    capitalBalance: capital,
    performanceBuyoutsUsed: counters.PERFORMANCE_BUYOUT,
    windowOpen: Boolean(openWindow),
    performanceCheck,
    ruleset,
  });

  if (!check.ok) {
    return refuse("Lo svincolo non è consentito.", check.errors.map((e) => ({ article: e.article, message: e.message })));
  }

  await db.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: "BOUGHT_OUT",
        endedReason: parsed.data.performance ? "PERFORMANCE_BUYOUT" : "BUYOUT",
        endedAt: new Date(),
        deadCapAmount: quote.deadCap > 0 ? toDecimalString(quote.deadCap) : null,
        deadCapYear: quote.deadCap > 0 ? quote.deadCapYear : null,
      },
    });

    await tx.contractEvent.create({
      data: {
        contractId: contract.id,
        type: parsed.data.performance ? "PERFORMANCE_BUYOUT" : "BUYOUT",
        effectiveYear: currentYear,
        amountBefore: toDecimalString(quote.remainingSalary),
        amountAfter: toDecimalString(quote.deadCap),
        note: `Penale ${formatMoney(quote.penalty)} dal Capitale`,
      },
    });

    await tx.capitalTransaction.create({
      data: {
        teamId: contract.teamId,
        seasonId: season.id,
        amount: toDecimalString(-quote.penalty),
        kind: "BUYOUT_PENALTY",
        description: `Svincolo di ${contract.player.name}${parsed.data.performance ? " (performance buy-out)" : ""}`,
        refType: "Contract",
        refId: contract.id,
      },
    });

    // Il giocatore svincolato in stagione passa dal waiver (art. 10.1)
    if (season.phase === "REGULAR") {
      await tx.player.update({ where: { id: contract.playerId }, data: { updatedAt: new Date() } });
    }

    if (parsed.data.performance) {
      await consumeOption(tx, {
        teamId: contract.teamId,
        seasonId: season.id,
        type: "PERFORMANCE_BUYOUT",
      });
    }

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: contract.teamId,
      action: "CONTRACT_BUYOUT",
      summary:
        `${contract.team.name} svincola ${contract.player.name}: penale ${formatMoney(quote.penalty)}` +
        (quote.deadCap > 0 ? `, dead cap ${formatMoney(quote.deadCap)}` : " senza dead cap") +
        (parsed.data.performance ? " (performance buy-out)" : ""),
      payload: {
        contractId: contract.id,
        penalty: quote.penalty,
        deadCap: quote.deadCap,
        performance: parsed.data.performance,
        reasons: performanceCheck?.reasons,
      },
    });
  });

  revalidatePath(`/squadra/${contract.teamId}`);
  revalidatePath("/mercato");
  revalidatePath("/registro");

  return {
    ok: true,
    message: `${contract.player.name} svincolato. Penale di ${formatMoney(quote.penalty)} addebitata al Capitale.`,
  };
}

/** Preventivo di svincolo, per mostrarlo prima che il manager decida. */
export async function quoteBuyoutFor(contractId: string, performance: boolean) {
  const loaded = await loadOwnContract(contractId);
  if (!loaded.ok) return null;

  const { ruleset, season, currentYear } = await getLeagueContext();
  const quote = quoteBuyout({
    contract: toContractView(loaded.contract),
    currentYear,
    isPerformance: performance,
    ruleset,
  });

  const stats = await db.playerSeason.findUnique({
    where: { playerId_seasonId: { playerId: loaded.contract.playerId, seasonId: season.id } },
  });
  const check = checkPerformanceConditions({
    stats: {
      matchdaysPlayed: season.matchday,
      appearances: stats?.appearances ?? 0,
      voteSum: stats ? Number(stats.voteSum) : 0,
      consecutiveNoVote: stats?.consecutiveNoVote ?? 0,
    },
    ruleset,
  });

  return { quote, performanceCheck: check };
}

// ───────────────────────────────────────────────────────── Team Option (art. 6.1)

export async function exerciseTeamOption(contractId: string): Promise<ActionResult> {
  const loaded = await loadOwnContract(contractId);
  if (!loaded.ok) return loaded.error;
  const { session, contract } = loaded;

  const { ruleset, season, currentYear } = await getLeagueContext();
  const view = toContractView(contract);
  const contracts = await getTeamContracts(contract.teamId);
  const counters = await getOptionCounters(contract.teamId, season.id);

  const check = validateTeamOption({
    optionsUsedThisSeason: counters.TEAM_OPTION,
    isMultiYear: ruleset.contracts[view.type].occupiesSlot,
    contractExpiresThisSeason: view.endYear === currentYear,
    freeMultiYearSlots: freeMultiYearSlots(contracts, currentYear + 1, ruleset),
    ruleset,
  });

  if (!check.ok) {
    return refuse("La Team Option non è esercitabile.", check.errors.map((e) => ({ article: e.article, message: e.message })));
  }

  const extended = applyTeamOption(view.schedule, ruleset);
  const addedYear = extended[extended.length - 1];

  await db.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contract.id },
      data: {
        endYear: addedYear.year,
        years: contract.years + 1,
        teamOptionsUsed: { increment: 1 },
        salarySchedule: scheduleToJson(extended) as never,
      },
    });

    await tx.contractEvent.create({
      data: {
        contractId: contract.id,
        type: "TEAM_OPTION",
        effectiveYear: addedYear.year,
        amountBefore: toDecimalString(view.schedule[view.schedule.length - 1].salary),
        amountAfter: toDecimalString(addedYear.salary),
        note: `Estensione di un anno al +${Math.round((ruleset.options.teamOption.rate - 1) * 100)}%`,
      },
    });

    await consumeOption(tx, { teamId: contract.teamId, seasonId: season.id, type: "TEAM_OPTION" });

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: contract.teamId,
      action: "TEAM_OPTION",
      summary: `${contract.team.name} esercita la Team Option su ${contract.player.name}: ${addedYear.year}/${String((addedYear.year + 1) % 100)} a ${formatMoney(addedYear.salary)}`,
      payload: { contractId: contract.id, year: addedYear.year, salary: addedYear.salary },
    });
  });

  revalidatePath(`/squadra/${contract.teamId}`);
  revalidatePath("/registro");

  return {
    ok: true,
    message: `${contract.player.name} rinnovato fino al ${addedYear.year}/${String((addedYear.year + 1) % 100)} a ${formatMoney(addedYear.salary)}.`,
  };
}

// ───────────────────────────────────────────────────────── Franchise Tag (art. 6.2)

export async function applyFranchiseTag(contractId: string): Promise<ActionResult> {
  const loaded = await loadOwnContract(contractId);
  if (!loaded.ok) return loaded.error;
  const { session, contract } = loaded;

  const { league, ruleset, season, currentYear } = await getLeagueContext();
  const view = toContractView(contract);
  const counters = await getOptionCounters(contract.teamId, season.id);

  const previousTag = await db.contract.findFirst({
    where: { playerId: contract.playerId, fromFranchiseTag: true, startYear: currentYear },
  });

  const check = validateFranchiseTag({
    tagsUsedThisSeason: counters.FRANCHISE_TAG,
    playerWasTaggedLastSeason: Boolean(previousTag),
    contractExpiresThisSeason: view.endYear === currentYear,
    ruleset,
  });

  if (!check.ok) {
    return refuse("Il Franchise Tag non è applicabile.", check.errors.map((e) => ({ article: e.article, message: e.message })));
  }

  const leagueSalaries = await getLeagueSalariesForRole({
    leagueId: league.id,
    role: contract.player.role as PlayerRole,
    year: currentYear,
  });

  const tag = franchiseTagSalary({
    lastSalary: view.schedule[view.schedule.length - 1].salary,
    leagueSalariesForRole: leagueSalaries,
    ruleset,
  });

  const nextYear = currentYear + 1;

  await db.$transaction(async (tx) => {
    // Il tag non estende il contratto: ne apre uno nuovo di un anno. Così la storia
    // resta leggibile e il vincolo "non due anni di fila" è verificabile su un record.
    await tx.contract.update({
      where: { id: contract.id },
      data: { status: "EXPIRED", endedReason: "EXPIRY", endedAt: new Date() },
    });

    const tagged = await tx.contract.create({
      data: {
        teamId: contract.teamId,
        playerId: contract.playerId,
        seasonId: season.id,
        type: "ANNUALE",
        baseSalary: toDecimalString(tag.salary),
        years: 1,
        startYear: nextYear,
        endYear: nextYear,
        fromFranchiseTag: true,
        salarySchedule: [{ year: nextYear, salary: tag.salary, source: "FRANCHISE_TAG" }] as never,
      },
    });

    await tx.contractEvent.create({
      data: {
        contractId: tagged.id,
        type: "FRANCHISE_TAG",
        effectiveYear: nextYear,
        amountBefore: toDecimalString(view.schedule[view.schedule.length - 1].salary),
        amountAfter: toDecimalString(tag.salary),
        note:
          tag.basis === "ROLE_AVERAGE"
            ? `Media dei ${ruleset.options.franchiseTag.topSalariesByRole} ingaggi più alti del ruolo`
            : `+${Math.round((ruleset.options.franchiseTag.minRate - 1) * 100)}% sull'ultimo ingaggio`,
      },
    });

    await consumeOption(tx, { teamId: contract.teamId, seasonId: season.id, type: "FRANCHISE_TAG" });

    await recordAudit(tx, {
      seasonId: season.id,
      userId: session.userId,
      teamId: contract.teamId,
      action: "FRANCHISE_TAG",
      summary: `${contract.team.name} applica il Franchise Tag a ${contract.player.name}: ${formatMoney(tag.salary)} per il ${nextYear}/${String((nextYear + 1) % 100)}`,
      payload: { playerId: contract.playerId, salary: tag.salary, basis: tag.basis, roleAverage: tag.roleAverage },
    });
  });

  revalidatePath(`/squadra/${contract.teamId}`);
  revalidatePath("/registro");

  return {
    ok: true,
    message: `${contract.player.name} blindato a ${formatMoney(tag.salary)} (${tag.basis === "ROLE_AVERAGE" ? "media di ruolo" : "+20% sull'ultimo ingaggio"}).`,
  };
}

/** Anteprima del costo del tag, per mostrarlo prima di decidere. */
export async function previewFranchiseTag(contractId: string) {
  const loaded = await loadOwnContract(contractId);
  if (!loaded.ok) return null;

  const { league, ruleset, currentYear } = await getLeagueContext();
  const view = toContractView(loaded.contract);
  const leagueSalaries = await getLeagueSalariesForRole({
    leagueId: league.id,
    role: loaded.contract.player.role as PlayerRole,
    year: currentYear,
  });

  return franchiseTagSalary({
    lastSalary: view.schedule[view.schedule.length - 1].salary,
    leagueSalariesForRole: leagueSalaries,
    ruleset,
  });
}
