/**
 * Verifica end-to-end del mercato: offerta sigillata, rilancio, apertura delle buste,
 * assegnazione e registro. Le 24 ore di attesa si simulano spostando `closesAt`
 * nel passato direttamente sul database, come farebbe il tempo.
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const BASE = 'http://127.0.0.1:3100';
const PSQL = `PGPASSWORD=maraka psql -h 127.0.0.1 -U maraka -d dynasty -t -A`;
const sql = (q) => execSync(`${PSQL} -c "${q.replace(/"/g, '\\"')}"`).toString().trim();

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function loginAs(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/login`);
  await page.fill('#email', email);
  await page.fill('#password', 'dynasty');
  await page.click('button:has-text("Entra")');
  await page.waitForURL('**/lega');
  return { page, errs };
}

let failures = 0;
function check(label, condition, detail = '') {
  console.log(`${condition ? 'OK  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures += 1;
}

// Un attaccante svincolato con quotazione bassa, per non urtare i limiti
const target = sql(`select p.name from "Player" p
  left join "Contract" c on c."playerId"=p.id and c.status='ACTIVE'
  where c.id is null and p.role='A' limit 1;`);
console.log(`Obiettivo dell'asta: ${target}\n`);

// ── 1. Il primo manager apre una contesa ────────────────────────────────
const m1 = await loginAs('manager1@dynasty.it');
await m1.page.goto(`${BASE}/mercato`);
await m1.page.fill('#cerca', target.split(' ')[0]);
await m1.page.click(`button:has-text("${target}")`);
await m1.page.fill('#ingaggio', '2');
await m1.page.fill('#anni', '1');
await m1.page.click('button:has-text("Invia offerta sigillata")');
await m1.page.waitForSelector('.avviso-ok, .avviso-errore', { timeout: 15000 });
const esito1 = await m1.page.locator('.avviso-ok, .avviso-errore').first().textContent();
check('offerta accettata', (await m1.page.locator('.avviso-ok').count()) > 0, esito1?.slice(0, 80));

const offerCount = sql(`select count(*) from "MarketOffer" where status='SEALED';`);
check('offerta salvata sigillata', offerCount === '1', `${offerCount} offerte SEALED`);

// ── 2. Il registro non rivela l'importo ─────────────────────────────────
const summary = sql(`select summary from "AuditEntry" where action='OFFER_SUBMITTED' order by "createdAt" desc limit 1;`);
check("il registro non rivela l'importo", !summary.includes('2 M') && summary.includes(target), summary.slice(0, 90));

// ── 3. Il contatore delle offerte è sceso ───────────────────────────────
const used = sql(`select used from "OptionUsage" where type='FREE_AGENCY_OFFER';`);
check('contatore offerte consumato', used === '1', `used=${used}`);

// ── 4. Un secondo manager rilancia ──────────────────────────────────────
const m2 = await loginAs('manager2@dynasty.it');
await m2.page.goto(`${BASE}/mercato`);
// Si guarda il testo della pagina, non la forma che ha: se domani le contese
// diventano schede invece di righe, questa verifica deve continuare a valere.
const contese = await m2.page.locator('body').innerText();
check('la contesa è visibile agli altri', contese.includes(target));
check("ma non l'importo offerto", !contese.includes('2 M') && !contese.includes('2,00'));

await m2.page.fill('#cerca', target.split(' ')[0]);
await m2.page.click(`button:has-text("${target}")`);
await m2.page.fill('#ingaggio', '3.5');
await m2.page.click('button:has-text("Invia offerta sigillata")');
await m2.page.waitForSelector('.avviso-ok, .avviso-errore', { timeout: 15000 });
check('rilancio accettato', (await m2.page.locator('.avviso-ok').count()) > 0);

const used2 = sql(`select coalesce(max(used),0) from "OptionUsage" where type='FREE_AGENCY_OFFER' and "teamId" <> (select "teamId" from "User" where email='manager1@dynasty.it');`);
check("rilanciare non consuma un'offerta", used2 === '0', `used=${used2}`);

// ── 5. Scadono le 24 ore ────────────────────────────────────────────────
sql(`update "MarketOffer" set "closesAt" = now() - interval '1 minute' where status='SEALED';`);
await m1.page.goto(`${BASE}/mercato`);
await m1.page.waitForLoadState('networkidle');

const winner = sql(`select t.name from "Contract" c
  join "Player" p on p.id=c."playerId" join "Team" t on t.id=c."teamId"
  where p.name='${target}' and c.status='ACTIVE';`);
check("il giocatore è andato all'offerta più alta", winner.length > 0, `assegnato a ${winner}`);

const expectedWinner = sql(`select t.name from "Team" t join "User" u on u."teamId"=t.id where u.email='manager2@dynasty.it';`);
check('ha vinto chi ha offerto di più', winner === expectedWinner, `${winner} vs atteso ${expectedWinner}`);

const salary = sql(`select "baseSalary" from "Contract" c join "Player" p on p.id=c."playerId" where p.name='${target}' and c.status='ACTIVE';`);
check("l'ingaggio è quello offerto", salary === '3.50', `${salary} M`);

const reveal = sql(`select summary from "AuditEntry" where action='OFFER_RESOLVED' order by "createdAt" desc limit 1;`);
check("all'apertura il registro pubblica l'esito", reveal.includes('3,5 M') && reveal.includes('2 offerte'), reveal.slice(0, 110));

// ── 6. La catena del registro regge ─────────────────────────────────────
await m1.page.goto(`${BASE}/registro`);
const chainOk = await m1.page.locator('.avviso-ok').first().textContent();
check('catena del registro integra', /Catena integra/.test(chainOk ?? ''), (chainOk ?? '').trim().slice(0, 60));

const jsErrors = m1.errs.length + m2.errs.length;
check('nessun errore JavaScript', jsErrors === 0, `${jsErrors} errori`);

console.log(`\n${failures === 0 ? 'Tutte le verifiche passate.' : `${failures} verifiche fallite.`}`);
await browser.close();
process.exitCode = failures === 0 ? 0 : 1;
