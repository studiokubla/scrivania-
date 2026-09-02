/**
 * Estrae il listone calciatori da un PDF di sole immagini e produce un CSV
 * pronto per l'import delle quotazioni.
 *
 * I PDF del listone esportati da fantacalcio.it non hanno un livello di testo:
 * sono screenshot. Quindi si passa dall'OCR, e l'OCR sbaglia. Per non fidarsi
 * ciecamente, ogni pagina viene letta **due volte con impostazioni diverse** e le
 * due letture vengono confrontate riga per riga: quello su cui non concordano
 * finisce in un rapporto di righe dubbie, da guardare a occhio prima di caricarle.
 *
 * Servono `pdfimages` (poppler-utils) e `tesseract`.
 *
 *   node scripts/listone-da-pdf.mjs listone.pdf --out listone.csv
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const RUOLI = new Set(["P", "D", "C", "A"]);

/**
 * Le venti squadre di Serie A si ricavano dal listone stesso, non da un elenco
 * scritto a mano: cambiano ogni anno. Si prendono i nomi che compaiono almeno
 * dieci volte — una rosa intera — e tutto il resto viene ricondotto a quelli.
 */
function squadreRicorrenti(righe) {
  const conteggio = new Map();
  for (const r of righe) conteggio.set(r.squadra, (conteggio.get(r.squadra) ?? 0) + 1);
  return [...conteggio.entries()]
    .filter(([, n]) => n >= 10)
    .map(([nome]) => nome)
    .sort();
}

/** Distanza di Levenshtein, per ricondurre «Juventus» letto «Juvenlus». */
function distanza(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[m][n];
}

function correggiSquadra(nome, valide) {
  if (valide.includes(nome)) return { nome, corretto: false };
  let migliore = null;
  let minimo = Infinity;
  for (const v of valide) {
    const d = distanza(nome.toLowerCase(), v.toLowerCase());
    if (d < minimo) {
      minimo = d;
      migliore = v;
    }
  }
  // Oltre due caratteri di differenza non è più una svista dell'OCR
  return minimo <= 2 ? { nome: migliore, corretto: true } : { nome, corretto: false, dubbio: true };
}

/**
 * Una riga del listone:
 *   #12  D(Dd,E)  Bakoune  Monza  4(4)  2(2)
 *
 * Il valore fra parentesi nelle ultime due colonne è quello Mantra, non una
 * ripetizione: per i portieri coincide, per gli altri ruoli no.
 *
 * Nome e squadra non si separano con un'espressione regolare, perché i nomi
 * contengono spazi e iniziali puntate — «De Gea», «Christensen O.», «Martinez Jo.»
 * — e qualunque confine indovinato sbaglia. Si cattura il blocco intero e lo si
 * divide sull'ultima parola, che è sempre la squadra: in Serie A i nomi dei club
 * sono tutti di una parola sola.
 */
/**
 * Il numero di riga non entra nell'espressione: è la cosa che l'OCR sbaglia di
 * più — «#1» letto «HAO», «#42» letto «#A2» — e pretenderlo faceva perdere
 * decine di giocatori. Non serve a niente, quindi si accetta qualunque cosa lo
 * preceda e lo si legge solo se per caso è un numero.
 *
 * Nelle due colonne numeriche si accettano anche le lettere che l'OCR confonde
 * con le cifre in questo carattere (A per 4, l per 1, O per 0): sono campi di
 * sole cifre per costruzione, quindi ricondurle è sicuro.
 */
const CIFRE = "[0-9AaIilLoOsSbBzZgGtT]";
const RIGA = new RegExp(
  `^\\S*\\s*([PDCA])\\s*\\(([^)]*)\\)\\s+(.+?)\\s+` +
    `(${CIFRE}{1,3})\\s*\\(\\s*(${CIFRE}{1,3})\\s*\\)\\s+` +
    `(${CIFRE}{1,3})\\s*\\(\\s*(${CIFRE}{1,3})\\s*\\)\\s*$`,
);

const SOSTITUZIONI = { A: "4", a: "4", I: "1", i: "1", l: "1", L: "1", o: "0", O: "0", s: "5", S: "5", b: "6", B: "8", z: "2", Z: "2", g: "9", G: "6", t: "7", T: "7" };

function numero(grezzo) {
  const cifre = [...grezzo].map((c) => SOSTITUZIONI[c] ?? c).join("");
  const n = Number(cifre);
  return Number.isFinite(n) ? n : null;
}

/** L'indice di riga, quando l'OCR lo ha letto come numero. */
function indiceDi(linea) {
  const m = /^#?\s*(\d{1,3})\s/.exec(linea);
  return m ? Number(m[1]) : null;
}

function analizza(testo) {
  const righe = [];
  // Righe che hanno l'aspetto di un giocatore ma che l'espressione non riesce a
  // leggere: sono il primo posto dove guardare quando i conti non tornano.
  const illeggibili = [];

  for (const grezza of testo.split("\n")) {
    const linea = grezza.trim();
    if (!linea) continue;

    const m = RIGA.exec(linea);
    if (!m) {
      if (/[PDCA]\s*\([^)]*\)/.test(linea)) illeggibili.push(linea);
      continue;
    }

    const [, ruolo, mantra, blocco, fvm, fvmM, quot, quotM] = m;
    if (!RUOLI.has(ruolo)) continue;

    const valori = [fvm, fvmM, quot, quotM].map(numero);
    if (valori.some((v) => v === null || v < 1 || v > 999)) {
      illeggibili.push(linea);
      continue;
    }

    const parti = blocco.replace(/\s+/g, " ").trim().split(" ");
    if (parti.length < 2) {
      illeggibili.push(linea);
      continue;
    }
    const squadra = parti.pop();
    const nome = parti.join(" ");

    righe.push({
      sezione: ruolo,
      indice: indiceDi(linea),
      ruolo,
      // L'OCR legge il punto e virgola dei ruoli Mantra come virgola o punto
      mantra: mantra.replace(/[.,]/g, ";").replace(/\s+/g, "").replace(/;+/g, ";").replace(/^;|;$/g, ""),
      nome,
      squadra,
      fvm: valori[0],
      fvmMantra: valori[1],
      quotazione: valori[2],
      quotazioneMantra: valori[3],
      grezza: linea,
    });
  }
  righe.illeggibili = illeggibili;
  return righe;
}

/**
 * Le due letture si confrontano per nome e ruolo, non per numero di riga: il
 * numero è la cosa che l'OCR sbaglia più spesso (un «#1» letto «#4»), e usarlo
 * come chiave farebbe sembrare diverse due letture identiche.
 */
function chiave(r) {
  return `${r.ruolo}|${r.nome.toLowerCase().replace(/[^a-z]/g, "")}`;
}

function main() {
  const [pdf] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const outIndex = process.argv.indexOf("--out");
  const out = outIndex > -1 ? process.argv[outIndex + 1] : "listone.csv";
  if (!pdf) {
    console.error("Uso: node scripts/listone-da-pdf.mjs <listone.pdf> [--out listone.csv]");
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), "listone-"));
  console.log(`Estrazione delle pagine da ${basename(pdf)}…`);
  execFileSync("pdfimages", ["-j", pdf, join(dir, "pag")]);

  const pagine = readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
  console.log(`${pagine.length} pagine.\n`);

  // Due letture indipendenti: se concordano l'una conferma l'altra
  const letture = { psm6: [], psm4: [] };
  const illeggibili = [];
  for (const [i, pagina] of pagine.entries()) {
    process.stdout.write(`  pagina ${i + 1}/${pagine.length}\r`);
    for (const [nome, psm] of [["psm6", "6"], ["psm4", "4"]]) {
      const base = join(dir, `${pagina}-${nome}`);
      execFileSync("tesseract", [join(dir, pagina), base, "--psm", psm, "-l", "eng"], { stdio: "ignore" });
      const lette = analizza(readFileSync(`${base}.txt`, "utf8"));
      letture[nome].push(...lette);
      if (nome === "psm6") illeggibili.push(...lette.illeggibili);
    }
  }
  console.log(`\nLettura A: ${letture.psm6.length} righe · lettura B: ${letture.psm4.length} righe\n`);

  const perChiave = new Map(letture.psm4.map((r) => [chiave(r), r]));
  const valide = squadreRicorrenti(letture.psm6);
  console.log(`Squadre riconosciute (${valide.length}): ${valide.join(", ")}\n`);

  const finali = [];
  const dubbie = [];

  for (const r of letture.psm6) {
    const altra = perChiave.get(chiave(r));
    const problemi = [];

    if (!altra) problemi.push("la seconda lettura non ha questa riga");
    else {
      if (altra.nome !== r.nome) problemi.push(`nome: «${r.nome}» / «${altra.nome}»`);
      if (altra.quotazione !== r.quotazione) problemi.push(`quotazione: ${r.quotazione} / ${altra.quotazione}`);
      if (altra.ruolo !== r.ruolo) problemi.push(`ruolo: ${r.ruolo} / ${altra.ruolo}`);
      if (altra.squadra !== r.squadra) problemi.push(`squadra: «${r.squadra}» / «${altra.squadra}»`);
    }

    const squadra = correggiSquadra(r.squadra, valide);
    if (squadra.dubbio) problemi.push(`squadra non riconosciuta: «${r.squadra}»`);

    // Per i portieri i due valori coincidono sempre: se differiscono è un errore di lettura
    if (r.ruolo === "P" && r.quotazione !== r.quotazioneMantra) {
      problemi.push(`portiere con quotazioni diverse: ${r.quotazione}(${r.quotazioneMantra})`);
    }

    const riga = { ...r, squadra: squadra.nome };
    if (problemi.length > 0) dubbie.push({ ...riga, problemi });
    finali.push(riga);
  }

  // Quante righe dovrebbero esserci: l'indice più alto letto in ogni sezione.
  // Un singolo indice sbagliato non falsa il conto, una riga saltata sì.
  const mancanti = [];
  for (const sezione of ["P", "D", "C", "A"]) {
    const dellaSezione = finali.filter((r) => r.sezione === sezione);
    const atteso = Math.max(0, ...dellaSezione.map((r) => r.indice ?? 0));
    if (dellaSezione.length < atteso) {
      mancanti.push(`${sezione}: ${dellaSezione.length} lette su ${atteso} attese`);
    }
  }

  const intestazione = "nome;squadra;r;rm;qt_a;qt_i;fvm";
  const corpo = finali
    .sort((a, b) => "PDCA".indexOf(a.sezione) - "PDCA".indexOf(b.sezione) || a.indice - b.indice)
    .map((r) => [r.nome, r.squadra, r.ruolo, r.mantra, r.quotazione, r.quotazione, r.fvm].join(";"));
  writeFileSync(out, [intestazione, ...corpo].join("\n"), "utf8");

  console.log(`Scritte ${finali.length} righe in ${out}`);
  console.log(`  portieri ${finali.filter((r) => r.sezione === "P").length}`);
  console.log(`  difensori ${finali.filter((r) => r.sezione === "D").length}`);
  console.log(`  centrocampisti ${finali.filter((r) => r.sezione === "C").length}`);
  console.log(`  attaccanti ${finali.filter((r) => r.sezione === "A").length}`);

  if (illeggibili.length > 0) {
    console.log(`\n${illeggibili.length} righe non interpretabili dalla prima lettura:`);
    for (const l of illeggibili.slice(0, 25)) console.log(`  ${l}`);
  }

  if (mancanti.length > 0) {
    console.log(`\nRighe che l'OCR potrebbe aver saltato:\n  ${mancanti.join("\n  ")}`);
  }

  if (dubbie.length > 0) {
    console.log(`\n${dubbie.length} righe su cui le due letture non concordano:\n`);
    for (const d of dubbie) {
      console.log(`  ${d.sezione}  ${d.nome} — ${d.squadra}`);
      for (const p of d.problemi) console.log(`      ${p}`);
    }
    writeFileSync(out.replace(/\.csv$/, "-dubbie.json"), JSON.stringify(dubbie, null, 2), "utf8");
    console.log(`\nDettaglio in ${out.replace(/\.csv$/, "-dubbie.json")}: vanno guardate prima di caricare.`);
  } else {
    console.log("\nLe due letture concordano su tutte le righe.");
  }
}

main();
