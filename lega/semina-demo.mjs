/**
 * Genera una lega dimostrativa credibile: dieci rose che rispettano davvero
 * tetto, minimi di ruolo e slot pluriennali. Una demo che sfora il tetto
 * mostrerebbe l'app in uno stato che nella lega vera non può esistere.
 */
import { readFileSync, writeFileSync } from "node:fs";

const listone = JSON.parse(readFileSync("/home/user/scrivania-/lega/listone.json", "utf8"));
const giocatori = listone.righe.map((r, i) => ({
  id: "g" + i, nome: r[0], ruolo: r[1], squadra: listone.squadre[r[2]],
  quotazione: r[3], eta: r[5] === -1 ? null : r[5],
}));

const REGOLE = { tetto: 85, rosaMin: 25, minimi: { P: 3, D: 8, C: 8, A: 6 }, slot: 9 };
const aQuarti = (m) => Math.round(m * 4);

const SQUADRE = [
  ["Real Marasca", "RMA", "Giulio", "#2C7A52"],
  ["Atletico Sorata", "ASO", "Marta", "#1B4A76"],
  ["Borgo United", "BUN", "Ivan", "#7C2620"],
  ["Vecchia Guardia", "VGU", "Paolo", "#6A4708"],
  ["Dinamo Colline", "DCO", "Sara", "#4A2A6B"],
  ["Sporting Fenice", "SFE", "Luca", "#1F6B6B"],
  ["Olympia Vallata", "OVA", "Chiara", "#8A3B6B"],
  ["Ardita Nova", "ANO", "Dario", "#3E5C1E"],
  ["Ferrovia FC", "FFC", "Elena", "#8A4B12"],
  ["Torre Nera", "TNE", "Michele", "#2E3B7A"],
];

/* Un generatore ripetibile: la demo deve essere identica a ogni build. */
let seme = 20260901;
const caso = () => (seme = (seme * 1103515245 + 12345) % 2147483648) / 2147483648;

/**
 * Il budget si divide PRIMA di comprare.
 *
 * Al primo tentativo ogni squadra pescava in ordine — portieri, difensori,
 * centrocampisti, attaccanti — e finiva i soldi a metà: le ultime rose
 * restavano senza attaccanti, che è esattamente la rosa che il regolamento
 * vieta. Qui ogni posto riceve la sua quota prima che si compri qualcuno, con
 * i ruoli offensivi pesati di più perché è lì che a un'asta vanno i soldi.
 */
const PESO_RUOLO = { P: 0.7, D: 0.9, C: 1.15, A: 1.6 };

function quoteDellaRosa(ordine, budget) {
  /* I primi di ogni ruolo sono i titolari e pesano il doppio degli ultimi. */
  const visti = { P: 0, D: 0, C: 0, A: 0 };
  const pesi = ordine.map((r) => {
    const posizione = visti[r]++;
    const decadenza = Math.max(0.35, 1 - posizione * 0.16);
    return PESO_RUOLO[r] * decadenza * (0.85 + caso() * 0.3);
  });
  const somma = pesi.reduce((a, b) => a + b, 0);
  return pesi.map((p) => Math.max(0.25, Math.round((budget * p / somma) * 4) / 4));
}

/**
 * I ragazzi da settore giovanile restano fuori dalle rose.
 *
 * È come va in una lega dinastica — un diciottenne quotato un milione sta nel
 * settore giovanile, non fra i venticinque — ed è anche l'unico modo perché la
 * demo mostri il filtro Primavera con qualcosa dentro: alla prima prova le
 * dieci rose se li erano presi quasi tutti e nel listone ne restavano quattro.
 */
const daPrimavera = (g) => g.quotazione <= 3 && (g.eta == null || g.eta <= 20);

const perRuolo = (r) => giocatori
  .filter((g) => g.ruolo === r && !daPrimavera(g))
  .sort((a, b) => b.quotazione - a.quotazione);
const disponibili = { P: perRuolo("P"), D: perRuolo("D"), C: perRuolo("C"), A: perRuolo("A") };
const presi = new Set();

/**
 * Il giocatore libero di quel ruolo più vicino alla cifra che si vuole
 * spendere. Se non ne resta nessuno in quella fascia si prende il più
 * economico: meglio una rosa completa con un raccattato in fondo che una
 * rosa incompleta, che è quello che succedeva prima.
 */
function pesca(ruolo, quota) {
  const liberi = disponibili[ruolo].filter((g) => !presi.has(g.id));
  if (!liberi.length) return null;
  const vicini = [...liberi].sort((a, b) => Math.abs(a.quotazione - quota) - Math.abs(b.quotazione - quota));
  const scelto = vicini[Math.floor(caso() * Math.min(4, vicini.length))];
  presi.add(scelto.id);
  return scelto;
}

const rose = {};
const registro = [];
const quandoBase = Date.parse("2026-09-01T21:00:00Z");
let minuto = 0;

SQUADRE.forEach(([nome], indice) => {
  const id = "s" + (indice + 1);
  const contratti = [];

  /* Prima i minimi di ruolo, poi si completa fino a venticinque. */
  const ordine = [];
  for (const r of ["P", "D", "C", "A"]) for (let i = 0; i < REGOLE.minimi[r]; i++) ordine.push(r);
  while (ordine.length < REGOLE.rosaMin) ordine.push(["D", "C", "A"][Math.floor(caso() * 3)]);

  /* Nessuno spende fino all'ultimo centesimo del tetto: le squadre vere
     tengono da parte qualcosa per il mercato di novembre. */
  const budget = 68 + Math.round(caso() * 40) / 4;
  const quote = quoteDellaRosa(ordine, budget);

  let speso = 0;
  let slotUsati = 0;

  ordine.forEach((ruolo, posto) => {
    const restanti = ordine.length - posto - 1;
    const spazio = aQuarti(REGOLE.tetto) - speso;
    /* Quanto posso spendere qui lasciando 0,25 M per ogni posto che resta. */
    const massimo = (spazio - restanti) / 4;
    if (massimo < 0.25) return;

    const quota = Math.min(quote[posto], massimo);
    const g = pesca(ruolo, quota);
    if (!g) return;

    const ingaggio = Math.max(0.25, Math.min(quota, massimo));
    const quarti = aQuarti(ingaggio);

    /* Un pluriennale ai giovani e ai migliori, finché ci sono slot. */
    let tipo = "ANNUALE", anni = 1;
    if (slotUsati < REGOLE.slot && caso() < 0.45) {
      if (g.eta != null && g.eta <= 22 && ingaggio <= 6) { tipo = "ROOKIE"; anni = 2 + Math.floor(caso() * 3); }
      else if (g.eta != null && g.eta >= 30 && ingaggio <= 10) { tipo = "VETERAN"; anni = 2; }
      else { tipo = "STANDARD"; anni = 2 + Math.floor(caso() * 2); }
      slotUsati++;
    }

    contratti.push({ giocatoreId: g.id, nome: g.nome, ruolo: g.ruolo, tipo, anni, ingaggio: quarti,
                     firmato: new Date(quandoBase + minuto * 60000).toISOString() });
    speso += quarti;

    if (registro.length < 60) {
      registro.push({
        quando: new Date(quandoBase + (minuto++) * 60000).toISOString(),
        cosa: "contratto",
        dettaglio: `${g.nome} a ${nome} per ${String(ingaggio).replace(".", ",")} M × ${anni} ${anni === 1 ? "anno" : "anni"} (${tipo[0] + tipo.slice(1).toLowerCase()})`,
        squadraId: id, chi: nome,
      });
    }
    minuto++;
  });

  rose[id] = { contratti, aggiornata: new Date(quandoBase + minuto * 60000).toISOString() };
});

/* Controllo che la demo rispetti il regolamento, prima di scriverla. */
let problemi = 0;
SQUADRE.forEach(([nome], i) => {
  const c = rose["s" + (i + 1)].contratti;
  const speso = c.reduce((s, x) => s + x.ingaggio, 0) / 4;
  const conta = { P: 0, D: 0, C: 0, A: 0 };
  for (const x of c) conta[x.ruolo]++;
  const slot = c.filter((x) => x.tipo !== "ANNUALE" && x.tipo !== "TAMPONE").length;
  const guai = [];
  if (speso > REGOLE.tetto) guai.push(`sfora (${speso} M)`);
  if (c.length < REGOLE.rosaMin) guai.push(`solo ${c.length} giocatori`);
  for (const r of ["P", "D", "C", "A"]) if (conta[r] < REGOLE.minimi[r]) guai.push(`${conta[r]}${r} sotto il minimo`);
  if (slot > REGOLE.slot) guai.push(`${slot} slot`);
  if (guai.length) { problemi++; console.log("  ✗", nome, guai.join(", ")); }
  else console.log(`  ${nome.padEnd(18)} ${c.length} giocatori · ${String(speso).replace(".", ",").padStart(5)} M · ${slot} slot`);
});

const dati = {
  "lega/config": { nome: "Lega dimostrativa", stagione: listone.stagione, pinCommissioner: "1234", fondata: new Date(quandoBase).toISOString() },
};
SQUADRE.forEach(([nome, sigla, presidente, colore], i) => {
  dati["squadre/s" + (i + 1)] = { nome, sigla, presidente, pin: "1234", colore, ordine: i + 1 };
  dati["rose/s" + (i + 1)] = rose["s" + (i + 1)];
});
registro.reverse().forEach((v, i) => { dati["registro/r" + String(i).padStart(3, "0")] = v; });

writeFileSync("/home/user/scrivania-/lega/demo-dati.json", JSON.stringify(dati));
const liberiPrimavera = giocatori.filter((g) => daPrimavera(g) && !presi.has(g.id)).length;
console.log(problemi
  ? `\n✗ ${problemi} rose fuori regolamento`
  : `\n✓ Dieci rose valide · ${presi.size} tesserati · ${liberiPrimavera} idonei al settore giovanile ancora liberi · ${registro.length} voci di registro`);
process.exitCode = problemi ? 1 : 0;
