"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getCapitalBalance, getLeagueContext } from "@/lib/league";
import { formatMoney, fromMillions, toDecimalString } from "@/lib/money";
import {
  academyTierFor,
  academyUpgradeCost,
  scoutCost,
  stadiumTier,
  stadiumUpgradeCost,
  validateStadiumInvestment,
} from "@/lib/rules/capital";
import type { ActionResult } from "./contracts";

function refuse(message: string, errors?: { article: string; message: string }[]): ActionResult {
  return { ok: false, message, errors };
}

async function requireOwnTeam(teamId: string) {
  const session = await requireSession();
  if (session.role !== "MANAGER" || session.teamId !== teamId) {
    return { ok: false as const, error: refuse("Puoi investire solo sulla tua squadra.") };
  }
  return { ok: true as const, session };
}

// ───────────────────────────────────────────────────────── Stadio (art. 15)

export async function buildStadium(teamId: string, targetLevel: number): Promise<ActionResult> {
  const guard = await requireOwnTeam(teamId);
  if (!guard.ok) return guard.error;

  const { ruleset, season, currentYear } = await getLeagueContext();
  const stadium = await db.stadium.findUnique({
    where: { teamId_seasonId: { teamId, seasonId: season.id } },
  });
  const currentLevel = stadium?.level ?? 0;
  const capital = await getCapitalBalance(teamId);

  const check = validateStadiumInvestment({
    currentLevel,
    targetLevel,
    capital,
    seasonPhase: season.phase,
    ruleset,
  });
  if (!check.ok) {
    return refuse("L'investimento non è consentito.", check.errors.map((e) => ({ article: e.article, message: e.message })));
  }

  const { cost, requiresDemolition } = stadiumUpgradeCost({ currentLevel, targetLevel, ruleset });
  const tier = stadiumTier(targetLevel, ruleset);

  await db.$transaction(async (tx) => {
    await tx.stadium.upsert({
      where: { teamId_seasonId: { teamId, seasonId: season.id } },
      create: {
        teamId,
        seasonId: season.id,
        level: targetLevel,
        builtInYear: currentYear,
        operationalFromMatchday: ruleset.capital.stadiumOperationalFromMatchday,
      },
      update: {
        level: targetLevel,
        builtInYear: currentYear,
        downgraded: false,
      },
    });

    await tx.capitalTransaction.create({
      data: {
        teamId,
        seasonId: season.id,
        amount: toDecimalString(-cost),
        kind: currentLevel === 0 ? "STADIUM_BUILD" : "STADIUM_UPGRADE",
        description: requiresDemolition
          ? `Ricostruzione stadio al livello ${targetLevel} (${tier?.name})`
          : `Stadio livello ${targetLevel} (${tier?.name})`,
      },
    });

    const team = await tx.team.findUniqueOrThrow({ where: { id: teamId }, select: { name: true } });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: guard.session.userId,
      teamId,
      action: "CAPITAL_INVESTMENT",
      summary: `${team.name} porta lo stadio al livello ${targetLevel} (${tier?.name}) per ${formatMoney(cost)}`,
      payload: { from: currentLevel, to: targetLevel, cost, requiresDemolition },
    });
  });

  revalidatePath(`/squadra/${teamId}`);
  revalidatePath("/lega");

  return {
    ok: true,
    message:
      `Stadio al livello ${targetLevel}. Gli incassi partono dalla ${ruleset.capital.stadiumOperationalFromMatchday}ª giornata (art. 15.1).`,
    errors: check.warnings.map((w) => ({ article: w.article, message: w.message })),
  };
}

// ───────────────────────────────────────────────────────── Primavera (art. 16.2)

export async function expandAcademy(teamId: string, targetCapacity: number): Promise<ActionResult> {
  const guard = await requireOwnTeam(teamId);
  if (!guard.ok) return guard.error;

  const parsed = z.coerce.number().int().min(3).max(11).safeParse(targetCapacity);
  if (!parsed.success) return refuse("Capienza non valida.");

  const { ruleset, season } = await getLeagueContext();
  const academy = await db.academy.findUnique({
    where: { teamId_seasonId: { teamId, seasonId: season.id } },
  });
  const currentCapacity = academy?.capacity ?? ruleset.youth.baseCapacity;

  if (parsed.data <= currentCapacity) return refuse("La capienza scelta non è un ampliamento.");

  const { investment, maintenance } = academyUpgradeCost({
    currentCapacity,
    targetCapacity: parsed.data,
    ruleset,
  });
  const capital = await getCapitalBalance(teamId);

  if (capital < investment) {
    return refuse("Capitale insufficiente.", [
      { article: "art. 16.2", message: `Servono ${formatMoney(investment)}, ne hai ${formatMoney(capital)}.` },
    ]);
  }

  const tier = academyTierFor(parsed.data, ruleset);

  await db.$transaction(async (tx) => {
    await tx.academy.upsert({
      where: { teamId_seasonId: { teamId, seasonId: season.id } },
      create: { teamId, seasonId: season.id, capacity: tier.maxPlayers },
      update: { capacity: tier.maxPlayers },
    });

    await tx.capitalTransaction.create({
      data: {
        teamId,
        seasonId: season.id,
        amount: toDecimalString(-investment),
        kind: "ACADEMY_INVESTMENT",
        description: `Settore giovanile ampliato a ${tier.maxPlayers} posti`,
      },
    });

    const team = await tx.team.findUniqueOrThrow({ where: { id: teamId }, select: { name: true } });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: guard.session.userId,
      teamId,
      action: "CAPITAL_INVESTMENT",
      summary: `${team.name} amplia il settore giovanile a ${tier.maxPlayers} posti per ${formatMoney(investment)}`,
      payload: { from: currentCapacity, to: tier.maxPlayers, investment, maintenance },
    });
  });

  revalidatePath(`/squadra/${teamId}`);
  return {
    ok: true,
    message: `Settore giovanile a ${tier.maxPlayers} posti. Mantenimento annuo ${formatMoney(maintenance)}.`,
  };
}

// ───────────────────────────────────────────────────────── Osservatori (art. 17.2)

const ScoutSchema = z.object({
  teamId: z.string().min(1),
  league: z.string().min(1),
  /** Vuoto = osservatore sul campionato; valorizzato = su un club specifico */
  club: z.string().optional(),
});

export async function sendScout(input: z.input<typeof ScoutSchema>): Promise<ActionResult> {
  const parsed = ScoutSchema.safeParse(input);
  if (!parsed.success) return refuse("Dati non validi.");

  const guard = await requireOwnTeam(parsed.data.teamId);
  if (!guard.ok) return guard.error;

  const { ruleset, season, currentYear } = await getLeagueContext();
  const { teamId, league } = parsed.data;
  const club = parsed.data.club?.trim() || null;

  const window = await db.marketWindow.findFirst({ where: { seasonId: season.id, status: "OPEN" } });
  if (!window && season.phase !== "PRESEASON") {
    return refuse("Gli osservatori si inviano a finestra aperta o in precampionato.", [
      { article: "art. 17.2", message: "L'investimento avviene in una sessione di mercato." },
    ]);
  }

  const existing = await db.scout.findMany({ where: { teamId, seasonId: season.id } });

  // Non più di un osservatore per campionato nella stessa sessione (art. 17.2)
  if (!club && existing.some((s) => !s.club && s.league.toLowerCase() === league.toLowerCase())) {
    return refuse("Hai già un osservatore su questo campionato.", [
      { article: "art. 17.2", message: "Non più di un osservatore nello stesso campionato per sessione." },
    ]);
  }

  // Il club si scoutizza solo dopo il campionato, e in una sessione successiva
  if (club) {
    const leagueScout = existing.find((s) => !s.club && s.league.toLowerCase() === league.toLowerCase());
    if (!leagueScout) {
      return refuse("Prima il campionato, poi il club.", [
        {
          article: "art. 17.2",
          message: "Non si può inviare un osservatore in un club senza aver prima scoutizzato il campionato.",
        },
      ]);
    }
    if (window && leagueScout.investedAt > window.opensAt) {
      return refuse("Il trasferimento al club avviene nella sessione successiva.", [
        { article: "art. 17.2", message: "L'investimento sul campionato e quello sul club stanno in due sessioni diverse." },
      ]);
    }
  }

  const cost = scoutCost(league, ruleset);
  const capital = await getCapitalBalance(teamId);
  if (capital < cost) {
    return refuse("Capitale insufficiente.", [
      { article: "art. 17.2", message: `Servono ${formatMoney(cost)}, ne hai ${formatMoney(capital)}.` },
    ]);
  }

  await db.$transaction(async (tx) => {
    await tx.scout.create({
      data: {
        teamId,
        seasonId: season.id,
        league,
        club,
        cost: toDecimalString(cost),
        supersedesLeagueScout: Boolean(club),
        expiresAfterYear: currentYear,
      },
    });

    await tx.capitalTransaction.create({
      data: {
        teamId,
        seasonId: season.id,
        amount: toDecimalString(-cost),
        kind: "SCOUT_INVESTMENT",
        description: club ? `Osservatore su ${club} (${league})` : `Osservatore su ${league}`,
      },
    });

    const team = await tx.team.findUniqueOrThrow({ where: { id: teamId }, select: { name: true } });
    await recordAudit(tx, {
      seasonId: season.id,
      userId: guard.session.userId,
      teamId,
      action: "CAPITAL_INVESTMENT",
      // Il registro riporta l'ora: è ciò che risolve «chi ha investito prima» (art. 17.2.5)
      summary: `${team.name} invia un osservatore ${club ? `all'${club} (${league})` : `in ${league}`} per ${formatMoney(cost)}`,
      payload: { league, club, cost },
    });
  });

  revalidatePath(`/squadra/${teamId}`);
  return {
    ok: true,
    message: club
      ? `Osservatore all'${club}. L'osservatore generale su ${league} decade, a meno che tu non ne paghi un secondo (art. 17.2).`
      : `Osservatore in ${league}. Dalla prossima sessione potrai specializzarlo su un club.`,
  };
}

/** Costo di ogni possibile investimento, per mostrarlo nel pannello società. */
export async function societyOptions(teamId: string) {
  const { ruleset, season } = await getLeagueContext();
  const [stadium, academy, capital] = await Promise.all([
    db.stadium.findUnique({ where: { teamId_seasonId: { teamId, seasonId: season.id } } }),
    db.academy.findUnique({ where: { teamId_seasonId: { teamId, seasonId: season.id } } }),
    getCapitalBalance(teamId),
  ]);

  const currentLevel = stadium?.level ?? 0;
  const currentCapacity = academy?.capacity ?? ruleset.youth.baseCapacity;

  return {
    capital,
    phase: season.phase,
    stadium: {
      currentLevel,
      tiers: ruleset.capital.stadium.map((s) => {
        const { cost, requiresDemolition } = stadiumUpgradeCost({
          currentLevel,
          targetLevel: s.level,
          ruleset,
        });
        return {
          level: s.level,
          name: s.name,
          cost,
          requiresDemolition,
          maintenance: fromMillions(s.maintenance),
          incomePerHomeMatch: fromMillions(s.incomePerHomeMatch),
          fantaPoints: s.fantaPointsPerHomeMatch,
          affordable: capital >= cost && s.level > currentLevel,
        };
      }),
    },
    academy: {
      currentCapacity,
      tiers: ruleset.capital.academy
        .filter((t) => t.maxPlayers > currentCapacity)
        .map((t) => {
          const { investment, maintenance } = academyUpgradeCost({
            currentCapacity,
            targetCapacity: t.maxPlayers,
            ruleset,
          });
          return {
            capacity: t.maxPlayers,
            investment,
            maintenance,
            affordable: capital >= investment,
          };
        }),
    },
    scouting: ruleset.capital.scouting.map((s) => ({
      league: s.league,
      country: s.country,
      cost: fromMillions(s.cost),
      affordable: capital >= fromMillions(s.cost),
    })),
  };
}
