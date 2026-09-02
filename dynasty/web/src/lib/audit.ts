import "server-only";

import { createHash } from "node:crypto";

import { db } from "./db";

/**
 * Registro pubblico (art. 22).
 *
 * Ogni riga porta l'impronta della precedente. Non impedisce a chi ha accesso al
 * database di modificare una riga, ma rende la modifica **visibile**: la catena si
 * spezza e `verifyAuditChain` lo dice. È la garanzia che serve a una lega dove il
 * commissioner amministra il sistema e i manager devono potersi fidare.
 */

export interface AuditInput {
  seasonId: string;
  userId?: string | null;
  teamId?: string | null;
  action: string;
  summary: string;
  payload?: unknown;
}

/**
 * Serializzazione canonica: chiavi in ordine alfabetico, ricorsivamente.
 *
 * Serve perché Postgres memorizza il JSON come `jsonb` e **non conserva l'ordine
 * delle chiavi**: rileggendo un payload, `JSON.stringify` restituirebbe una stringa
 * diversa da quella scritta e la catena risulterebbe spezzata anche senza che
 * nessuno abbia toccato nulla. Le date diventano stringhe ISO in scrittura, quindi
 * qui si normalizzano allo stesso modo in entrambe le direzioni.
 */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function computeHash(input: {
  previousHash: string | null;
  seasonId: string;
  action: string;
  summary: string;
  payload: unknown;
  createdAt: Date;
}): string {
  return createHash("sha256")
    .update(
      [
        input.previousHash ?? "genesi",
        input.seasonId,
        input.action,
        input.summary,
        canonical(input.payload ?? null),
        input.createdAt.toISOString(),
      ].join("|"),
    )
    .digest("hex");
}

/**
 * Scrive una riga nel registro. Da chiamare **dentro** la transazione che compie
 * l'operazione: se l'operazione fallisce non deve restare traccia di un fatto
 * mai avvenuto, e se riesce il registro non può mancare.
 */
export async function recordAudit(
  tx: Pick<typeof db, "auditEntry">,
  input: AuditInput,
): Promise<void> {
  const previous = await tx.auditEntry.findFirst({
    where: { seasonId: input.seasonId },
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });

  const createdAt = new Date();
  const payload = (input.payload ?? null) as never;

  await tx.auditEntry.create({
    data: {
      seasonId: input.seasonId,
      userId: input.userId ?? null,
      teamId: input.teamId ?? null,
      action: input.action,
      summary: input.summary,
      payload,
      previousHash: previous?.hash ?? null,
      hash: computeHash({
        previousHash: previous?.hash ?? null,
        seasonId: input.seasonId,
        action: input.action,
        summary: input.summary,
        payload: input.payload ?? null,
        createdAt,
      }),
      createdAt,
    },
  });
}

export interface ChainVerification {
  valid: boolean;
  entries: number;
  /** Prima riga che non torna, se c'è */
  brokenAt?: { id: string; createdAt: Date; summary: string };
}

/** Ricalcola la catena dall'inizio: se una riga è stata toccata, salta fuori qui. */
export async function verifyAuditChain(seasonId: string): Promise<ChainVerification> {
  const entries = await db.auditEntry.findMany({
    where: { seasonId },
    orderBy: { createdAt: "asc" },
  });

  let previousHash: string | null = null;
  for (const entry of entries) {
    const expected = computeHash({
      previousHash,
      seasonId: entry.seasonId,
      action: entry.action,
      summary: entry.summary,
      payload: entry.payload ?? null,
      createdAt: entry.createdAt,
    });
    if (entry.previousHash !== previousHash || entry.hash !== expected) {
      return {
        valid: false,
        entries: entries.length,
        brokenAt: { id: entry.id, createdAt: entry.createdAt, summary: entry.summary },
      };
    }
    previousHash = entry.hash;
  }

  return { valid: true, entries: entries.length };
}
