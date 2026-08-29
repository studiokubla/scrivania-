/* ============================================================
   GdRadar — bundle in singolo file
   Legge index.html, incorpora CSS e JS e produce:
     dist/gdradar.html          documento completo, apribile con doppio clic
     dist/gdradar-artifact.html solo il contenuto (per host che forniscono
                                già doctype, head e body)
     ../docs/index.html         la stessa pagina dove GitHub Pages la cerca
   Uso: node build.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FONTS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Prata&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&display=swap';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('index.html');
const grab = (re) => Array.from(html.matchAll(re)).map((m) => m[1]);

const cssFiles = grab(/<link rel="stylesheet" href="(assets\/[^"]+)">/g);
const jsFiles = grab(/<script src="(assets\/[^"]+)"><\/script>/g);
if (!cssFiles.length || !jsFiles.length) throw new Error('Nessun asset trovato in index.html');

const css = cssFiles.map((f) => '/* ---- ' + f + ' ---- */\n' + read(f)).join('\n\n');
const js = jsFiles.map((f) => '/* ---- ' + f + ' ---- */\n' + read(f)).join('\n\n');

/* il body di index.html, senza i tag <script> che abbiamo appena incorporato */
const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/\s*<script src="assets\/[^"]+"><\/script>/g, '')
  /* il file singolo non ha file accanto: via la registrazione del service worker */
  .replace(/\s*<script>[\s\S]*?serviceWorker[\s\S]*?<\/script>/g, '')
  .trim();

const inner = `<title>GdRadar</title>
<style>
@import url('${FONTS}');

${css}
</style>

${body}

<script>
${js}
</script>`;

const standalone = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="GdRadar: trova giocatori, Master, Party e Campagne di gioco di ruolo vicini o compatibili. Prototipo funzionante della V1.">
<meta name="theme-color" content="#F6F5F2">
${html.match(/<link rel="icon"[^>]+>/)[0]}
${inner.replace('<title>GdRadar</title>', '<title>GdRadar — trova con chi giocare</title>')}
</head>
<body>
</body>
</html>`;

/* nel documento completo testa e corpo vanno separati come si deve */
const headEnd = standalone.indexOf('\n\n' + body);
const doc = standalone.slice(0, headEnd) + '\n</head>\n<body>\n' + standalone.slice(headEnd + 2).replace('</head>\n<body>\n</body>\n</html>', '</body>\n</html>');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/gdradar.html'), doc);
fs.writeFileSync(path.join(ROOT, 'dist/gdradar-artifact.html'), inner);

/* GitHub Pages pubblica la cartella /docs del repository.
   Qui NON va il file singolo ma l'app come cartella: il service worker e
   il manifest hanno bisogno di file veri per rendere l'app installabile
   sul telefono. Il file singolo resta in dist/ per chi lo vuole spedire. */
const DOCS = path.join(ROOT, '..', 'docs');
fs.rmSync(DOCS, { recursive: true, force: true });
fs.mkdirSync(path.join(DOCS, 'gdradar'), { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(DOCS, 'gdradar', f));
}
fs.cpSync(path.join(ROOT, 'assets'), path.join(DOCS, 'gdradar/assets'), { recursive: true });
fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');
/* la radice del sito rimanda alla cartella con il nome del prodotto */
/* Capacitor impacchetta questa cartella dentro l'app iOS */
const WWW = path.join(ROOT, 'www');
fs.rmSync(WWW, { recursive: true, force: true });
fs.cpSync(path.join(DOCS, 'gdradar'), WWW, { recursive: true });

fs.writeFileSync(path.join(DOCS, 'index.html'),
  '<!doctype html><meta charset="utf-8"><title>GdRadar</title>' +
  '<meta http-equiv="refresh" content="0; url=./gdradar/">' +
  '<link rel="canonical" href="./gdradar/"><a href="./gdradar/">GdRadar</a>');

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
console.log('dist/gdradar.html          ' + kb(doc));
console.log('dist/gdradar-artifact.html ' + kb(inner));
console.log('docs/gdradar/              app installabile (GitHub Pages)');
console.log('www/                       cartella per il guscio iOS (Capacitor)');
