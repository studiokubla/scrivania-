/**
 * Comando di build.
 *
 * Allinea lo schema al database prima di compilare, così il primo deploy crea
 * le tabelle da sé e i successivi non richiedono passaggi manuali. Se però
 * `DATABASE_URL` non c'è ancora — succede al primissimo deploy, quando il
 * progetto è appena stato creato e le variabili non sono state inserite — la
 * build non fallisce con un errore criptico di Prisma: salta l'allineamento,
 * lo dice, e compila lo stesso. L'app parte, `/api/salute` spiega cosa manca.
 */
import { execSync } from "node:child_process";

function esegui(comando) {
  console.log(`\n$ ${comando}`);
  execSync(comando, { stdio: "inherit" });
}

esegui("prisma generate");

if (process.env.DATABASE_URL) {
  esegui("prisma db push");
} else {
  console.log(
    "\n⚠  DATABASE_URL non è configurata: salto l'allineamento dello schema.\n" +
      "   L'applicazione compila lo stesso, ma non funzionerà finché non la\n" +
      "   imposti nelle variabili d'ambiente del progetto e non rilanci il deploy.\n" +
      "   Vedi docs/PUBBLICAZIONE.md.\n",
  );
}

esegui("next build");
