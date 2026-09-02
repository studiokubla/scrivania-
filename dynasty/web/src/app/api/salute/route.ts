import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * Stato dell'installazione.
 *
 * Dice se il database risponde e se la lega è già stata inizializzata, senza
 * rivelare nulla di riservato. Serve a capire dall'esterno se il deploy è
 * andato a buon fine — e a distinguere «l'app non parte» da «l'app parte ma il
 * database non c'è».
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const league = await db.league.findFirst({ select: { name: true } });
    if (!league) {
      return NextResponse.json({ database: "raggiungibile", lega: null, inizializzata: false });
    }

    const [season, teams, players, users] = await Promise.all([
      db.season.findFirst({ where: { isCurrent: true }, select: { label: true, phase: true } }),
      db.team.count(),
      db.player.count(),
      db.user.count(),
    ]);

    return NextResponse.json({
      database: "raggiungibile",
      lega: league.name,
      inizializzata: true,
      stagione: season?.label ?? null,
      fase: season?.phase ?? null,
      squadre: teams,
      giocatori: players,
      utenti: users,
    });
  } catch (errore) {
    return NextResponse.json(
      {
        database: "non raggiungibile",
        dettaglio: errore instanceof Error ? errore.message : String(errore),
      },
      { status: 503 },
    );
  }
}
