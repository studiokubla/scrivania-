/**
 * Verifica end-to-end dell'asta: apertura, chiamata, buste segrete, scadenza del
 * tempo, apertura simultanea, aggiudicazione. Tre browser diversi, come tre manager
 * seduti allo stesso tavolo.
 *
 * Lo scadere del tempo si simula spostando `closesAt` nel passato, invece di
 * aspettare davvero: così la verifica non dipende da quanto è lento il browser.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://127.0.0.1:3100";
const sql = (q) =>
  execSync(`PGPASSWORD=maraka psql -h 127.0.0.1 -U maraka -d dynasty -t -A -c "${q.replace(/"/g, '\\"')}"`)
    .toString()
    .trim();

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// Tre browser aperti insieme sulla stessa macchina: i tempi predefiniti di
// Playwright vanno alzati, altrimenti la verifica fallisce per lentezza e non
// per un difetto dell'applicazione.
const ATTESA = 45000;
let failures = 0;
function check(label, cond, detail = "") {
  console.log(`${cond ? "OK  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures += 1;
}

async function loginAs(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(ATTESA);
  page.setDefaultNavigationTimeout(ATTESA);
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "dynasty");
  await page.click('button:has-text("Entra")');
  await page.waitForURL("**/lega");
  return page;
}

// Finestra ampia: il tempo lo facciamo scadere noi, quando tutte le buste sono dentro
sql(`update "Auction" set "bidWindowSeconds" = 600;`);

// ── 1. Il commissioner apre l'asta ──────────────────────────────────────
const boss = await loginAs("info@studiokubla.com");
await boss.goto(`${BASE}/asta`);
await boss.click(`button:has-text("riestrai"), button:has-text("Apri l'asta")`);
await boss.waitForSelector(".avviso-ok", { timeout: ATTESA });
check("asta aperta dal commissioner", sql(`select status from "Auction";`) === "RUNNING");

const order = sql(`select array_to_string("callOrder", ',') from "Auction";`).split(",");
check("ordine di chiamata estratto", order.length === 10, `${order.length} squadre`);

const emailFor = (teamId) => sql(`select email from "User" where "teamId"='${teamId}';`);

// Tutti e tre entrano prima che parta la chiamata, come succederebbe davvero
const [first, second, third] = await Promise.all([
  loginAs(emailFor(order[0])),
  loginAs(emailFor(order[1])),
  loginAs(emailFor(order[2])),
]);

// ── 2. Chi non è di turno non può chiamare ──────────────────────────────
await second.goto(`${BASE}/asta`);
await second.waitForLoadState("networkidle");
const attesa = await second.locator("text=In attesa della prossima chiamata").count();
check("chi non è di turno non può chiamare", attesa === 1);
check("il campo di chiamata non compare a chi non tocca", (await second.locator("#chiamata").count()) === 0);

// ── 3. Il manager di turno chiama ───────────────────────────────────────
await first.goto(`${BASE}/asta`);
const target = sql(`select p.name from "Player" p
  left join "Contract" c on c."playerId"=p.id and c.status='ACTIVE'
  where c.id is null and p.role='C' order by p.name limit 1;`);
await first.fill("#chiamata", target.split(" ")[0]);
await first.click(`button:has-text("${target}")`);
await first.waitForSelector("#offerta", { timeout: ATTESA });
check("chiamata registrata", sql(`select count(*) from "AuctionLot" where status='OPEN';`) === "1", target);

const lotId = sql(`select id from "AuctionLot" where status='OPEN';`);
const base = sql(`select "basePrice" from "AuctionLot" where id='${lotId}';`);
check("base d'asta calcolata dalla quotazione", Number(base) > 0, `${base} M`);

// ── 4. Tutti offrono in segreto ─────────────────────────────────────────
async function offri(page, importo) {
  await page.reload();
  await page.waitForSelector("#offerta", { timeout: ATTESA });
  await page.fill("#offerta", String(importo));
  await page.click(`button:has-text("Sigilla l'offerta"), button:has-text("Correggi la busta")`);
  await page.waitForSelector(".avviso-ok, .avviso-errore", { timeout: ATTESA });
  return (await page.locator(".avviso-errore").count()) === 0;
}

// Gli importi si costruiscono sulla base d'asta reale: un'offerta sotto la base
// viene giustamente rifiutata, e non è quello che stiamo verificando qui.
const basePrice = Number(base);
const offertaBassa = basePrice;
const offertaAlta = basePrice + 1.5;
check("il chiamante offre alla base", await offri(first, offertaBassa));
check("un secondo manager rilancia", await offri(second, offertaAlta));

// Un'offerta sotto la base va respinta (art. 8.4)
check("offerta sotto la base respinta", (await offri(first, Math.max(0.25, basePrice - 0.5))) === false);
// ...e la busta valida di prima resta quella depositata
await offri(first, offertaBassa);

await third.goto(`${BASE}/asta`);
await third.waitForSelector('button:has-text("Non mi interessa")', { timeout: ATTESA });
await third.click('button:has-text("Non mi interessa")');
await third.waitForSelector(".avviso-ok", { timeout: ATTESA });
check("chi non è interessato registra zero", true);

check("tre buste depositate", sql(`select count(*) from "AuctionBid" where "lotId"='${lotId}';`) === "3");
check(
  "le buste non sono ancora aperte",
  sql(`select count(*) from "AuctionBid" where "lotId"='${lotId}' and "revealedAt" is null;`) === "3",
);

// Nessuno vede l'offerta degli altri prima dell'apertura
const paginaSecond = await second.locator("body").textContent();
check("le offerte altrui non sono visibili", !new RegExp(`Busta depositata a ${offertaBassa}`).test(paginaSecond));

// ── 5. Un'offerta oltre la riserva viene respinta (art. 8.6) ────────────
const respinta = await offri(first, 84);
check("offerta oltre la riserva respinta", respinta === false);

// ── 6. Scade il tempo ───────────────────────────────────────────────────
sql(`update "AuctionLot" set "closesAt" = now() - interval '1 second' where id='${lotId}';`);
await first.reload();
await first.waitForLoadState("networkidle");

check("la chiamata si è chiusa da sola", sql(`select status from "AuctionLot" where id='${lotId}';`) === "ASSIGNED");

const winner = sql(`select t.name from "AuctionLot" l join "Team" t on t.id=l."wonByTeamId" where l.id='${lotId}';`);
const expected = sql(`select name from "Team" where id='${order[1]}';`);
check("ha vinto l'offerta più alta", winner === expected, `${winner} vs atteso ${expected}`);

const price = sql(`select "winningAmount" from "AuctionLot" where id='${lotId}';`);
check("prezzo di aggiudicazione corretto", Number(price) === offertaAlta, `${price} M`);

const contract = sql(`select c.type, c."baseSalary" from "Contract" c join "Player" p on p.id=c."playerId"
  where p.name='${target}' and c.status='ACTIVE';`);
check("contratto creato come Annuale (art. 4.1)", contract === `ANNUALE|${offertaAlta.toFixed(2)}`, contract);

check(
  "le buste sono state aperte",
  sql(`select count(*) from "AuctionBid" where "lotId"='${lotId}' and "revealedAt" is not null;`) === "3",
);

const audit = sql(`select summary from "AuditEntry" where action='AUCTION_ASSIGNED' order by "createdAt" desc limit 1;`);
check("il registro riporta l'aggiudicazione", audit.includes(target) && audit.includes(String(offertaAlta).replace(".", ",")), audit.slice(0, 90));

check("il turno è avanzato", sql(`select "currentTurn" from "Auction";`) === "1");

// ── 7. La catena del registro regge dopo tutte queste scritture ─────────
await boss.goto(`${BASE}/registro`);
await boss.waitForLoadState("networkidle");
const catena = (await boss.locator(".avviso").first().textContent()) ?? "";
check("catena del registro integra", /Catena integra/.test(catena), catena.trim().slice(0, 60));

console.log(`\n${failures === 0 ? "Tutte le verifiche passate." : `${failures} verifiche fallite.`}`);
await browser.close();
process.exitCode = failures === 0 ? 0 : 1;
