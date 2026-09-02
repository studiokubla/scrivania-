/**
 * Esegue tutte le verifiche end-to-end, ripopolando il database prima di ognuna.
 *
 * Ogni script muove davvero lo stato della lega — assegna giocatori, spende capitale,
 * versa premi — quindi partire da uno stato pulito è l'unico modo perché il secondo
 * script non erediti il disordine del primo.
 */
import { execSync } from "node:child_process";

const scripts = [
  ["Pagine e accessi", "scripts/verifica-pagine.mjs"],
  ["Mercato", "scripts/verifica-mercato.mjs"],
  ["Asta", "scripts/verifica-asta.mjs"],
  ["Import", "scripts/verifica-import.mjs"],
  ["Società e premi", "scripts/verifica-societa.mjs"],
];

let failed = 0;
for (const [nome, file] of scripts) {
  console.log(`\n${"─".repeat(60)}\n${nome}\n${"─".repeat(60)}`);
  try {
    execSync("npx tsx prisma/seed.ts", { stdio: "ignore" });
    execSync(`node ${file}`, { stdio: "inherit" });
  } catch {
    failed += 1;
  }
}

console.log(`\n${"═".repeat(60)}`);
console.log(failed === 0 ? "Tutte le verifiche passate." : `${failed} gruppi di verifiche falliti.`);
process.exitCode = failed === 0 ? 0 : 1;
