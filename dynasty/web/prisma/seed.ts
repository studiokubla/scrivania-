/**
 * Prepara la lega in sviluppo.
 *
 * La logica vera sta in `src/lib/setup/seed.ts`, perché serve anche alla rotta
 * di inizializzazione dell'ambiente pubblicato. Qui c'è solo l'involucro da
 * riga di comando, che azzera il database e assegna a tutti la stessa password
 * — cosa che in produzione non si fa mai, e infatti lì le password si generano
 * diverse e si mostrano una volta sola.
 *
 *   npm run db:seed
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedLeague, wipeLeague } from "../src/lib/setup/seed";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const PASSWORD_SVILUPPO = "dynasty";

async function main() {
  console.log("Pulizia del database…");
  await wipeLeague(db);

  console.log("Lega, squadre, listone e rose…");
  const esito = await seedLeague(db, {
    commissionerEmail: "info@studiokubla.com",
    password: PASSWORD_SVILUPPO,
  });

  console.log("");
  console.log("Fatto.");
  console.log(`  Lega:      ${esito.league} — stagione ${esito.season}`);
  console.log(`  Squadre:   ${esito.teams}`);
  console.log(`  Giocatori: ${esito.players} dal listone ufficiale`);
  console.log(`  Contratti: ${esito.contracts}`);
  console.log("");
  console.log(`  Accesso commissioner: info@studiokubla.com / ${PASSWORD_SVILUPPO}`);
  console.log(`  Accesso manager:      manager1@dynasty.it / ${PASSWORD_SVILUPPO}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
