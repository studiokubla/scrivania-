/**
 * Verifica il percorso della prima pubblicazione.
 *
 * È il momento più fragile di tutta la vita dell'applicazione: database vuoto,
 * una sola variabile d'ambiente, nessuno che possa entrare perché non esistono
 * ancora utenti. Questo script lo percorre esattamente come lo percorrerà chi
 * mette online la lega.
 *
 * Va lanciato contro un server avviato **senza** AUTH_SECRET e senza
 * SETUP_TOKEN, con il solo DATABASE_URL, e su un database svuotato.
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { sql } from "./db.mjs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3101";

let failures = 0;
function check(label, cond, detail = "") {
  console.log(`${cond ? "OK  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures += 1;
}

// ── 1. Database vuoto: l'app parte e lo dice ────────────────────────────
let salute = await (await fetch(`${BASE}/api/salute`)).json();
check("l'app risponde con il database vuoto", salute.database === "raggiungibile", JSON.stringify(salute));
check("dichiara di non essere inizializzata", salute.inizializzata === false);

// ── 2. Inizializzazione senza token ─────────────────────────────────────
const risposta = await fetch(`${BASE}/api/setup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ commissionerEmail: "info@studiokubla.com" }),
});
const esito = await risposta.json();

check("l'inizializzazione riesce senza token a database vuoto", risposta.status === 200, `HTTP ${risposta.status}`);
// La lega nasce vuota: le squadre le iscrive il commissioner, le rose si
// formano all'asta. Un'installazione che partorisse dieci squadre già fatte
// costringerebbe a cancellarle prima di cominciare davvero.
check("non crea nessuna squadra", esito.teams === 0, `${esito.teams}`);
check("carica il listone intero", esito.players === 531, `${esito.players}`);
check("e con l'età dei giocatori", Number(sql(`select count(*) from "Player" where "declaredAge" is not null;`)) >= 520, sql(`select count(*) from "Player" where "declaredAge" is not null;`));
check("non firma nessun contratto", esito.contracts === 0, `${esito.contracts}`);
check("restituisce il solo accesso del commissioner", esito.credentials?.length === 1, `${esito.credentials?.length}`);

const password = esito.credentials?.map((c) => c.password) ?? [];
check("le password sono tutte diverse", new Set(password).size === password.length);
check("le password non sono banali", password.every((p) => /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/.test(p)), password[0]);

const impronte = sql(`select count(distinct "passwordHash") from "User";`);
check(
  "nel database ci sono solo le impronte",
  impronte === "1" && !sql(`select string_agg("passwordHash", '') from "User";`).includes(password[0]),
  impronte,
);

// ── 4. Da ora la rotta è chiusa ─────────────────────────────────────────
const secondo = await fetch(`${BASE}/api/setup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ reset: true }),
});
check("a lega esistente l'inizializzazione è chiusa", secondo.status === 403, `HTTP ${secondo.status}`);

// ── 5. Le credenziali restituite funzionano davvero ─────────────────────
const commissioner = esito.credentials.find((c) => c.role === "COMMISSIONER");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function entra(credenziali) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", credenziali.email);
  await page.fill("#password", credenziali.password);
  await page.click('button:has-text("Entra")');
  await page.waitForURL("**/lega", { timeout: 30000 });
  return page;
}

const paginaBoss = await entra(commissioner);
check("il commissioner entra con la password generata", paginaBoss.url().includes("/lega"));
await paginaBoss.goto(`${BASE}/admin`);
check("e raggiunge l'amministrazione", (await paginaBoss.locator("h1").first().textContent())?.includes("Amministrazione"));

// I manager non esistono ancora: li iscrive il commissioner, ed è quella la
// prima cosa che farà da vivo. Le password escono da lì, non dall'installazione.
await paginaBoss.click('button:has-text("squadre segnaposto")');
await paginaBoss.waitForSelector("text=Ecco le 10 squadre");
const elenco = await paginaBoss.locator("pre").first().innerText();
const credenzialiManager = [...elenco.matchAll(/^\s*(\S+@\S+)\s*\n\s{2}([a-z2-9]{4}(?:-[a-z2-9]{4}){3})$/gm)].map((m) => ({
  email: m[1],
  password: m[2],
}));
check("l'iscrizione restituisce dieci accessi", credenzialiManager.length === 10, `${credenzialiManager.length}`);

const paginaManager = await entra(credenzialiManager[0]);
check("un manager entra con la sua password", paginaManager.url().includes("/lega"));
await paginaManager.goto(`${BASE}/admin`);
check("e non entra in amministrazione", !paginaManager.url().includes("/admin"));

// La sessione regge un riavvio del processo? La chiave viene dal database,
// quindi sì: qui si controlla almeno che sopravviva a un giro di pagine.
await paginaManager.goto(`${BASE}/lega`);
check("la sessione resta valida", (await paginaManager.locator("h1").first().textContent())?.includes("Stagione"));

// ── 6. Password sbagliata ───────────────────────────────────────────────
const ctx = await browser.newContext();
const estraneo = await ctx.newPage();
await estraneo.goto(`${BASE}/login`);
await estraneo.fill("#email", commissioner.email);
await estraneo.fill("#password", "sbagliata");
await estraneo.click('button:has-text("Entra")');
await estraneo.waitForSelector(".avviso-errore", { timeout: 20000 });
check("una password sbagliata non entra", estraneo.url().includes("/login"));

// La chiave di firma nasce al primo accesso, non all'inizializzazione: senza
// AUTH_SECRET viene generata e conservata, e da lì in poi resta quella. Se
// invece il server la riceve dall'ambiente — com'è giusto in produzione — nel
// database non deve comparire nulla: sarebbe una chiave in chiaro di troppo.
/**
 * Da dove arriva la chiave. Il `.env` **può non esserci**: è anzi il caso che
 * questa verifica descrive — server avviato con la sola `DATABASE_URL` — e
 * pretenderlo faceva morire lo script sull'ultimo controllo, dopo che i sedici
 * precedenti erano passati, per un file che non doveva esistere.
 */
const dallAmbiente =
  Boolean(process.env.AUTH_SECRET?.trim()) ||
  (existsSync(".env") && /^\s*AUTH_SECRET\s*=\s*\S/m.test(readFileSync(".env", "utf8").replace(/^#.*$/gm, "")));
const chiave = sql(`select value from "Setting" where key='app_secret';`);
if (dallAmbiente) {
  check("con AUTH_SECRET la chiave non finisce nel database", chiave === "", `${chiave.length} caratteri`);
} else {
  check("la chiave di firma è stata generata e conservata", chiave.length >= 40, `${chiave.length} caratteri`);
}

salute = await (await fetch(`${BASE}/api/salute`)).json();
check("lo stato ora dice inizializzata", salute.inizializzata === true && salute.giocatori === 531);

console.log(`\n${failures === 0 ? "Tutte le verifiche passate." : `${failures} verifiche fallite.`}`);
await browser.close();
process.exitCode = failures === 0 ? 0 : 1;
