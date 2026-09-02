/**
 * Asta di settembre (art. 8) e risoluzione delle offerte a busta chiusa.
 *
 * Lo stesso meccanismo di apertura simultanea vale per la free agency (art. 9):
 * `resolveSealedBids` è condivisa, cambia solo il criterio di spareggio.
 */

import { createHash } from "node:crypto";

import { fromMillions, isOnStep, type Money } from "../money";
import type { Ruleset } from "../ruleset";
import { canAfford } from "./cap";
import { type ContractView, type ValidationResult, fail, issue, ok } from "./types";

/** Base d'asta dalla quotazione Leghe Fantacalcio (art. 8.4). */
export function basePriceFor(quotation: number | null | undefined, ruleset: Ruleset): Money {
  const q = quotation ?? 0;
  const tier = ruleset.auction.basePriceByQuotation.find((t) => q >= t.minQuotation);
  const price = tier?.basePrice ?? ruleset.auction.basePriceByQuotation.at(-1)?.basePrice ?? 0.5;
  return fromMillions(price);
}

export interface SealedBid {
  teamId: string;
  amount: Money;
  submittedAt: Date;
}

export interface SealedBidOutcome {
  /** Vincitore, oppure null se tutti hanno offerto zero */
  winnerId: string | null;
  amount: Money;
  /** Squadre in parità sull'offerta più alta: serve un turno di spareggio */
  tiedTeamIds: string[];
  /** Offerte ordinate, per il registro pubblico */
  ranking: SealedBid[];
}

/**
 * Apre le buste e determina il vincitore.
 *
 * `tieBreak` decide cosa fare in caso di parità:
 *  - `REPEAT` (asta, art. 8.5): si ripete l'offerta tra i soli pari merito
 *  - `WORST_STANDING` (free agency, art. 9.4): vince la squadra peggio classificata
 */
export function resolveSealedBids(input: {
  bids: SealedBid[];
  minimum: Money;
  tieBreak: "REPEAT" | "WORST_STANDING";
  /** teamId → posizione in classifica (1 = prima). Serve solo per WORST_STANDING */
  standings?: Record<string, number>;
  /** teamId → anni offerti. Nella free agency la durata maggiore precede la classifica */
  years?: Record<string, number>;
}): SealedBidOutcome {
  const { bids, minimum, tieBreak, standings, years } = input;

  const valid = bids.filter((b) => b.amount >= minimum && b.amount > 0);
  const ranking = [...bids].sort((a, b) => b.amount - a.amount);

  if (valid.length === 0) {
    return { winnerId: null, amount: 0, tiedTeamIds: [], ranking };
  }

  const best = Math.max(...valid.map((b) => b.amount));
  const top = valid.filter((b) => b.amount === best);

  if (top.length === 1) {
    return { winnerId: top[0].teamId, amount: best, tiedTeamIds: [], ranking };
  }

  if (tieBreak === "REPEAT") {
    return { winnerId: null, amount: best, tiedTeamIds: top.map((b) => b.teamId), ranking };
  }

  // WORST_STANDING: prima la durata maggiore, poi la posizione peggiore (art. 9.4)
  const byYears = years
    ? Math.max(...top.map((b) => years[b.teamId] ?? 0))
    : null;
  const stillTied = byYears === null ? top : top.filter((b) => (years?.[b.teamId] ?? 0) === byYears);

  if (stillTied.length === 1) {
    return { winnerId: stillTied[0].teamId, amount: best, tiedTeamIds: [], ranking };
  }

  const worst = stillTied.reduce((acc, b) => {
    const posA = standings?.[acc.teamId] ?? 0;
    const posB = standings?.[b.teamId] ?? 0;
    return posB > posA ? b : acc;
  });
  return { winnerId: worst.teamId, amount: best, tiedTeamIds: [], ranking };
}

/**
 * Spareggio dell'asta (art. 8.5): se la parità persiste dopo la ripetizione,
 * il giocatore va a chi è stato estratto per primo nell'ordine di chiamata.
 */
export function resolveAuctionTie(input: {
  tiedTeamIds: string[];
  callOrder: string[];
}): string {
  const { tiedTeamIds, callOrder } = input;
  const sorted = [...tiedTeamIds].sort((a, b) => callOrder.indexOf(a) - callOrder.indexOf(b));
  return sorted[0];
}

/** Validazione di un'offerta d'asta (art. 8.4 e 8.6). */
export function validateAuctionBid(input: {
  amount: Money;
  basePrice: Money;
  contracts: ContractView[];
  year: number;
  ruleset: Ruleset;
}): ValidationResult {
  const { amount, basePrice, contracts, year, ruleset } = input;
  const errors = [];

  // Zero è un'offerta legittima: significa "non mi interessa" (art. 8.3)
  if (amount === 0) return ok();

  if (amount < basePrice) {
    errors.push(
      issue("BELOW_BASE", "art. 8.4", `La base d'asta è ${(basePrice / 100).toLocaleString("it-IT")} M.`),
    );
  }
  if (!isOnStep(amount)) {
    errors.push(issue("OFF_STEP", "art. 8.4", "Le offerte sono multipli di 0,25 M."));
  }

  const afford = canAfford({ contracts, year, amount, ruleset, enforceReserve: true });
  if (!afford.ok) {
    errors.push(
      issue(
        "RESERVE_VIOLATION",
        "art. 8.6",
        `Puoi offrire al massimo ${(afford.maxAffordable / 100).toLocaleString("it-IT")} M: ` +
          `devi lasciare ${(afford.reserve / 100).toLocaleString("it-IT")} M per completare la rosa minima.`,
      ),
    );
  }

  return errors.length ? fail(errors) : ok();
}

/** Un manager può smettere di chiamare solo con la rosa minima completa (art. 8.2). */
export function canPassTurn(input: { contracts: ContractView[]; year: number; ruleset: Ruleset }): boolean {
  const active = input.contracts.filter(
    (c) => c.status === "ACTIVE" && c.schedule.some((r) => r.year === input.year),
  );
  return active.length >= input.ruleset.roster.minPlayers;
}

/**
 * Impronta dell'offerta: hash di importo, squadra, lotto e istante di invio.
 *
 * Non serve a cifrare — il database è comunque leggibile dal commissioner — ma a
 * rendere dimostrabile che l'importo memorizzato è quello inviato e non è stato
 * ritoccato dopo l'apertura delle buste. Con un registro concatenato (art. 22)
 * una modifica a posteriori diventa visibile.
 */
export function bidFingerprint(input: {
  lotId: string;
  teamId: string;
  amount: Money;
  submittedAt: Date;
  secret: string;
}): string {
  return createHash("sha256")
    .update(`${input.lotId}|${input.teamId}|${input.amount}|${input.submittedAt.toISOString()}|${input.secret}`)
    .digest("hex");
}

/**
 * Ordine di chiamata dell'asta (art. 8.1). Estrazione riproducibile: dallo stesso
 * seme esce lo stesso ordine, così l'estrazione si può ripetere e verificare.
 */
export function drawCallOrder(teamIds: string[], seed: string): string[] {
  const order = [...teamIds];
  let state = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 12), 16);
  const next = () => {
    // Generatore congruenziale lineare: basta a mescolare dieci squadre in modo
    // deterministico e verificabile
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Lotteria del draft (art. 17.1): pesi crescenti verso il fondo della classifica.
 * `standings` va passato dalla prima all'ultima classificata.
 */
export function drawDraftOrder(input: {
  standings: string[];
  weights: number[];
  seed: string;
}): { order: string[]; weightsUsed: Record<string, number> } {
  const { standings, weights, seed } = input;
  const pool = standings.map((teamId, i) => ({ teamId, weight: weights[i] ?? 1 }));
  const weightsUsed = Object.fromEntries(pool.map((p) => [p.teamId, p.weight]));

  let state = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 12), 16);
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };

  const order: string[] = [];
  const remaining = [...pool];
  while (remaining.length > 0) {
    const total = remaining.reduce((acc, p) => acc + p.weight, 0);
    let roll = next() * total;
    let index = 0;
    for (let i = 0; i < remaining.length; i += 1) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    order.push(remaining[index].teamId);
    remaining.splice(index, 1);
  }
  return { order, weightsUsed };
}
