/**
 * Rimette insieme le tre pagine da `app.html`.
 *
 * L'applicazione è scritta una volta sola e viene servita in tre posti — il
 * sito pubblico, la demo, la pagina su claude.ai — che si distinguono solo per
 * il guscio che le sta intorno: quello decide da dove arriva il database.
 * Ricomporle a mano vorrebbe dire, prima o poi, correggere un difetto in una e
 * lasciarlo nelle altre.
 *
 *   node componi.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const leggi = (nome) => readFileSync(new URL(nome, import.meta.url), "utf8");

/* ── Prima di tutto: il listone dentro l'applicazione ──────────
   Il listone viaggia incorporato nella pagina, e la prima volta ce l'ho messo
   a mano. Quando poi è stato rigenerato — per aggiungere i ruoli Mantra — il
   file aggiornato è rimasto fuori, e l'applicazione ha continuato a servire
   quello vecchio senza dire niente. Adesso lo rimette a posto questo script:
   `listone.json` è la fonte, `app.html` ne è solo il contenitore. */
const listone = leggi("listone.json").trim();
let app = leggi("app.html");
const sostituito = app.replace(
  /const LISTONE_GREZZO = .*?;\n/s,
  "const LISTONE_GREZZO = " + listone + ";\n",
);
if (sostituito !== app) {
  writeFileSync(new URL("app.html", import.meta.url), sostituito);
  app = sostituito;
  console.log("listone.json → app.html   il listone è stato riallineato");
}

/* ── Il sito pubblico: Firebase ───────────────────────────── */
writeFileSync(new URL("index.html", import.meta.url), leggi("sito-guscio.html") + app + "\n</body>\n</html>\n");

/* ── La demo: un database finto che non esce dal browser ──── */
const demo = leggi("demo-guscio.html").replace("__DATI__", leggi("demo-dati.json")) + app + `
<div class="striscia-demo">
  <span><b>Demo.</b> Dieci squadre, le rose già fatte, le società con storie diverse e una
  trattativa in corso. Quello che cambi resta nel tuo browser e non lo vede nessun altro:
  nell'app vera i dieci presidenti lavorano sulla stessa lega, insieme.</span>
  <button type="button" onclick="rimettiLaDemo()">Rimetti la lega di esempio</button>
</div>
</body>
</html>
`;
writeFileSync(new URL("demo.html", import.meta.url),
  demo.replace("<title>Dynasty League</title>", "<title>Dynasty League — demo</title>"));

const kb = (t) => (t.length / 1024).toFixed(1) + " KB";
console.log(`index.html  ${kb(leggi("index.html"))}   il sito pubblico, su Firebase`);
console.log(`demo.html   ${kb(leggi("demo.html"))}   la demo da mandare in giro`);
console.log(`app.html    ${kb(app)}   l'applicazione, da pubblicare anche come artifact`);
