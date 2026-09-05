/**
 * Stampa il regolamento: quattro slide 16:9 in un PDF.
 *
 * Serve la cartella `lega/` su una porta locale — il browser deve poter
 * caricare i caratteri e la pagina da http, non da file:// — e poi:
 *
 *     python3 -m http.server 8099        # dalla cartella lega/
 *     node regolamento/stampa.mjs
 *
 * Prima di stampare misura ogni slide: se il contenuto supera i 720 px
 * viene tagliato dal PDF senza dirlo, e questa riga è l'unico posto in
 * cui te ne accorgi prima di mandarlo in giro.
 */
import { chromium } from "/home/user/scrivania-/dynasty/web/node_modules/playwright/index.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const INDIRIZZO = process.env.INDIRIZZO ?? "http://127.0.0.1:8099/regolamento/regolamento.html";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pagina = await (await browser.newContext({
  viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2,
})).newPage();
pagina.on("pageerror", (e) => console.log("ERRORE JS:", e.message));

await pagina.goto(INDIRIZZO, { waitUntil: "networkidle" });
await pagina.evaluate(() => document.fonts.ready);
await pagina.waitForTimeout(900);

const misure = await pagina.evaluate(() => [...document.querySelectorAll(".slide")]
  .map((s, i) => ({ slide: i + 1, alta: Math.round(s.scrollHeight) })));
for (const m of misure) {
  console.log(`slide ${m.slide}: ${m.alta} px su 720${m.alta > 720 ? "  ← TRABOCCA" : ""}`);
}

for (const [i, slide] of (await pagina.locator(".slide").all()).entries()) {
  await slide.screenshot({ path: join(QUI, `slide-${i + 1}.png`) });
}
await pagina.pdf({
  path: join(QUI, "Dynasty-League-regolamento.pdf"),
  width: "1280px", height: "720px", printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log("fatto: Dynasty-League-regolamento.pdf");
