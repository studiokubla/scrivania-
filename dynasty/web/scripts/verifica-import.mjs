/**
 * Verifica degli importatori.
 *
 * Genera file che imitano il formato reale di Leghe Fantacalcio — riga di titolo
 * prima dell'intestazione, righe separatrici con il nome della squadra, colonne
 * come «Qt.A» e «Cv» — li carica dal pannello del commissioner e controlla che
 * finiscano nel database nel modo giusto.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";

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

const dir = mkdtempSync(join(tmpdir(), "maraka-import-"));

// Tre giocatori già in archivio, per verificare l'aggiornamento invece della creazione
const esistenti = JSON.parse(
  sql(`select json_agg(row_to_json(t)) from (
    select p."lfcId", p.name, p.role, p."serieATeam" from "Player" p
    where p."lfcId" is not null order by p."lfcId" limit 3) t;`),
);

// ── File quotazioni, nel formato del listone ────────────────────────────
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Tutti");
ws.addRow(["Quotazioni Fantacalcio Stagione 2025 26"]);
ws.addRow(["Id", "R", "RM", "Nome", "Squadra", "Qt.A", "Qt.I", "Diff.", "FVM"]);
for (const p of esistenti) {
  ws.addRow([p.lfcId, p.role, p.role, p.name, p.serieATeam, 21, 20, 1, 55]);
}
// Un giocatore nuovo, che l'import deve creare
ws.addRow([999001, "A", "Pc", "Nuovoarrivo Z.", "Como", 33, 30, 3, 180]);
const quotazioni = join(dir, "Quotazioni_Fantacalcio_Stagione_2025_26.xlsx");
await wb.xlsx.writeFile(quotazioni);

// ── File voti, con la riga separatrice della squadra ────────────────────
const wb2 = new ExcelJS.Workbook();
const ws2 = wb2.addWorksheet("Giornata 1");
ws2.addRow(["Voti Fantacalcio Stagione 2025-26 - Giornata 1"]);
ws2.addRow(["Id", "R", "Nome", "Squadra", "Cv", "Gf", "Gs", "Rp", "Rs", "Rf", "Au", "Amm", "Esp", "Ass"]);
ws2.addRow(["ATALANTA"]); // riga separatrice, va ignorata
ws2.addRow([esistenti[0].lfcId, esistenti[0].role, esistenti[0].name, esistenti[0].serieATeam, 7, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
ws2.addRow([esistenti[1].lfcId, esistenti[1].role, esistenti[1].name, esistenti[1].serieATeam, 5.5, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
// Terzo senza voto: deve contare come giornata senza voto
ws2.addRow([esistenti[2].lfcId, esistenti[2].role, esistenti[2].name, esistenti[2].serieATeam, "", 0, 0, 0, 0, 0, 0, 0, 0, 0]);
ws2.addRow([999999, "C", "Sconosciuto Q.", "Nessuna", 6, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // non riconciliabile
const voti = join(dir, "Voti_Giornata_1.xlsx");
await wb2.xlsx.writeFile(voti);

// ── File Transfermarkt, CSV con punto e virgola ─────────────────────────
const tm = join(dir, "transfermarkt.csv");
writeFileSync(
  tm,
  [
    "nome;squadra;data_nascita;nazionalita;club_provenienza;campionato_provenienza;valore",
    `${esistenti[0].name};${esistenti[0].serieATeam};14/07/2005;Italia;;;12,50 mln €`,
    `${esistenti[1].name};${esistenti[1].serieATeam};02/03/1990;Brasile;Palmeiras;Brasileirão;4 mln €`,
    "Nessuno Y.;Inter;01/01/2000;Italia;;;1 mln €",
  ].join("\n"),
  "utf8",
);

// ── Import dal pannello ─────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());

await page.goto(`${BASE}/login`);
await page.fill("#email", "info@studiokubla.com");
await page.fill("#password", "dynasty");
await page.click('button:has-text("Entra")');
await page.waitForURL("**/lega");

async function importa(tipo, file, giornata) {
  await page.goto(`${BASE}/admin`);
  await page.selectOption("#kind", tipo);
  if (giornata) await page.fill("#matchday", String(giornata));
  await page.setInputFiles("#file", file);
  await page.click('button:has-text("Importa")');
  await page.waitForSelector(".avviso-ok, .avviso-errore", { timeout: 60000 });
  return (await page.locator(".avviso-ok, .avviso-errore").first().textContent()) ?? "";
}

// ── 1. Quotazioni ───────────────────────────────────────────────────────
const esitoQ = await importa("QUOTAZIONI", quotazioni);
check("import quotazioni riuscito", esitoQ.includes("4 righe applicate"), esitoQ.trim().slice(0, 70));

const nuovo = sql(`select role, "serieATeam" from "Player" where "lfcId"=999001;`);
check("giocatore nuovo creato dal listone", nuovo === "A|Como", nuovo);

const quotazione = sql(`select ps."quotationCurrent" from "PlayerSeason" ps
  join "Player" p on p.id=ps."playerId" where p."lfcId"=999001;`);
check("quotazione registrata", quotazione === "33.00", `${quotazione}`);

// ── 2. Voti ─────────────────────────────────────────────────────────────
const esitoV = await importa("VOTI", voti, 1);
check("import voti riuscito", esitoV.includes("3 righe applicate"), esitoV.trim().slice(0, 80));
check("riga non riconciliabile segnalata", esitoV.includes("1 righe non riconciliate"), esitoV.trim().slice(0, 90));

const stats = sql(`select ps.appearances, ps."voteSum", ps."consecutiveNoVote" from "PlayerSeason" ps
  join "Player" p on p.id=ps."playerId" where p."lfcId"=${esistenti[0].lfcId};`);
check("presenze e somma voti aggiornate", stats === "1|7.00|0", stats);

const senzaVoto = sql(`select ps.appearances, ps."consecutiveNoVote" from "PlayerSeason" ps
  join "Player" p on p.id=ps."playerId" where p."lfcId"=${esistenti[2].lfcId};`);
check("giornata senza voto conteggiata", senzaVoto === "0|1", senzaVoto);

const fanta = sql(`select mv."fantaVote" from "MatchdayVote" mv
  join "PlayerSeason" ps on ps.id=mv."playerSeasonId"
  join "Player" p on p.id=ps."playerId" where p."lfcId"=${esistenti[0].lfcId} and mv.matchday=1;`);
// 7 di voto + 3 per il gol + 1 per l'assist = 11
check("fantavoto calcolato con i bonus", Number(fanta) === 11, `${fanta}`);

const ammonito = sql(`select mv."fantaVote" from "MatchdayVote" mv
  join "PlayerSeason" ps on ps.id=mv."playerSeasonId"
  join "Player" p on p.id=ps."playerId" where p."lfcId"=${esistenti[1].lfcId} and mv.matchday=1;`);
check("malus ammonizione applicato", Number(ammonito) === 5, `${ammonito} (5,5 − 0,5)`);

const giornata = sql(`select matchday from "Season" where "isCurrent"=true;`);
check("la giornata della stagione avanza", giornata === "1", giornata);

// ── 3. Transfermarkt ────────────────────────────────────────────────────
const esitoT = await importa("TRANSFERMARKT", tm);
check("import Transfermarkt riuscito", esitoT.includes("2 righe applicate"), esitoT.trim().slice(0, 70));

const anagrafica = sql(`select to_char("birthDate", 'YYYY-MM-DD'), nationality, "tmMarketValue"
  from "Player" where "lfcId"=${esistenti[0].lfcId};`);
check("data di nascita e valore importati", anagrafica === "2005-07-14|Italia|12500000", anagrafica);

const provenienza = sql(`select "originClub", "originLeague" from "Player" where "lfcId"=${esistenti[1].lfcId};`);
check("club e campionato di provenienza importati", provenienza === "Palmeiras|Brasileirão", provenienza);

// ── 4. Tracciabilità ────────────────────────────────────────────────────
const runs = sql(`select count(*) from "ImportRun";`);
check("gli import sono tracciati", Number(runs) >= 3, `${runs} esecuzioni`);

const audit = sql(`select count(*) from "AuditEntry" where action='IMPORT';`);
check("gli import finiscono nel registro", Number(audit) >= 3, `${audit} righe`);

await page.goto(`${BASE}/registro`);
await page.waitForLoadState("networkidle");
const catena = (await page.locator(".avviso").first().textContent()) ?? "";
check("catena del registro integra dopo gli import", /Catena integra/.test(catena), catena.trim().slice(0, 50));

console.log(`\n${failures === 0 ? "Tutte le verifiche passate." : `${failures} verifiche fallite.`}`);
await browser.close();
process.exitCode = failures === 0 ? 0 : 1;
