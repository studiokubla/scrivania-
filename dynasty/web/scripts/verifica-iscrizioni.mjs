/**
 * Verifica la partenza vera di una lega.
 *
 * Non quella di prova con dieci squadre già fatte e le rose piene: questa parte
 * dal giorno zero, com'è la Dynasty League adesso. Database vuoto, lega creata
 * senza squadre, listone tutto svincolato, e il commissioner che iscrive i
 * manager uno alla volta dal pannello.
 *
 * Va lanciata contro un server avviato con il solo DATABASE_URL, su un database
 * svuotato.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://127.0.0.1:3101";
const sql = (q) =>
  execSync(`PGPASSWORD=maraka psql -h 127.0.0.1 -U maraka -d dynasty -t -A -c "${q.replace(/"/g, '\\"')}"`)
    .toString()
    .trim();

let ko = 0;
const check = (etichetta, ok, dettaglio = "") => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${etichetta}${dettaglio ? ` — ${dettaglio}` : ""}`);
  if (!ok) ko += 1;
};

// ── 1. La lega nasce vuota ──────────────────────────────────────────────
const risposta = await fetch(`${BASE}/api/setup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ commissionerEmail: "info@studiokubla.com" }),
});
const esito = await risposta.json();

check("l'inizializzazione riesce", risposta.status === 200, `HTTP ${risposta.status}`);
check("non crea nessuna squadra", esito.teams === 0, `${esito.teams}`);
check("non firma nessun contratto", esito.contracts === 0, `${esito.contracts}`);
check("carica il listone intero", esito.players === 531, `${esito.players}`);
check("crea il solo accesso del commissioner", esito.credentials?.length === 1, `${esito.credentials?.length}`);
check("tutti i giocatori sono svincolati", sql(`select count(*) from "Contract";`) === "0");

const commissioner = esito.credentials[0];

// ── 2. Il commissioner iscrive le squadre ───────────────────────────────
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

await page.goto(`${BASE}/login`);
await page.fill("#email", commissioner.email);
await page.fill("#password", commissioner.password);
await page.click('button:has-text("Entra")');
await page.waitForURL("**/lega");
await page.goto(`${BASE}/admin`);

check("il pannello dice che non c'è nessuna squadra", (await page.locator("body").innerText()).includes("Nessuna squadra iscritta"));

async function iscrivi(nome, sigla, email) {
  await page.fill("#c-name", nome);
  await page.fill("#c-short", sigla);
  await page.fill("#c-email", email);
  await page.click('button:has-text("Iscrivi la squadra")');
  await page.waitForSelector(`text=Credenziali per ${nome}`, { timeout: 45000 });
  const blocco = await page.locator("pre").first().innerText();
  const password = blocco.match(/Password:\s*(\S+)/)?.[1];
  await page.click('button:has-text("Ho finito")');
  return password;
}

const primaPassword = await iscrivi("Real Marasca", "MRS", "manager1@dynasty.it");
check("l'iscrizione restituisce una password", /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/.test(primaPassword ?? ""), primaPassword);

for (const [n, [nome, sigla]] of [
  ["AS Sorata", "SOR"],
  ["Atletico Buranello", "BUR"],
].entries()) {
  await iscrivi(nome, sigla, `manager${n + 2}@dynasty.it`);
}

await page.reload();
const testoPannello = await page.locator("body").innerText();
check("il pannello elenca le tre squadre", ["Real Marasca", "AS Sorata", "Atletico Buranello"].every((n) => testoPannello.includes(n)));
check("e dice quante ne mancano", testoPannello.includes("ne mancano 7"), testoPannello.match(/ne mancano \d+/)?.[0]);

check("ogni squadra ha la dotazione iniziale", sql(`select count(*) from "CapitalTransaction" where kind='INITIAL_ENDOWMENT';`) === "3");
check("ogni squadra ha stadio e settore giovanile", sql(`select count(*) from "Stadium";`) === "3" && sql(`select count(*) from "Academy";`) === "3");
check("ogni squadra ha le sue tre scelte al draft", sql(`select count(*) from "DraftPick";`) === "9");

// ── 3. Un doppione non passa ────────────────────────────────────────────
await page.fill("#c-name", "Real Marasca");
await page.fill("#c-short", "RM2");
await page.fill("#c-email", "altro@dynasty.it");
await page.click('button:has-text("Iscrivi la squadra")');
await page.waitForSelector(".avviso-errore", { timeout: 45000 });
check("due squadre non possono chiamarsi uguale", (await page.locator(".avviso-errore").first().innerText()).includes("Real Marasca"));
check("e non ne è stata creata una quarta", sql(`select count(*) from "Team";`) === "3");

// ── 4. La password generata funziona davvero ────────────────────────────
const ctxManager = await browser.newContext();
const pagina = await ctxManager.newPage();
pagina.setDefaultTimeout(45000);
await pagina.goto(`${BASE}/login`);
await pagina.fill("#email", "manager1@dynasty.it");
await pagina.fill("#password", primaPassword);
await pagina.click('button:has-text("Entra")');
await pagina.waitForURL("**/lega");
check("il manager entra con la password generata", pagina.url().includes("/lega"));

await pagina.goto(`${BASE}/lega`);
const lega = await pagina.locator("body").innerText();
check("la lega mostra le squadre iscritte", lega.includes("Real Marasca"));

const link = await pagina.locator('a[href^="/squadra/"]').first().getAttribute("href");
await pagina.goto(`${BASE}${link}`);
const rosa = await pagina.locator("body").innerText();
check("la rosa parte vuota", /0\s*\/\s*25|nessun giocatore|Rosa vuota|0 giocatori/i.test(rosa) || !/Sommer|Lautaro|Maignan/i.test(rosa));

// ── 5. Ripartire da zero ────────────────────────────────────────────────
await page.reload();
await page.click('summary:has-text("Ripartire da zero")');
await page.fill("#conferma", "Dynasty League");
await page.click('button:has-text("Azzera la lega")');
await page.waitForSelector("text=squadre rimosse", { timeout: 45000 });
check("l'azzeramento toglie tutte le squadre", sql(`select count(*) from "Team";`) === "0");
check("e i manager con esse", sql(`select count(*) from "User" where role='MANAGER';`) === "0");
check("ma lascia il listone", sql(`select count(*) from "Player";`) === "531");
check("e lascia in piedi il commissioner", sql(`select count(*) from "User" where role='COMMISSIONER';`) === "1");
check("il commissioner resta collegato", (await (await fetch(`${BASE}/api/salute`)).json()).inizializzata === true);

console.log(`\n${ko === 0 ? "Tutte le verifiche passate." : `${ko} verifiche fallite.`}`);
await browser.close();
process.exitCode = ko === 0 ? 0 : 1;
