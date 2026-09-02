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
 * Le protezioni, in ordine:
 *  1. **appena una lega esiste, senza token non si fa più niente.** È la
 *     protezione che conta: finché il database è vuoto non c'è nulla da
 *     rubare, dopo c'è tutto;
 *  2. con `SETUP_TOKEN` configurata serve l'intestazione `x-setup-token`,
 *     confrontata a tempo costante — sempre, anche a database vuoto;
 *  3. rifare da zero una lega che esiste richiede sia il token sia
 *     `{"reset": true}` esplicito.
 *
 * Senza `SETUP_TOKEN` la prima inizializzazione è quindi aperta a chi conosce
 * l'indirizzo, ma solo per il tempo che passa tra il primo deploy e il primo
 * accesso. È il compromesso che permette di mettere online la lega con una
 * sola variabile d'ambiente; chi preferisce chiudere anche quella finestra
 * imposta `SETUP_TOKEN` prima del deploy.
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

  if (atteso && !tokenValido(request.headers.get("x-setup-token"), atteso)) {
    return NextResponse.json({ errore: "Token non valido." }, { status: 401 });
  }

  let corpo: { reset?: boolean; commissionerEmail?: string; password?: string } = {};
  try {
    corpo = await request.json();
  } catch {
    // Corpo assente: si usano i valori predefiniti
  }

  const esistente = await db.league.findFirst({ select: { id: true, name: true } });

  // A lega esistente il token non è più facoltativo: senza, la rotta è chiusa.
  if (esistente && !atteso) {
    return NextResponse.json(
      {
        errore: "La lega è già stata inizializzata.",
        suggerimento:
          "Per rifarla da zero serve la variabile d'ambiente SETUP_TOKEN e l'intestazione x-setup-token.",
      },
      { status: 403 },
    );
  }

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
      "Salvale ora. Da adesso questa rotta è chiusa: rifare la lega richiede SETUP_TOKEN.",
  });
}
