import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const errors = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

async function go(path, name) {
  const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
  const status = res?.status();
  const title = await page.locator('h1').first().textContent().catch(() => null);
  console.log(`${status}  ${path.padEnd(28)} h1="${(title||'').trim()}"`);
  if (name) await page.screenshot({ path: `shot-${name}.png`, fullPage: true });
  return status;
}

await go('/login', 'login');
await page.fill('#email', 'manager1@marakalegue.it');
await page.fill('#password', 'marakalegue');
await page.click('button:has-text("Entra")');
await page.waitForURL('**/lega', { timeout: 20000 });
console.log('login manager OK');

await go('/lega', 'lega');
const teamLink = await page.locator('a[href^="/squadra/"]').first().getAttribute('href');
await go(teamLink, 'squadra');
await go('/mercato', 'mercato');
await go('/mercato/scambi', 'scambi');
await go('/registro', 'registro');

console.log('\nErrori raccolti:', errors.length);
for (const e of errors.slice(0, 15)) console.log(' -', e);

await browser.close();
