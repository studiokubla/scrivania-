/**
 * Ponte di pubblicazione.
 *
 * Il codice dell'applicazione sta in `dynasty/web` dentro un repository
 * pubblico. Questo pacchetto contiene solo le istruzioni per andarlo a
 * prendere: scarica l'archivio del commit indicato, sposta l'applicazione
 * nella cartella di lavoro e la compila come se fosse sempre stata lì.
 *
 * Se qualcosa va storto **non fallisce**: al posto dell'applicazione pubblica
 * una pagina che riporta il diario della build. Una build fallita su Vercel
 * lascia l'indirizzo di produzione senza niente da servire, e il log si può
 * leggere solo entrando nel pannello; una build che riesce, invece, si può
 * interrogare da fuori. È l'unico modo di capire cosa si è rotto senza avere
 * accesso in lettura al progetto.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const COMMIT = "af4e612108eb4035eaf2e66e66b230f400489c44";
const ARCHIVIO = `https://codeload.github.com/studiokubla/scrivania-/tar.gz/${COMMIT}`;

/**
 * Strumenti che servono solo a chi sviluppa: prove automatiche, verifiche,
 * generazione della presentazione. In produzione non servono, e `playwright`
 * in particolare si porterebbe dietro il download di tre browser.
 */
const SOLO_PER_SVILUPPO = ["playwright", "vitest", "eslint", "eslint-config-next", "tsx", "dotenv"];

/** I file che, tolti quegli strumenti, non passerebbero il controllo dei tipi. */
const DA_TOGLIERE = ["vitest.config.mts", "src/lib/rules/rules.test.ts"];

const diario = [];

function annota(riga) {
  console.log(riga);
  diario.push(riga);
}

function esegui(comando, ambiente = {}) {
  annota(`\n$ ${comando}`);
  try {
    const uscita = execSync(comando, {
      env: { ...process.env, ...ambiente },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      // Un comando che si pianta — una connessione al database che non
      // risponde — mangerebbe l'intera finestra di build e la farebbe morire
      // senza diario. Meglio ucciderlo e raccontarlo.
      timeout: 15 * 60 * 1000,
    });
    annota(uscita.trimEnd());
    return uscita;
  } catch (errore) {
    annota(`${errore.stdout ?? ""}${errore.stderr ?? ""}`.trimEnd());
    annota(`\n✗ uscita con codice ${errore.status} ${errore.signal ?? ""}`);
    throw errore;
  }
}

function costruisci() {
  esegui(`curl -fsSL "${ARCHIVIO}" -o sorgente.tar.gz`);
  esegui("tar -xzf sorgente.tar.gz");

  const radice = `scrivania--${COMMIT}`;
  if (!existsSync(`${radice}/dynasty/web/package.json`)) {
    throw new Error(`L'archivio non contiene ${radice}/dynasty/web.`);
  }

  esegui(`cp -a ${radice}/dynasty/web/. .`);
  rmSync(radice, { recursive: true, force: true });
  rmSync("sorgente.tar.gz", { force: true });

  const manifesto = JSON.parse(readFileSync("package.json", "utf8"));
  for (const pacchetto of SOLO_PER_SVILUPPO) delete manifesto.devDependencies?.[pacchetto];
  delete manifesto.prisma;
  writeFileSync("package.json", `${JSON.stringify(manifesto, null, 2)}\n`);

  // Il file di blocco descrive l'albero completo: dopo lo sfoltimento non
  // corrisponde più, e tenerlo rimetterebbe dentro quello che si è tolto.
  rmSync("package-lock.json", { force: true });
  for (const file of DA_TOGLIERE) rmSync(file, { force: true });

  // `NODE_ENV=production` durante la build farebbe saltare a npm tutte le
  // dipendenze di sviluppo — fra cui TypeScript, Tailwind e la riga di
  // comando di Prisma, senza le quali non si compila niente.
  esegui("npm install --include=dev --no-audit --no-fund", {
    NODE_ENV: "development",
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
  });

  for (const atteso of ["typescript", "prisma", "tailwindcss"]) {
    if (!existsSync(`node_modules/${atteso}`)) throw new Error(`Manca ${atteso} dopo l'installazione.`);
  }

  // I tre passi della build, uno alla volta invece che dentro `npm run build`:
  // se a rompersi è l'allineamento dello schema, il diario lo dice, invece di
  // riportare un fallimento generico dell'intera compilazione.
  esegui("npx prisma generate");
  if (process.env.DATABASE_URL) {
    esegui("npx prisma db push");
  } else {
    annota("\n⚠  DATABASE_URL non configurata: salto l'allineamento dello schema.");
  }
  esegui("npx next build", { NODE_ENV: "production" });
}

/**
 * Pubblica al posto dell'applicazione una pagina sola con il diario dentro.
 * Deve compilare in qualunque condizione, quindi niente TypeScript, niente
 * configurazioni, nessuna dipendenza oltre alle tre indispensabili.
 */
function pubblicaIlDiario(errore) {
  const testo = [...diario, "", `✗ ${errore.message}`].join("\n");

  for (const voce of readdirSync(".")) {
    if (voce !== "node_modules") rmSync(voce, { recursive: true, force: true });
  }

  mkdirSync("app", { recursive: true });
  writeFileSync(
    "package.json",
    `${JSON.stringify(
      {
        name: "diario-di-build",
        private: true,
        scripts: { build: "next build" },
        dependencies: { next: "16.3.4", react: "19.2.8", "react-dom": "19.2.8" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync("app/layout.js", "export default function L({children}){return <html><body>{children}</body></html>}\n");
  writeFileSync(
    "app/page.js",
    `const diario = ${JSON.stringify(testo)};\n` +
      "export const dynamic = 'force-static';\n" +
      "export default function P(){return <pre style={{whiteSpace:'pre-wrap',fontFamily:'monospace',fontSize:12,padding:16}}>{diario}</pre>}\n",
  );

  execSync("npm install --include=dev --no-audit --no-fund", {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });
  execSync("npx next build", { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
}

try {
  costruisci();
} catch (errore) {
  console.error("\n\nLa build dell'applicazione è fallita. Pubblico il diario al suo posto.\n");
  pubblicaIlDiario(errore);
}
