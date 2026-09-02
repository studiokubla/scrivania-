/**
 * Verifica dell'economia societaria: stadio, settore giovanile, osservatori,
 * premi delle competizioni e manutenzione annuale.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
const sql = (q) =>
  execSync(`PGPASSWORD=maraka psql -h 127.0.0.1 -U maraka -d dynasty -t -A -c "${q.replace(/"/g, '\\"')}"`)
    .toString()
    .trim();

let failures = 0;
function check(label, cond, detail = "") {
  console.log(`${cond ? "OK  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures += 1;
}

/** Aspetta che una condizione sul database diventi vera, per non dipendere dal render. */
async function attendi(condizione, cosa, timeoutMs = 20000) {
  const scadenza = Date.now() + timeoutMs;
  while (Date.now() < scadenza) {
    if (condizione()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`FAIL  timeout in attesa di: ${cosa}`);
  failures += 1;
  return false;
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function loginAs(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "dynasty");
  await page.click('button:has-text("Entra")');
  await page.waitForURL("**/lega");
  return page;
}

const manager = await loginAs("manager1@dynasty.it");
const teamId = sql(`select "teamId" from "User" where email='manager1@dynasty.it';`);
const teamName = sql(`select name from "Team" where id='${teamId}';`);
const capitale = () => Number(sql(`select coalesce(sum(amount),0) from "CapitalTransaction" where "teamId"='${teamId}';`));

console.log(`Squadra sotto esame: ${teamName}, capitale ${capitale()} M\n`);

// ── 1. Stadio ───────────────────────────────────────────────────────────
await manager.goto(`${BASE}/squadra/${teamId}`);
await manager.click('button:has-text("Stadio")');
await manager.click('tr:has-text("1 — Comunale") button:has-text("Costruisci")');
await manager.waitForSelector(".avviso-ok, .avviso-errore", { timeout: 20000 });

check("stadio di livello 1 costruito", sql(`select level from "Stadium" where "teamId"='${teamId}';`) === "1");
check("costo addebitato al capitale", capitale() === 10, `${capitale()} M rimasti (40 − 30)`);

const movimento = sql(`select kind, amount from "CapitalTransaction"
  where "teamId"='${teamId}' and kind='STADIUM_BUILD';`);
check("movimento di capitale registrato", movimento === "STADIUM_BUILD|-30.00", movimento);

// Il livello 3 richiede demolizione: si salta più di un livello (art. 15.2)
await manager.reload();
await manager.click('button:has-text("Stadio")');
const liv3 = await manager.locator('tr:has-text("3 — Moderno") button').first();
check("il salto di livello è offerto come ricostruzione", (await liv3.textContent())?.includes("Ricostruisci") ?? false);
check("non si può ricostruire senza capitale", await liv3.isDisabled());

// ── 2. Settore giovanile ────────────────────────────────────────────────
// Serve capitale: si simula un premio
sql(`insert into "CapitalTransaction" (id, "teamId", "seasonId", amount, kind, description, "createdAt")
  select 'test-premio', '${teamId}', s.id, 30, 'COMMISSIONER_ADJUSTMENT', 'Fondi per la verifica', now()
  from "Season" s where s."isCurrent"=true;`);

await manager.reload();
await manager.click('button:has-text("Settore giovanile")');
await manager.click('tr:has-text("5 posti") button:has-text("Amplia")');
await manager.waitForSelector(".avviso-ok, .avviso-errore", { timeout: 20000 });

check("settore giovanile ampliato a 5", sql(`select capacity from "Academy" where "teamId"='${teamId}';`) === "5");
check("investimento addebitato", capitale() === 35, `${capitale()} M (10 + 30 − 5)`);

// ── 3. Osservatori ──────────────────────────────────────────────────────
await manager.reload();
await manager.click('button:has-text("Osservatori")');
await manager.selectOption("#campionato", "Serie B");
await manager.click('button:has-text("Invia l\'osservatore")');
await manager.waitForSelector(".avviso-ok, .avviso-errore", { timeout: 20000 });

const scout = sql(`select league, club, cost from "Scout" where "teamId"='${teamId}';`);
check("osservatore inviato sul campionato", scout === "Serie B||7.00", scout);
check("costo dell'osservatore addebitato", capitale() === 28, `${capitale()} M`);

// Il club si può scoutizzare solo dopo il campionato, in una sessione successiva
await manager.reload();
await manager.click('button:has-text("Osservatori")');
await manager.selectOption("#campionato", "La Liga");
const campoClub = manager.locator("#club");
check("il club non è selezionabile senza osservatore sul campionato", await campoClub.isDisabled());

// ── 4. Premi delle competizioni ─────────────────────────────────────────
const boss = await loginAs("info@studiokubla.com");
await boss.goto(`${BASE}/admin`);

// Registra la classifica dell'Apertura: la squadra sotto esame arriva prima
const squadre = sql(`select string_agg(name, '|' order by name) from "Team";`).split("|");
const ordine = [teamName, ...squadre.filter((s) => s !== teamName)];
const apertura = boss.locator('[data-competizione="APERTURA"]');
for (const nome of ordine) {
  await apertura.locator(`button:text-is("${nome}")`).click();
}
await apertura.locator('button:has-text("Registra la classifica")').click();
await apertura.locator("ol").waitFor({ timeout: 20000 });

const posizione = sql(`select position from "StandingRow" sr join "Competition" c on c.id=sr."competitionId"
  where sr."teamId"='${teamId}' and c.kind='APERTURA';`);
check("classifica registrata", posizione === "1", `${teamName} in posizione ${posizione}`);

const capitalePrima = capitale();
await boss.reload();
await boss.locator('[data-competizione="APERTURA"] button:has-text("Versa i premi")').click();
// L'esito si legge sul capitale: dopo il versamento il componente si smonta,
// perché la competizione passa a «premi versati» e il bottone sparisce.
await attendi(() => capitale() !== capitalePrima, "versamento dei premi");

check("premio del primo posto versato", capitale() === capitalePrima + 27, `${capitale()} M (+27)`);

const totale = Number(sql(`select coalesce(sum(amount),0) from "CapitalTransaction" where kind='COMPETITION_PRIZE';`));
check("montepremi complessivo corretto", totale === 182, `${totale} M su 182 attesi`);

// Un secondo clic non deve raddoppiare il montepremi
await boss.reload();
const bottoneRipetuto = await boss.locator('[data-competizione="APERTURA"] button:has-text("Versa i premi")').count();
check("i premi non si possono versare due volte", bottoneRipetuto === 0, `${bottoneRipetuto} bottoni residui`);

// ── 5. Manutenzione annuale ─────────────────────────────────────────────
const capitalePreManutenzione = capitale();
await boss.goto(`${BASE}/admin`);
await boss.click('button:has-text("Addebita la manutenzione")');
await attendi(() => capitale() !== capitalePreManutenzione, "addebito della manutenzione");

check("manutenzione dello stadio addebitata", capitale() === capitalePreManutenzione - 3, `${capitale()} M (−3)`);
check("lo stadio non è retrocesso", sql(`select level from "Stadium" where "teamId"='${teamId}';`) === "1");

// ── 6. Registro ─────────────────────────────────────────────────────────
await boss.goto(`${BASE}/registro`);
await boss.waitForLoadState("networkidle");
const catena = (await boss.locator(".avviso").first().textContent()) ?? "";
check("catena del registro integra", /Catena integra/.test(catena), catena.trim().slice(0, 50));

const testoRegistro = (await boss.locator("body").textContent()) ?? "";
check("gli investimenti sono nel registro", testoRegistro.includes("stadio") && testoRegistro.includes("osservatore"));
check("i premi sono nel registro", testoRegistro.includes("Premi Dynasty Apertura"));

console.log(`\n${failures === 0 ? "Tutte le verifiche passate." : `${failures} verifiche fallite.`}`);
await browser.close();
process.exitCode = failures === 0 ? 0 : 1;
