/**
 * Estrae l'età di ogni giocatore dal listone in PDF di Fantacalcio Online.
 *
 * Il foglio ufficiale di Leghe Fantacalcio non porta le anagrafiche, e senza
 * l'età non si firmano contratti Rookie e Veteran (art. 4.2) né si sa chi può
 * entrare nel settore giovanile (art. 16.1). Questo PDF invece la stampa, in
 * una colonna «ETÀ», ed è la stessa fonte da cui esce il listone: i nomi
 * combaciano, cosa che con una fonte terza non succede quasi mai.
 *
 * Un'età non è una data di nascita, e non si finge che lo sia: si conserva per
 * quello che è, un numero valido per **questa** stagione. Le date vere, se
 * arriveranno, arriveranno dall'import Transfermarkt e avranno la precedenza.
 *
 *   node scripts/eta-da-pdf.mjs <file.pdf>
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import { normalizeName } from "../src/lib/import/match.ts";

const pdf = process.argv[2];
if (!pdf) {
  console.error("Uso: node scripts/eta-da-pdf.mjs <file.pdf>");
  process.exit(1);
}

const LISTONE = JSON.parse(readFileSync(new URL("../src/data/listone-2026-27.json", import.meta.url), "utf8"));

/** Le sigle del PDF, che non sono quelle del listone. */
const SIGLE = {
  ATA: "Atalanta",
  BOL: "Bologna",
  CAG: "Cagliari",
  COM: "Como",
  FIO: "Fiorentina",
  FRO: "Frosinone",
  GEN: "Genoa",
  INT: "Inter",
  JUV: "Juventus",
  LAZ: "Lazio",
  LEC: "Lecce",
  MIL: "Milan",
  MON: "Monza",
  NAP: "Napoli",
  PAR: "Parma",
  ROM: "Roma",
  SAS: "Sassuolo",
  TOR: "Torino",
  UDI: "Udinese",
  VEN: "Venezia",
};

const testo = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

// Il PDF impagina su tre colonne: quotazione, nome, sigla, età, e uno spazio
// bianco dove scrivere a mano quanto lo si è pagato. Si cercano quindi le
// quaterne ovunque cadano nella riga, senza presumere dove cominci una colonna.
const QUATERNA = /(\d{1,3})\s+([A-ZÀ-Ù][A-ZÀ-Ù'’.\- ]{1,28}?)\s+([A-Z]{3})\s+(\d{2})(?=\s|$)/g;

const dalPdf = [];
for (const riga of testo.split("\n")) {
  for (const m of riga.matchAll(QUATERNA)) {
    const squadra = SIGLE[m[3]];
    if (!squadra) continue;
    const età = Number(m[4]);
    if (età < 15 || età > 45) continue;
    dalPdf.push({ nome: m[2].trim(), squadra, età, quotazione: Number(m[1]) });
  }
}
console.log(`Dal PDF: ${dalPdf.length} righe riconosciute.`);

/** Indice per nome normalizzato e squadra: nel PDF i nomi sono in maiuscolo. */
const perChiave = new Map();
for (const r of dalPdf) {
  const chiave = `${normalizeName(r.nome)}|${r.squadra}`;
  if (!perChiave.has(chiave)) perChiave.set(chiave, r);
}
const perNome = new Map();
for (const r of dalPdf) {
  const n = normalizeName(r.nome);
  if (!perNome.has(n)) perNome.set(n, []);
  perNome.get(n).push(r);
}

/**
 * Il listone abbrevia il nome proprio in coda — «Martinez Jo.», «Pessina Mas.»
 * — mentre il PDF stampa solo il cognome, o il nome intero quando serve a
 * distinguere. Si prova prima l'abbinamento esatto, poi quello senza iniziale.
 */
const chiavi = (g) => {
  const pieno = normalizeName(g.nome);
  const senzaIniziale = normalizeName(g.nome.replace(/\s+[A-ZÀ-Ù][a-zà-ù]{0,3}\.?$/, ""));
  return [...new Set([pieno, senzaIniziale])];
};

/** Le parole di un nome che valgono per il confronto: via le iniziali puntate. */
const parole = (nome) =>
  normalizeName(nome.replace(/['’]/g, ""))
    .split(" ")
    .filter((w) => w.length >= 4);

/**
 * Due nomi si riferiscono alla stessa persona se condividono una parola piena,
 * o se una è il troncamento dell'altra: il PDF taglia a lunghezza fissa e
 * «MUSSOLI.» deve poter incontrare «Mussolini».
 */
const condivide = (a, b) =>
  a.some((x) => b.some((y) => x === y || (x.length >= 5 && y.startsWith(x)) || (y.length >= 5 && x.startsWith(y))));

const trovati = [];
const mancanti = [];
const ambigui = [];

for (const g of LISTONE.giocatori) {
  let scelto = null;
  for (const chiave of chiavi(g)) {
    scelto = perChiave.get(`${chiave}|${g.squadra}`);
    if (scelto) break;
  }

  // Le due stampe scrivono lo stesso giocatore in modi diversi: «N'Dicka» e
  // «NDICKA», «Tavares N.» e «NUNO TAVARES», «Zambo Anguissa» e «ANGUISSA»,
  // «Floriani Mussolini» troncato in «FLORIANI MUSSOLI.». Nessuna di queste
  // differenze regge un confronto fra stringhe, tutte reggono un confronto fra
  // le parole che le compongono — dentro la stessa squadra, dove gli omonimi
  // sono rarissimi.
  if (!scelto) {
    const mie = parole(g.nome);
    const nella = dalPdf.filter((r) => r.squadra === g.squadra && condivide(mie, parole(r.nome)));
    if (nella.length === 1) scelto = nella[0];
    else if (nella.length > 1) ambigui.push(`${g.nome} (${g.squadra}) → ${nella.map((r) => r.nome).join(", ")}`);
  }

  // Ultima spiaggia: nome unico in tutto il PDF, anche se in un'altra squadra —
  // fra le due stampe può esserci stato un trasferimento.
  if (!scelto) {
    for (const chiave of chiavi(g)) {
      const omonimi = perNome.get(chiave) ?? [];
      if (omonimi.length === 1) {
        scelto = omonimi[0];
        break;
      }
    }
  }

  if (scelto) trovati.push({ lfcId: g.lfcId, età: scelto.età });
  else mancanti.push(g);
}

const percentuale = ((trovati.length / LISTONE.giocatori.length) * 100).toFixed(1);
console.log(`\nAbbinati: ${trovati.length} su ${LISTONE.giocatori.length} (${percentuale}%)`);
console.log(`Non trovati: ${mancanti.length}`);
if (ambigui.length > 0) console.log(`Ambigui: ${ambigui.length} — ${ambigui.slice(0, 10).join(", ")}`);
if (mancanti.length > 0) {
  console.log(`\nNon trovati: ${mancanti.map((g) => `${g.nome} (${g.squadra})`).join(", ")}`);
}

// ── Si scrive nel listone ───────────────────────────────────────────────
//
// L'età va dove sta il resto dell'anagrafica, non in un file a parte: chi
// legge il listone deve trovarla lì, e chi lo rigenera dalle quotazioni nuove
// deve accorgersi se sparisce.
const perLfcId = new Map(trovati.map((t) => [t.lfcId, t.età]));
LISTONE.etàAllAnno = LISTONE.annoInizio;
for (const g of LISTONE.giocatori) {
  const età = perLfcId.get(g.lfcId);
  if (età !== undefined) g.età = età;
  else delete g.età;
}

writeFileSync(
  new URL("../src/data/listone-2026-27.json", import.meta.url),
  `${JSON.stringify(LISTONE)}\n`,
);
console.log(`\nScritto src/data/listone-2026-27.json con ${trovati.length} età.`);
