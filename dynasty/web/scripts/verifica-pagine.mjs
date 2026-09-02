/**
 * Controlla che ogni pagina si apra senza errori, con i due ruoli.
 * Salva anche uno screenshot di ciascuna, utile per guardare il risultato.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
const SHOTS = process.env.SHOTS === "1";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let failures = 0;
const errors = [];

async function sessione(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${email}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${email}] console: ${m.text()}`);
  });
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "dynasty");
  await page.click('button:has-text("Entra")');
  await page.waitForURL("**/lega");
  return page;
}

async function apri(page, path, atteso, nome) {
  const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
  const status = res?.status();
  const h1 = (await page.locator("h1").first().textContent().catch(() => "")) ?? "";
  const ok = status === 200 && (!atteso || h1.includes(atteso));
  console.log(`${ok ? "OK  " : "FAIL"}  ${String(status).padEnd(3)} ${path.padEnd(26)} «${h1.trim()}»`);
  if (!ok) failures += 1;
  if (SHOTS && nome) await page.screenshot({ path: `shot-${nome}.png`, fullPage: true });
  return page;
}

console.log("— manager —");
const manager = await sessione("manager1@dynasty.it");
await apri(manager, "/lega", "Stagione", "lega");
const squadra = await manager.locator('a[href^="/squadra/"]').first().getAttribute("href");
await apri(manager, squadra, "", "squadra");
await apri(manager, "/mercato", "", "mercato");
await apri(manager, "/mercato/scambi", "Scambi", "scambi");
await apri(manager, "/asta", "Sala d", "asta");
await apri(manager, "/registro", "Registro", "registro");

console.log("\n— commissioner —");
const boss = await sessione("info@studiokubla.com");
await apri(boss, "/admin", "Amministrazione", "admin");
await apri(boss, "/asta", "Sala d");
await apri(boss, "/mercato", "");

console.log("\n— controlli di accesso —");
// Il commissioner non ha una squadra: non deve vedere i comandi di offerta
const mercatoBoss = await boss.locator("body").textContent();
const senzaOfferte = !mercatoBoss.includes("Invia offerta sigillata");
console.log(`${senzaOfferte ? "OK  " : "FAIL"}  il commissioner non può presentare offerte`);
if (!senzaOfferte) failures += 1;

// Un manager non deve raggiungere il pannello di amministrazione
await manager.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
const redirected = !manager.url().includes("/admin");
console.log(`${redirected ? "OK  " : "FAIL"}  un manager non entra in amministrazione (${manager.url().split("/").pop()})`);
if (!redirected) failures += 1;

console.log(`\nErrori JavaScript: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log("  -", e);
if (errors.length > 0) failures += 1;

console.log(failures === 0 ? "\nTutte le pagine rispondono." : `\n${failures} controlli falliti.`);
await browser.close();
process.exitCode = failures === 0 ? 0 : 1;
