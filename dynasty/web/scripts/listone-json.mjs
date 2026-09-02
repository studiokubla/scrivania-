/**
 * Converte il listone ufficiale in JSON.
 *
 * Il foglio di calcolo va bene per l'import dal pannello, ma non per il seed
 * dell'ambiente pubblicato: una funzione serverless non ha il file accanto a sé
 * e non deve portarsi dietro un lettore di xlsx per leggere dati che non
 * cambiano mai. Quindi il listone diventa un JSON committato, generato una
 * volta a stagione da qui.
 *
 *   node scripts/listone-json.mjs
 */
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const qui = dirname(fileURLToPath(import.meta.url));
const sorgente = resolve(qui, "..", "..", "dati", "Quotazioni_Fantacalcio_2026_27.xlsx");
const destinazione = resolve(qui, "..", "src", "data", "listone-2026-27.json");

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(sorgente);
const ws = wb.getWorksheet("Tutti");
if (!ws) throw new Error("Il listone non contiene il foglio «Tutti».");

const giocatori = [];
ws.eachRow((row, indice) => {
  if (indice < 3) return;
  const cella = (n) => row.getCell(n).value;
  const ruolo = String(cella(2) ?? "").trim();
  if (!["P", "D", "C", "A"].includes(ruolo)) return;

  giocatori.push({
    lfcId: Number(cella(1)),
    nome: String(cella(4) ?? "").trim(),
    ruolo,
    mantra: String(cella(3) ?? "").split(";").map((r) => r.trim()).filter(Boolean),
    squadra: String(cella(5) ?? "").trim(),
    quotazione: Number(cella(6)) || 1,
    quotazioneIniziale: Number(cella(7)) || 1,
    fvm: Number(cella(12)) || 0,
  });
});

const per = giocatori.reduce((acc, g) => ({ ...acc, [g.ruolo]: (acc[g.ruolo] ?? 0) + 1 }), {});
writeFileSync(destinazione, JSON.stringify({ stagione: "2026/27", annoInizio: 2026, giocatori }, null, 0) + "\n", "utf8");
console.log(`${giocatori.length} giocatori in ${destinazione}`);
console.log(`  portieri ${per.P} · difensori ${per.D} · centrocampisti ${per.C} · attaccanti ${per.A}`);
