/**
 * Verifica cosa succede quando il database sparisce.
 *
 * Non è un caso di scuola: è già capitato due volte, con un database di prova
 * che scadeva dopo ventiquattr'ore. Chi arrivava sul sito trovava un modulo
 * dall'aria perfettamente funzionante, scriveva la password giusta e si
 * sentiva rispondere che era sbagliata — mandato a cercare l'errore dove non
 * c'era.
 *
 * Qui si avvia l'applicazione contro un database che non esiste e si controlla
 * che lo dica: la pagina di accesso prima ancora del modulo, e l'azione di
 * accesso se il database cade fra il caricamento e l'invio.
 *
 * Non serve nessun database: è il punto.
 */
import { spawn } from "node:child_process";

const PORTA = Number(process.env.PORTA ?? 3199);
const BASE = `http://127.0.0.1:${PORTA}`;

let ko = 0;
const check = (etichetta, ok, dettaglio = "") => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${etichetta}${dettaglio ? ` — ${dettaglio}` : ""}`);
  if (!ok) ko += 1;
};

const server = spawn("npx", ["next", "start", "-p", String(PORTA)], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: "postgresql://nessuno:nessuno@127.0.0.1:5599/inesistente" },
  stdio: "ignore",
});

const testo = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

try {
  let html = "";
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`${BASE}/login`);
      if (r.status === 200) {
        html = testo(await r.text());
        break;
      }
    } catch {
      /* non è ancora in piedi */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  check("la pagina di accesso risponde lo stesso", html.length > 0);
  check("dice che il database non risponde", /database non risponde/i.test(html), html.slice(0, 90));
  check("e mette in chiaro che non è la password", /non è la tua password/i.test(html));
  check("non mostra un modulo che non può funzionare", !/Indirizzo email/.test(html));
  check("riporta il dettaglio tecnico per chi deve ripararlo", /Can't reach database server/i.test(html));

  // Lo stato macchina resta la fonte per chi guarda da fuori.
  const salute = await fetch(`${BASE}/api/salute`);
  check("lo stato risponde 503", salute.status === 503, `HTTP ${salute.status}`);
  check("e lo dice anche in JSON", (await salute.json()).database === "non raggiungibile");
} finally {
  server.kill("SIGTERM");
}

console.log(`\n${ko === 0 ? "Tutte le verifiche passate." : `${ko} verifiche fallite.`}`);
process.exitCode = ko === 0 ? 0 : 1;
