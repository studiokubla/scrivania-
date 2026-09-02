import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Il client del database.
 *
 * Si costruisce **alla prima query**, non al caricamento del modulo. Sembra un
 * dettaglio ma non lo è: al primissimo deploy le variabili d'ambiente possono
 * non esserci ancora, e un client che esplode all'import fa fallire la
 * compilazione con un errore che non spiega niente. Così invece l'applicazione
 * parte, e `/api/salute` dice esattamente cosa manca.
 *
 * In sviluppo l'istanza resta in cache sul contesto globale: Next ricarica i
 * moduli a ogni modifica, e senza cache si aprirebbe una connessione nuova a
 * ogni salvataggio finché Postgres non rifiuta.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Letta così e non come `process.env.DATABASE_URL`: quella forma viene
 * sostituita col valore al momento della build, e una variabile aggiunta dopo
 * non verrebbe mai vista dal codice già compilato.
 */
function connectionStringDaAmbiente(): string | undefined {
  const ambiente = process.env as Record<string, string | undefined>;
  return ambiente["DATABASE_URL"];
}

function createClient(): PrismaClient {
  const connectionString = connectionStringDaAmbiente();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL non è configurata. In sviluppo: copia .env.example in .env. " +
        "In produzione: aggiungila alle variabili d'ambiente del progetto.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = createClient();
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    else return client;
  }
  return globalForPrisma.prisma as PrismaClient;
}

// In produzione il client va costruito una volta sola per istanza della
// funzione, non a ogni query: si tiene comunque in cache, ma solo dopo che
// la prima query ha dimostrato che le variabili ci sono.
let produzione: PrismaClient | undefined;

export const db = new Proxy({} as PrismaClient, {
  get(_target, proprietà) {
    if (process.env.NODE_ENV === "production") {
      produzione ??= createClient();
      return Reflect.get(produzione, proprietà, produzione);
    }
    const client = getClient();
    return Reflect.get(client, proprietà, client);
  },
});
