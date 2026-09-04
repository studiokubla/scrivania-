/**
 * La connessione al database per le verifiche end-to-end.
 *
 * Le verifiche leggono il database direttamente — con `psql`, non attraverso
 * l'applicazione — perché controllare l'esito di un'operazione guardando la
 * pagina che l'ha appena eseguita non prova niente: proverebbe che la pagina è
 * coerente con sé stessa, non che il dato è stato scritto.
 *
 * Fin qui ogni script si portava dietro la stessa riga con utente, password e
 * nome del database di una macchina precisa. Fuori da quella macchina la suite
 * non partiva, e l'errore arrivava a metà — dopo aver avviato il browser, con
 * un `Connection refused` in mezzo a un dump di byte. Qui la connessione si
 * ricava invece da `DATABASE_URL`, cioè dalla stessa variabile che usa
 * l'applicazione: se le verifiche parlano con un database, è per definizione
 * quello contro cui gira il server che stanno verificando.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Legge `DATABASE_URL` dal file `.env`.
 *
 * Gli script girano con `node`, che il `.env` non lo guarda: senza questa
 * lettura la variabile ci sarebbe per l'applicazione — Next e Prisma il file
 * lo caricano — e non per le verifiche, che è esattamente il modo di dividersi
 * su due database senza accorgersene.
 */
function daFileEnv() {
  const file = join(RADICE, ".env");
  if (!existsSync(file)) return null;
  for (const riga of readFileSync(file, "utf8").split("\n")) {
    const trovato = riga.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*)$/);
    if (!trovato) continue;
    return trovato[1].trim().replace(/^["']|["']$/g, "") || null;
  }
  return null;
}

const URL_DATABASE = process.env.DATABASE_URL || daFileEnv();

if (!URL_DATABASE) {
  console.error(
    "Manca DATABASE_URL: mettila nell'ambiente o in dynasty/web/.env.\n" +
      "È lo stesso valore con cui gira il server che stai verificando.",
  );
  process.exit(1);
}

/**
 * Parametri che sono di Prisma e non di `psql`: messi nella stringa di
 * connessione così com'è, `psql` non li ignora — si rifiuta di partire con
 * *invalid URI query parameter*. Vanno tolti.
 */
const SOLO_DI_PRISMA = new Set([
  "schema",
  "connection_limit",
  "pool_timeout",
  "pgbouncer",
  "socket_timeout",
  "statement_cache_size",
  "sslidentity",
  "sslpassword",
  "sslaccept",
]);

/**
 * Traduce la stringa di Prisma in una che `psql` accetta.
 *
 * `schema` non si butta e basta: dice in quale schema Prisma ha creato le
 * tabelle, e se non è `public` una query che non lo nomina non le troverebbe —
 * fallendo con *relation does not exist* su un database in cui invece c'è
 * tutto. Diventa quindi un `search_path`, che è come si dice la stessa cosa a
 * `psql`.
 */
function perPsql(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    // Non è una URL (le connessioni per socket non lo sono): passala com'è.
    return url;
  }
  const schema = u.searchParams.get("schema");
  for (const chiave of [...u.searchParams.keys()]) {
    if (SOLO_DI_PRISMA.has(chiave)) u.searchParams.delete(chiave);
  }
  if (schema && schema !== "public") {
    u.searchParams.set("options", `-c search_path=${schema}`);
  }
  return u.toString();
}

/**
 * `psql` accetta la stringa di connessione intera, quindi non c'è niente da
 * smontare in host, porta e utente — e niente da rimontare sbagliando. Le
 * opzioni: `-t` toglie l'intestazione, `-A` gli allineamenti, `-v ON_ERROR_STOP=1`
 * fa fallire il comando su un errore SQL invece di stamparlo e uscire con zero,
 * che è come una verifica passa senza aver verificato niente.
 */
const COMANDO = `psql "${perPsql(URL_DATABASE)}" -t -A -v ON_ERROR_STOP=1`;

/** Esegue una query e restituisce l'uscita grezza, ripulita dagli spazi. */
export function sql(query) {
  return execSync(`${COMANDO} -c "${query.replace(/"/g, '\\"')}"`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** La stringa di connessione, per gli script che compongono il comando da sé. */
export const databaseUrl = URL_DATABASE;

/** Il comando `psql` già pronto, per chi ci concatena altre opzioni. */
export const psql = COMANDO;
