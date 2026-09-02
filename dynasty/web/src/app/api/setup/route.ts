import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { seedLeague, wipeLeague } from "@/lib/setup/seed";

/**
 * Inizializzazione della lega sull'ambiente pubblicato.
 *
 * Serve una volta sola, appena il database è vuoto: crea lega, squadre, utenti,
 * listone, rose iniziali, finestre, draft e competizioni, e **restituisce le
 * credenziali una volta sola** — nel database resta solo l'impronta delle
 * password, quindi se si perdono vanno rigenerate.
 *
 * Tre protezioni, in ordine:
 *  1. senza la variabile `SETUP_TOKEN` la rotta non esiste (404): finita
 *     l'installazione basta togliere la variabile per chiudere la porta;
 *  2. serve l'intestazione `x-setup-token` con quel valore, confrontata a
 *     tempo costante;
 *  3. se una lega esiste già la rotta rifiuta, a meno di chiedere
 *     esplicitamente `{"reset": true}`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confronto a tempo costante: un confronto normale perde informazione sul token. */
function tokenValido(fornito: string | null, atteso: string): boolean {
  if (!fornito || fornito.length !== atteso.length) return false;
  let differenza = 0;
  for (let i = 0; i < atteso.length; i += 1) {
    differenza |= fornito.charCodeAt(i) ^ atteso.charCodeAt(i);
  }
  return differenza === 0;
}

export async function POST(request: Request) {
  const atteso = process.env.SETUP_TOKEN;
  if (!atteso) return new NextResponse("Not found", { status: 404 });

  if (!tokenValido(request.headers.get("x-setup-token"), atteso)) {
    return NextResponse.json({ errore: "Token non valido." }, { status: 401 });
  }

  let corpo: { reset?: boolean; commissionerEmail?: string; password?: string } = {};
  try {
    corpo = await request.json();
  } catch {
    // Corpo assente: si usano i valori predefiniti
  }

  const esistente = await db.league.findFirst({ select: { id: true, name: true } });
  if (esistente && !corpo.reset) {
    return NextResponse.json(
      {
        errore: `La lega «${esistente.name}» esiste già.`,
        suggerimento: "Per rifarla da zero manda {\"reset\": true}. Cancella tutto, comprese le operazioni a registro.",
      },
      { status: 409 },
    );
  }

  if (esistente) await wipeLeague(db);

  const esito = await seedLeague(db, {
    commissionerEmail: corpo.commissionerEmail ?? "info@studiokubla.com",
    password: corpo.password,
  });

  return NextResponse.json({
    ok: true,
    ...esito,
    avvertenza:
      "Le password sono mostrate una volta sola: nel database c'è solo la loro impronta. " +
      "Salvale ora, poi togli la variabile SETUP_TOKEN per chiudere questa rotta.",
  });
}
