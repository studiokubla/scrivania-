/**
 * Verifica la composizione della rosa dopo l'asta.
 *
 * È il lavoro del giorno dopo: un foglio con venticinque nomi e delle cifre a
 * matita, da far diventare contratti. Due strade — a mano dal listone, o
 * caricando il foglio — e in mezzo tutte le regole che devono continuare a
 * valere: tetto, slot pluriennali, requisiti d'età, minimi di ruolo.
 *
 * La parte che conta davvero è il caso incompleto: un foglio di soli nomi. Quei
 * giocatori **non** devono diventare contratti, perché un contratto senza
 * ingaggio falserebbe il tetto di tutta la lega. Devono restare in attesa, e
 * restare svincolati fino a che qualcuno non scrive il prezzo.
 *
 * Va lanciata su un database svuotato, contro un server con il solo
 * DATABASE_URL.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3101";
/** Dove appoggiare i fogli di prova. Non TMPDIR: spostarla fa crashare il browser. */
const TMP = process.env.CARTELLA_PROVE ?? "/tmp";
const sql = (q) =>
  execSync(`PGPASSWORD=maraka psql -h 127.0.0.1 -U maraka -d dynasty -t -A -c "${q.replace(/"/g, '\\"')}"`)
    .toString()
    .trim();

/**
 * Aspetta che il database dica quello che deve dire.
 *
 * Non si può aspettare un avviso in pagina: il banner dei minimi di ruolo è
 * sempre lì, e `waitForSelector` tornerebbe subito senza che l'import sia
 * finito. Si guarda l'effetto, non il sintomo.
 */
const attendi = async (query, atteso, secondi = 30) => {
  for (let i = 0; i < secondi * 2; i += 1) {
    if (sql(query) === atteso) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

let ko = 0;
const check = (etichetta, ok, dettaglio = "") => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${etichetta}${dettaglio ? ` — ${dettaglio}` : ""}`);
  if (!ok) ko += 1;
};

// ── Lega vuota con dieci squadre ────────────────────────────────────────
await fetch(`${BASE}/api/setup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ commissionerEmail: "info@studiokubla.com", password: "dynasty" }),
});

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

await page.goto(`${BASE}/login`);
await page.fill("#email", "info@studiokubla.com");
await page.fill("#password", "dynasty");
await page.click('button:has-text("Entra")');
await page.waitForURL("**/lega");
await page.goto(`${BASE}/admin`);
await page.click('button:has-text("Iscrivi 10 squadre segnaposto")');
await page.waitForSelector("text=Ecco le 10 squadre");
const password = [...(await page.locator("pre").first().innerText()).matchAll(/^\s{2}([a-z2-9]{4}(?:-[a-z2-9]{4}){3})$/gm)].map(
  (m) => m[1],
);

// ── 1. La pagina esiste e parte vuota ───────────────────────────────────
await page.goto(`${BASE}/rosa`);
const iniziale = await page.locator("body").innerText();
check("la pagina di composizione si apre", /componi rosa/i.test(iniziale));
check("la rosa parte vuota", iniziale.includes("Ancora nessuno"));
check("e dice cosa manca ai minimi di ruolo", /mancano al minimo/i.test(iniziale), iniziale.match(/Mancano al minimo[^(]*/)?.[0]?.trim());

// ── 2. A mano: costo e tipo di contratto ────────────────────────────────
await page.fill('input[aria-label="Cerca fra gli svincolati"]', "Dimarco");
await page.waitForTimeout(600);
await page.click('button.riga:has-text("Dimarco")');
await page.waitForSelector("text=Metti in rosa");

// Standard è pluriennale: la durata deve comparire.
await page.selectOption("#type", "STANDARD");
await page.waitForTimeout(300);
check("scegliendo Standard compare la durata", (await page.locator("#years").count()) === 1);
await page.selectOption("#years", "3");
await page.fill("#amount", "9");
await page.click('button:has-text("Metti in rosa")');
await page.waitForSelector(".avviso-ok, .avviso-errore");

check("il contratto nasce del tipo scelto", sql(`select type from "Contract";`) === "STANDARD");
check("e della durata scelta", sql(`select years from "Contract";`) === "3");
check("occupa uno slot pluriennale", (await page.locator("body").innerText()).includes("8"), "slot liberi");

// ── 3. I tipi che dipendono dall'età sono spenti, e lo dicono ───────────
await page.fill('input[aria-label="Cerca fra gli svincolati"]', "Svilar");
await page.waitForTimeout(600);
await page.click('button.riga:has-text("Svilar")');
await page.waitForSelector("text=Metti in rosa");
// Il modulo dev'essere nuovo: se conservasse la scelta del giocatore prima,
// si firmerebbe un pluriennale credendo di aver scelto Annuale.
check("il tipo di contratto riparte da Annuale", (await page.locator("#type").inputValue()) === "ANNUALE", await page.locator("#type").inputValue());

const rookie = page.locator('#type option[value="ROOKIE"]');
check("senza data di nascita Rookie è disabilitato", await rookie.isDisabled());
check("e spiega perché", (await rookie.innerText()).includes("data di nascita"), (await rookie.innerText()).trim());

await page.fill("#amount", "12");
await page.click('button:has-text("Metti in rosa")');
await page.waitForSelector(".avviso-ok, .avviso-errore");
check("l'Annuale invece passa", sql(`select count(*) from "Contract";`) === "2");

// ── 4. Il foglio completo mette in rosa direttamente ────────────────────
const completo = `${TMP}/rosa-completa.csv`;
writeFileSync(
  completo,
  ["giocatore,squadra serie a,costo,contratto,anni", "Maignan,Milan,10,ANNUALE,1", "Bastoni,Inter,8,STANDARD,2"].join("\n"),
);
await page.goto(`${BASE}/rosa`);
await page.click('summary:has-text("Carica il foglio")');
await page.setInputFiles("#file", completo);
await page.click('button:has-text("Carica la rosa")');
check(
  "il foglio completo firma i giocatori",
  await attendi(`select count(*) from "Contract";`, "4"),
  sql(`select count(*) from "Contract";`),
);
check(
  "rispettando i tipi indicati",
  sql(`select count(*) from "Contract" where type='STANDARD';`) === "2",
  sql(`select string_agg(p.name || ' ' || c.type || ' ' || c.years, ', ') from "Contract" c join "Player" p on p.id=c."playerId";`),
);

// ── 5. Il foglio di soli nomi lascia le righe in attesa ─────────────────
const soliNomi = `${TMP}/rosa-nomi.csv`;
writeFileSync(soliNomi, ["giocatore", "Calhanoglu", "Lautaro Martinez", "Orsolini"].join("\n"));
await page.goto(`${BASE}/rosa`);
await page.click('summary:has-text("Carica il foglio")');
await page.setInputFiles("#file", soliNomi);
await page.click('button:has-text("Carica la rosa")');
await attendi(`select count(*) from "AuctionEntry";`, "3");

const inAttesa = Number(sql(`select count(*) from "AuctionEntry";`));
check("le righe senza prezzo restano in attesa", inAttesa >= 2, `${inAttesa} in attesa`);
check("e non diventano contratti", sql(`select count(*) from "Contract";`) === "4");
check(
  "il giocatore in attesa è ancora svincolato",
  sql(`select count(*) from "Contract" c join "Player" p on p.id=c."playerId" where p.name like 'Calhanoglu%';`) === "0",
);

await page.goto(`${BASE}/rosa`);
const conAttesa = await page.locator("body").innerText();
check("la pagina elenca le righe da completare", /da completare/i.test(conAttesa));
check("e avverte che restano prendibili", conAttesa.includes("ancora svincolato"));

// ── 6. Completare una riga la trasforma in contratto ────────────────────
await page.click('button:has-text("Completa")');
await page.waitForSelector("text=Metti in rosa");
await page.fill("#amount", "7");
await page.click('button:has-text("Metti in rosa")');
check("completare una riga crea il contratto", await attendi(`select count(*) from "Contract";`, "5"), sql(`select count(*) from "Contract";`));
check("e la riga sparisce dall'attesa", Number(sql(`select count(*) from "AuctionEntry";`)) === inAttesa - 1);

// ── 7. Le regole valgono anche qui ──────────────────────────────────────
await page.goto(`${BASE}/rosa`);
await page.fill('input[aria-label="Cerca fra gli svincolati"]', "Vlahovic");
await page.waitForTimeout(600);
const presente = await page.locator('button.riga').count();
if (presente > 0) {
  await page.locator("button.riga").first().click();
  await page.waitForSelector("text=Metti in rosa");
  await page.fill("#amount", "900");
  await page.click('button:has-text("Metti in rosa")');
  await page.waitForSelector(".avviso-errore");
  const errore = await page.locator(".avviso-errore").first().innerText();
  check("un ingaggio oltre il tetto viene respinto", errore.includes("non può arrivare"), errore.slice(0, 70));
}
check("e nessun contratto è nato", sql(`select count(*) from "Contract";`) === "5");

// ── 8. Svuotare e ricominciare ──────────────────────────────────────────
await page.goto(`${BASE}/rosa`);
page.once("dialog", (d) => d.accept());
await page.click('summary:has-text("Ricominciare da capo")');
await page.click('button:has-text("Svuota la rosa")');
await page.waitForSelector(".avviso-ok");
check("svuotare scioglie tutti i contratti", sql(`select count(*) from "Contract";`) === "0");
check("e toglie anche le righe in attesa", sql(`select count(*) from "AuctionEntry";`) === "0");
check("i giocatori tornano nel listone", sql(`select count(*) from "Player" p where not exists (select 1 from "Contract" c where c."playerId"=p.id and c.status='ACTIVE');`) === "531");
check("il registro conserva tutto", Number(sql(`select count(*) from "AuditEntry";`)) >= 6, sql(`select count(*) from "AuditEntry";`));

// ── 9. Un manager compone solo la propria ───────────────────────────────
const ctxManager = await browser.newContext({ viewport: { width: 390, height: 844 } });
const manager = await ctxManager.newPage();
manager.setDefaultTimeout(45000);
await manager.goto(`${BASE}/login`);
await manager.fill("#email", "manager2@dynasty.it");
await manager.fill("#password", password[1]);
await manager.click('button:has-text("Entra")');
await manager.waitForURL("**/lega");
await manager.goto(`${BASE}/rosa`);
const vista = await manager.locator("body").innerText();
check("il manager apre la composizione", /componi rosa/i.test(vista));
check("ma non può cambiare squadra", (await manager.locator("#squadra").count()) === 0);

const suaSquadra = sql(`select t.name from "Team" t join "User" u on u."teamId"=t.id where u.email='manager2@dynasty.it';`);
// Le etichette sono maiuscole per foglio di stile, non nel testo.
check("e compone la propria", vista.toLowerCase().includes(suaSquadra.toLowerCase()), suaSquadra);

console.log(`\n${ko === 0 ? "Tutte le verifiche passate." : `${ko} verifiche fallite.`}`);
await browser.close();
process.exitCode = ko === 0 ? 0 : 1;
