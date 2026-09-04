/**
 * Prepara il marchio per l'applicazione: gli allinea il fondo, lo
 * ritaglia, gli sfuma i bordi e lo comprime.
 *
 * Scontornarlo — separare il disegno dal fondo con la trasparenza — non
 * si può: metà del marchio è nera, il fondo è scuro, e qualunque soglia
 * che tolga il fondo si porta via anche i contorni. Provato: resta un
 * merletto di bordi lime.
 *
 * Quello che si può fare è un'altra cosa. Il fondo dell'immagine è un
 * verde scuro con una vignettatura; il fondo dell'applicazione è un
 * verde scuro. Si stima il primo e lo si sposta sul secondo — pixel per
 * pixel, togliendo la vignettatura e rimettendo il nostro colore — e a
 * quel punto il rettangolo dell'immagine non si vede più, perché non c'è
 * niente da vedere: è dello stesso colore di quello che ha intorno. La
 * sfumatura ai bordi copre quel che resta.
 *
 * Il lavoro lo fa una tela dentro Chromium: qui non c'è nessuna libreria
 * di immagini, e per tre operazioni non vale la pena installarla.
 */
import { chromium } from "/home/user/scrivania-/dynasty/web/node_modules/playwright/index.mjs";
import { writeFileSync } from "node:fs";
const D = "/tmp/claude-0/-home-user-scrivania-/b84b7adb-9374-50b4-bfac-1017622f24b8/scratchpad/logo/";

/** Il fondo dell'applicazione, dove il marchio va appoggiato. */
const NOSTRO = [26, 33, 22];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext()).newPage();
await page.goto("http://127.0.0.1:8098/");

async function lavora(opzioni) {
  return page.evaluate(async (o) => {
    const img = new Image();
    img.src = "originale.png";
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const dati = x.getImageData(0, 0, c.width, c.height);
    const p = dati.data;

    /* Il profilo radiale del fondo, misurato solo nella cornice esterna
       dove il marchio non arriva, e poi esteso verso il centro. */
    const cx = c.width / 2, cy = c.height * 0.42;
    const rMax = Math.hypot(Math.max(cx, c.width - cx), Math.max(cy, c.height - cy));
    const BIN = 200, somma = Array.from({ length: BIN }, () => [0, 0, 0, 0]);
    for (let py = 0; py < c.height; py += 2)
      for (let px = 0; px < c.width; px += 2) {
        if (px > 108 && px < c.width - 108 && py > 196 && py < c.height - 226) continue;
        const b = Math.min(BIN - 1, Math.floor(Math.hypot(px - cx, py - cy) / rMax * BIN));
        const k = (py * c.width + px) * 4;
        somma[b][0] += p[k]; somma[b][1] += p[k + 1]; somma[b][2] += p[k + 2]; somma[b][3]++;
      }
    const profilo = []; let ultimo = null;
    for (let b = BIN - 1; b >= 0; b--)
      profilo[b] = somma[b][3] ? (ultimo = somma[b].slice(0, 3).map((v) => v / somma[b][3])) : null;
    for (let b = 0; b < BIN; b++) if (!profilo[b]) profilo[b] = ultimo;

    for (let i = 0; i < p.length; i += 4) {
      const n = i / 4, px = n % c.width, py = (n / c.width) | 0;
      const b = Math.min(BIN - 1, Math.floor(Math.hypot(px - cx, py - cy) / rMax * BIN));
      const f = profilo[b];
      for (let k = 0; k < 3; k++) {
        const v = p[i + k] - f[k] + o.nostro[k];
        p[i + k] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    x.putImageData(dati, 0, 0);

    /* Ritaglio e sfumatura: la maschera è un'ellisse morbida, disegnata
       con `destination-in` così mangia l'alpha invece di dipingerci
       sopra. */
    const [rx0, ry0, rw, rh] = o.ritaglio;
    const t = document.createElement("canvas");
    t.width = Math.round(rw * o.altezza / rh); t.height = o.altezza;
    const tx = t.getContext("2d");
    tx.imageSmoothingQuality = "high";
    tx.drawImage(c, rx0, ry0, rw, rh, 0, 0, t.width, t.height);

    /* Per il pallone: una maschera tonda, che lascia la sfera e taglia
       via le punte della corona che entrano negli angoli del ritaglio. */
    if (o.tondo) {
      tx.globalCompositeOperation = "destination-in";
      const g = tx.createRadialGradient(t.width / 2, t.height / 2, 0,
                                        t.width / 2, t.height / 2, t.height / 2);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(o.tondo, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      tx.fillStyle = g;
      tx.fillRect(0, 0, t.width, t.height);
      tx.globalCompositeOperation = "source-over";
    }

    if (o.sfuma) {
      tx.globalCompositeOperation = "destination-in";
      const g = tx.createRadialGradient(t.width / 2, t.height / 2, 0,
                                        t.width / 2, t.height / 2, t.height / 2);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(o.dentro, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      tx.fillStyle = g;
      tx.setTransform(t.width / t.height, 0, 0, 1, (t.height - t.width) / 2 * (t.width / t.height) * 0 + (t.width - t.height * (t.width / t.height)) / 2, 0);
      tx.setTransform(1, 0, 0, 1, 0, 0);
      tx.save();
      tx.translate(t.width / 2, t.height / 2);
      tx.scale(t.width / t.height, 1);
      tx.translate(-t.width / 2, -t.height / 2);
      tx.fillRect(-t.width, -t.height, t.width * 3, t.height * 3);
      tx.restore();
      tx.globalCompositeOperation = "source-over";
    }

    const prove = {};
    for (const q of [0.7, 0.78, 0.86]) prove[q] = t.toDataURL("image/webp", q).length;
    return { misura: [t.width, t.height], prove,
             webp: t.toDataURL("image/webp", o.qualita), png: t.toDataURL("image/png") };
  }, opzioni);
}

// Il marchio intero. Il ritaglio è misurato sull'originale, con abbastanza
// aria intorno perché la sfumatura non morda il bagliore.
/* 420 pixel di altezza: nell'applicazione il marchio non supera mai i
   150, e il doppio basta per gli schermi fitti. Più grande è peso che
   nessuno vede — e qui ogni kilobyte finisce dentro il file dell'app. */
const intero = await lavora({ nostro: NOSTRO, ritaglio: [120, 210, 784, 1080],
                              altezza: 420, sfuma: true, dentro: 0.72, qualita: 0.8 });
console.log("marchio", intero.misura, intero.prove);
writeFileSync(D + "marchio-app.webp", Buffer.from(intero.webp.split(",")[1], "base64"));
writeFileSync(D + "marchio-app.png", Buffer.from(intero.png.split(",")[1], "base64"));

// Il solo pallone, per la testata e per l'icona della scheda.
/* Il pallone finisce nella testata e nell'icona, che sono più scure del
   resto: il suo fondo va portato su quel nero, non sul verde delle
   pagine, o attorno al tondo resta un disco più chiaro. E la maschera si
   stringe sulla sfera, così di fondo ne resta pochissimo. */
const palla = await lavora({ nostro: [16, 20, 15], ritaglio: [348, 400, 320, 320],
                             altezza: 132, sfuma: false, tondo: 0.62, qualita: 0.9 });
console.log("pallone", palla.misura, palla.prove);
writeFileSync(D + "palla-app.webp", Buffer.from(palla.webp.split(",")[1], "base64"));
writeFileSync(D + "palla-app.png", Buffer.from(palla.png.split(",")[1], "base64"));

await browser.close();
