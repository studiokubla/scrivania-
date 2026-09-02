/**
 * Verifica il percorso vero di questa lega.
 *
 * L'asta si fa in presenza, intorno a un tavolo: l'applicazione non la
 * conduce, la registra. Quello che deve funzionare è quindi diverso da
 * un'asta a buste — il commissioner scrive chi ha preso chi, il listone si
 * accorcia, e i controlli sul tetto valgono comunque, perché è al tavolo che
 * nella foga si sfora.
 *
 * Va lanciata su un database svuotato, contro un server con il solo
 * DATABASE_URL.
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

// ── 1. Lega vuota ───────────────────────────────────────────────────────
const esito = await (
  await fetch(`${BASE}/api/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ commissionerEmail: "info@studiokubla.com", password: "dynasty" }),
  })
).json();
check("la lega nasce senza squadre né contratti", esito.teams === 0 && esito.contracts === 0);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

await page.goto(`${BASE}/login`);
await page.fill("#email", "info@studiokubla.com");
await page.fill("#password", "dynasty");
await page.click('button:has-text("Entra")');
await page.waitForURL("**/lega");

// ── 2. Dieci squadre segnaposto in un colpo ─────────────────────────────
await page.goto(`${BASE}/admin`);
await page.click('button:has-text("Iscrivi 10 squadre segnaposto")');
await page.waitForSelector("text=Ecco le 10 squadre", { timeout: 45000 });

check("crea dieci squadre", sql(`select count(*) from "Team";`) === "10");
check("si chiamano Squadra 1…10", sql(`select count(*) from "Team" where name like 'Squadra %';`) === "10");
check("ognuna ha il suo manager", sql(`select count(*) from "User" where role='MANAGER';`) === "10");
check("ognuna ha la dotazione iniziale", sql(`select count(*) from "CapitalTransaction" where kind='INITIAL_ENDOWMENT';`) === "10");
check("le rose partono vuote", sql(`select count(*) from "Contract";`) === "0");

const blocco = await page.locator("pre").first().innerText();
const password = [...blocco.matchAll(/^\s{2}([a-z2-9]{4}(?:-[a-z2-9]{4}){3})$/gm)].map((m) => m[1]);
check("restituisce dieci password diverse", new Set(password).size === 10, `${password.length} password`);

// Farlo due volte non deve raddoppiare la lega.
await page.reload();
const bottoneRipetuto = await page.locator('button:has-text("squadre segnaposto")').count();
check("a lega piena il bottone sparisce", bottoneRipetuto === 0);

// ── 3. Il listone parte pieno e si tagga da solo ────────────────────────
await page.goto(`${BASE}/listone`);
const testoListone = await page.locator("body").innerText();
check("il listone mostra i 531 giocatori liberi", testoListone.includes("531"), testoListone.match(/\d+\s*\n?\s*Su \d+/)?.[0]);
check(
  "e dice che l'idoneità primavera non è ancora decidibile",
  /da verificare/i.test(testoListone) && testoListone.includes("data di nascita"),
);

// Il filtro primavera restringe davvero. L'elenco mostra solo i primi sessanta,
// quindi contare le righe non direbbe niente: si legge il conteggio.
const quanti = async () => {
  const testo = await page.locator(".didascalia").filter({ hasText: /giocatori liberi|su \d+/ }).first().innerText();
  return Number(testo.match(/^(\d+)/)?.[1] ?? testo.match(/(\d+) su/)?.[1] ?? 0);
};
const senzaFiltro = await quanti();
await page.click('button:has-text("Primavera")');
await page.waitForTimeout(500);
const conFiltro = await quanti();
check("il filtro primavera restringe l'elenco", conFiltro > 0 && conFiltro < senzaFiltro, `${conFiltro} su ${senzaFiltro}`);
await page.click('button:has-text("Primavera")');
await page.waitForTimeout(400);

// ── 4. Il commissioner registra un acquisto fatto al tavolo ─────────────
await page.fill('input[aria-label="Cerca nel listone"]', "Maignan");
await page.waitForTimeout(600);
await page.click('button.riga:has-text("Maignan")');
await page.waitForSelector("text=Registra l'acquisto");

const primaSquadra = await page.locator("#teamId option:not([disabled])").first().getAttribute("value");
await page.selectOption("#teamId", primaSquadra);
await page.fill("#amount", "12");
await page.click('button:has-text("Registra")');
await page.waitForSelector(".avviso-ok, .avviso-errore", { timeout: 45000 });

check("l'acquisto è registrato", (await page.locator(".avviso-ok").count()) > 0, await page.locator(".avviso").first().innerText());
check("nasce un contratto Annuale", sql(`select type from "Contract";`) === "ANNUALE");
check("all'importo scritto", sql(`select "baseSalary" from "Contract";`) === "12.00");
check("e finisce nel registro", sql(`select count(*) from "AuditEntry" where action='AUCTION_LIVE';`) === "1");

// ── 5. Il listone si è accorciato ───────────────────────────────────────
await page.goto(`${BASE}/listone`);
const dopo = await page.locator("body").innerText();
check("il listone è sceso a 530", dopo.includes("530"), dopo.slice(0, 120).replace(/\n/g, " "));
await page.fill('input[aria-label="Cerca nel listone"]', "Maignan");
await page.waitForTimeout(600);
// Solo dentro l'elenco: la piega degli ultimi acquisti lo nomina ancora, ed è
// giusto che lo faccia.
check(
  "il giocatore preso non compare più fra i liberi",
  (await page.locator('.elenco button.riga:has-text("Maignan")').count()) === 0,
);

// ── 6. Il tetto vale anche al tavolo ────────────────────────────────────
await page.fill('input[aria-label="Cerca nel listone"]', "");
await page.waitForTimeout(600);
const caro = page.locator(".elenco button.riga").first();
const nomeCaro = (await caro.locator(".riga-titolo").innerText()).trim();
await caro.click();
await page.waitForSelector("text=Registra l'acquisto");
await page.selectOption("#teamId", primaSquadra);
await page.fill("#amount", "900");
await page.click('button:has-text("Registra")');
await page.waitForSelector(".avviso-errore", { timeout: 45000 });
const errore = await page.locator(".avviso-errore").first().innerText();
check("un'offerta oltre il tetto viene respinta", errore.includes("non può arrivare"), `${nomeCaro}: ${errore.slice(0, 70)}`);
check("e non crea nessun contratto", sql(`select count(*) from "Contract";`) === "1");

// ── 7. L'errore di battitura si annulla ─────────────────────────────────
await page.goto(`${BASE}/listone`);
page.once("dialog", (d) => d.accept());
await page.click('summary:has-text("Ultimi acquisti registrati")');
await page.click('button:has-text("Annulla")');
await page.waitForSelector(".avviso-ok", { timeout: 45000 });
check("l'acquisto si annulla", sql(`select count(*) from "Contract";`) === "0");
check("il giocatore torna nel listone", sql(`select count(*) from "Player" p where not exists (select 1 from "Contract" c where c."playerId" = p.id and c.status='ACTIVE');`) === "531");
check("ma il registro conserva entrambe le operazioni", sql(`select count(*) from "AuditEntry" where action in ('AUCTION_LIVE','AUCTION_LIVE_VOID');`) === "2");

// ── 8. Un manager guarda ma non registra ────────────────────────────────
const ctxManager = await browser.newContext({ viewport: { width: 390, height: 844 } });
const manager = await ctxManager.newPage();
manager.setDefaultTimeout(45000);
await manager.goto(`${BASE}/login`);
await manager.fill("#email", "manager1@dynasty.it");
await manager.fill("#password", password[0]);
await manager.click('button:has-text("Entra")');
await manager.waitForURL("**/lega");
await manager.goto(`${BASE}/listone`);
const vistaManager = await manager.locator("body").innerText();
check("il manager vede il listone", /ancora liberi/i.test(vistaManager));
check("ma non può registrare acquisti", !/asta dal vivo/i.test(vistaManager));
check("e non gli compare il modulo", (await manager.locator("#teamId").count()) === 0);

console.log(`\n${ko === 0 ? "Tutte le verifiche passate." : `${ko} verifiche fallite.`}`);
await browser.close();
process.exitCode = ko === 0 ? 0 : 1;
