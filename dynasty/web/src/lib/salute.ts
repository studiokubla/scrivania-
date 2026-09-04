import "server-only";

import { db } from "./db";

/**
 * Il database risponde?
 *
 * Serve alla pagina di accesso. Quando il database sparisce — è già successo
 * due volte, con un database di prova che scadeva dopo ventiquattr'ore — chi
 * arriva sul sito vede un modulo che sembra funzionante, scrive la password
 * giusta e si sente rispondere che è sbagliata. È la bugia peggiore che
 * l'applicazione possa dire: manda a cercare l'errore dove non c'è.
 *
 * Una domanda sola, la più corta possibile, e la risposta vera.
 */
export async function databaseRaggiungibile(): Promise<{ ok: boolean; dettaglio?: string }> {
  try {
    await db.$queryRaw`select 1`;
    return { ok: true };
  } catch (errore) {
    return { ok: false, dettaglio: errore instanceof Error ? errore.message : String(errore) };
  }
}
