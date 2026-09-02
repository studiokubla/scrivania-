/**
 * Compone la presentazione del regolamento in PDF.
 *
 * Le diapositive sono HTML — stessa identità visiva dell'applicazione, stessi
 * colori e stesso carattere — e vengono stampate a 1280×720, una per pagina.
 * Rifarla dopo una modifica al regolamento costa un comando.
 *
 *   node scripts/presentazione.mjs
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const qui = dirname(fileURLToPath(import.meta.url));
const sorgente = resolve(qui, "..", "..", "docs", "presentazione.html");
const destinazione = resolve(qui, "..", "..", "docs", "Regolamento-Dynasty-League-2026-27.pdf");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(`file://${sorgente}`, { waitUntil: "networkidle" });
// I caratteri arrivano da Google Fonts: senza questa attesa la prima pagina
// esce con il carattere di sistema.
await page.evaluate(() => document.fonts.ready);

await page.pdf({
  path: destinazione,
  width: "1280px",
  height: "720px",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});

await browser.close();
console.log(`Presentazione in ${destinazione}`);
