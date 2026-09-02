/**
 * Verifica l'ambiente pubblicato interrogandolo via HTTP.
 *
 * In questo ambiente il browser non riesce a uscire in rete, quindi il login
 * viene fatto per la stessa strada che userebbe un browser senza JavaScript:
 * il modulo di accesso porta già nel suo HTML i campi nascosti che
 * identificano la Server Action, e basta rispedirli insieme alle credenziali.
 */
const BASE = process.env.BASE?.replace(/\/$/, "");
if (!BASE) throw new Error("Serve BASE=https://indirizzo-pubblicato");
// Le credenziali non stanno qui dentro: sono l'unica cosa che questo
// repository non deve contenere. Si passano dall'ambiente.
//   BASE=https://... COMMISSIONER=indirizzo:password MANAGER=indirizzo:password \
//     node scripts/verifica-online.mjs
const coppia = (valore, nome) => {
  const i = valore?.indexOf(":") ?? -1;
  if (i < 1) throw new Error(`Serve ${nome}="indirizzo:password".`);
  return { email: valore.slice(0, i), password: valore.slice(i + 1) };
};
const commissioner = coppia(process.env.COMMISSIONER, "COMMISSIONER");
const manager = coppia(process.env.MANAGER, "MANAGER");

let ko = 0;
const check = (etichetta, ok, dettaglio = "") => {
  console.log(`${ok ? "OK  " : "FAIL"}  ${etichetta}${dettaglio ? ` — ${dettaglio}` : ""}`);
  if (!ok) ko += 1;
};

const sdoppia = (s) =>
  s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'");

const risposta = await fetch(`${BASE}/login`);
const htmlLogin = await risposta.text();
check("la pagina di accesso risponde", risposta.status === 200, `HTTP ${risposta.status}`);
check("porta il marchio Dynasty League", htmlLogin.includes("Dynasty League"));

const nascosti = [...htmlLogin.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\s*\/>/g)];
check("il modulo porta i campi della Server Action", nascosti.some(([, n]) => n.startsWith("$ACTION")), `${nascosti.length} campi`);

async function accedi(cred) {
  const corpo = new FormData();
  for (const [, nome, valore] of nascosti) corpo.append(nome, sdoppia(valore ?? ""));
  corpo.append("email", cred.email);
  corpo.append("password", cred.password);

  const r = await fetch(`${BASE}/login`, { method: "POST", body: corpo, redirect: "manual" });
  const biscotti = r.headers.getSetCookie?.() ?? [];
  const sessione = biscotti.map((c) => c.split(";")[0]).find((c) => !/=;?$/.test(c) && !c.endsWith("="));
  return { stato: r.status, cookie: sessione, corpo: await r.text() };
}

const boss = await accedi(commissioner);
check("il commissioner accede con la password generata", Boolean(boss.cookie), `HTTP ${boss.stato}`);

const sbagliata = await accedi({ email: commissioner.email, password: "sbagliata" });
check("una password sbagliata non apre nessuna sessione", !sbagliata.cookie);
check("e il messaggio non rivela se l'indirizzo esiste", /non corretti/.test(sbagliata.corpo) && !/inesistente|non trovato/i.test(sbagliata.corpo));

const gestore = await accedi(manager);
check("un manager accede con la sua password", Boolean(gestore.cookie));

async function pagina(percorso, cookie) {
  const r = await fetch(`${BASE}${percorso}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { stato: r.status, dove: r.headers.get("location"), testo: r.status === 200 ? await r.text() : "" };
}

for (const [percorso, atteso] of [
  ["/lega", "Stagione"],
  ["/mercato", "Mercato"],
  ["/asta", "asta"],
  ["/registro", "Registro"],
  ["/admin", "Amministrazione"],
]) {
  const p = await pagina(percorso, boss.cookie);
  check(`${percorso} si apre per il commissioner`, p.stato === 200 && p.testo.toLowerCase().includes(atteso.toLowerCase()), `HTTP ${p.stato}`);
}

const admin = await pagina("/admin", gestore.cookie);
check("un manager non entra in amministrazione", admin.stato !== 200, `HTTP ${admin.stato} ${admin.dove ?? ""}`);

const senza = await pagina("/lega", null);
check("senza sessione si finisce al login", (senza.dove ?? "").includes("/login"), `HTTP ${senza.stato} ${senza.dove ?? ""}`);

const lega = await pagina("/lega", boss.cookie);
const squadre = [...new Set([...lega.testo.matchAll(/\/squadra\/([a-z0-9-]+)/gi)].map((m) => m[1]))];
check("la pagina lega elenca dieci squadre", squadre.length === 10, `${squadre.length}`);

const rosa = await pagina(`/squadra/${squadre[0]}`, boss.cookie);
check("la scrivania squadra si apre", rosa.stato === 200, `HTTP ${rosa.stato}`);
check("la rosa contiene giocatori veri del listone", /Sommer|Maignan|Lautaro|Vlahovi|Dimarco|Calhanoglu|Leao|Bastoni|Thuram|Di Gregorio|Retegui/i.test(rosa.testo));
check("la scrivania mostra il tetto salariale", /tetto salariale|Monte ingaggi|Cap/i.test(rosa.testo));

const mercato = await pagina("/mercato", boss.cookie);
check("la sala mercato elenca svincolati", /svincolat|Free agency|Offerta/i.test(mercato.testo));

const setup = await fetch(`${BASE}/api/setup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ reset: true }),
});
check("l'inizializzazione è chiusa a lega esistente", setup.status === 403, `HTTP ${setup.status}`);

const salute = await (await fetch(`${BASE}/api/salute`)).json();
check(
  "lo stato dichiara la lega pronta",
  salute.inizializzata === true && salute.giocatori === 531 && salute.squadre === 10 && salute.utenti === 11,
  JSON.stringify(salute),
);

console.log(`\n${ko === 0 ? "Tutte le verifiche passate sull'ambiente pubblicato." : `${ko} verifiche fallite.`}`);
process.exitCode = ko === 0 ? 0 : 1;
