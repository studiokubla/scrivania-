/**
 * Applica le età del listone alla lega pubblicata.
 *
 * Si entra come commissioner per la strada senza JavaScript — il modulo di
 * accesso porta già i campi della Server Action — e poi si invoca l'azione
 * del pannello come farebbe il browser, per identificativo.
 */
const BASE = process.env.BASE;
const [EMAIL, PASSWORD] = (process.env.COMMISSIONER ?? "").split(":");

const sdoppia = (s) =>
  s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'");

const htmlLogin = await (await fetch(`${BASE}/login`)).text();
const nascosti = [...htmlLogin.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\s*\/>/g)];

const corpo = new FormData();
for (const [, nome, valore] of nascosti) corpo.append(nome, sdoppia(valore ?? ""));
corpo.append("email", EMAIL);
corpo.append("password", PASSWORD);

const login = await fetch(`${BASE}/login`, { method: "POST", body: corpo, redirect: "manual" });
const cookie = (login.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(";")[0])
  .filter((c) => !c.endsWith("="))
  .join("; ");
console.log("accesso:", login.status, cookie ? "cookie ottenuto" : "NESSUN COOKIE");
if (!cookie) process.exit(1);

const html = await (await fetch(`${BASE}/admin`, { headers: { cookie } })).text();
const senzaEtà = html.match(/(\d+)\s*(?:giocatori\s*)?senza (?:età|data di nascita)/i)?.[0];
console.log("pannello:", senzaEtà ?? "nessuna segnalazione di età mancanti");

const ids = [...new Set([...html.matchAll(/\$ACTION_ID_([0-9a-f]{40,})/g)].map((m) => m[1]))];
console.log("azioni referenziate:", ids.length);

for (const id of ids) {
  const r = await fetch(`${BASE}/admin`, {
    method: "POST",
    headers: { cookie, "Next-Action": id, "content-type": "text/plain;charset=UTF-8" },
    body: "[]",
  });
  const testo = await r.text();
  const messaggio = testo.match(/"message":"([^"]*)"/)?.[1];
  console.log(`  ${id.slice(0, 10)} → ${r.status} ${messaggio ?? testo.slice(0, 80).replace(/\n/g, " ")}`);
  if (messaggio && /età/i.test(messaggio)) break;
}
