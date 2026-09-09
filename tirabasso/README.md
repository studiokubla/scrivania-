# Tirabasso — demo maison

Demo funzionale del nuovo sito **Tirabasso Serafino**, ripensato come maison
internazionale del cappello: racconto di marca in vetrina, e-commerce B2C
navigabile e area B2B **Jackson** come ponte verso il futuro portale dedicato.

Tutto sta in **un solo file HTML** (`dist/index.html`, ~3,9 MB): immagini
incorporate, nessuna dipendenza, nessun server. Si apre con un doppio clic,
si carica su qualsiasi hosting statico, si manda al cliente per email.

## Cosa si può fare davvero

| Area | Funziona |
| --- | --- |
| Home | Hero editoriale con quattro scatti in dissolvenza, i cinque mondi, savoir-faire, marchi in licenza |
| Collezioni | 62 pezzi reali, filtri per materia (feltro, paglia, tessuto, maglieria, borse, viaggio) e per mondo, ordinamento per prezzo |
| Scheda prodotto | Taglie, quantità, preferiti, schede informative, correlati per linea |
| Borsa | Drawer laterale, quantità, rimozione, totale — persistente (`localStorage`) |
| Checkout | Form con validazione, spese di spedizione (gratis da 120 €), conferma d'ordine |
| Jackson B2B | Landing dedicata, link al portale, form di accreditamento rivenditori con validazione |
| Maison / Savoir-faire | Storia, territorio, le quattro fasi della lavorazione |
| Ricerca | Su nome, materiale, linea e referenza di catalogo |

Contenuti e prezzi vengono dal sito reale del cliente; le foto sono le sue
(campagna e reportage d'atelier). I form non inviano nulla: mostrano lo stato
di conferma, come si conviene a una demo.

## Struttura

```
src/shell.html     markup, header, footer, drawer
src/style.css      design system (palette, tipografia, componenti)
src/app.js         SPA: router hash, catalogo, borsa, checkout, form
src/products.json  catalogo arricchito (nome maison, linea, materiale, taglie)
assets/            immagini ottimizzate in WebP (editoriali, atelier, 62 packshot)
build.py           assembla tutto in dist/ incorporando le immagini
build-data.py      rigenera src/products.json da catalog.json
test.py            prova il sito in Chromium (Playwright)
```

## Rigenerare

```bash
python3 build.py            # -> dist/index.html + dist/artifact.html
python3 test.py             # prova percorsi, carrello, checkout, form
```

`build-data.py` serve solo se cambia `catalog.json` (il catalogo grezzo).

## Direzione di design

- **Palette** — avorio `#F4F1EC`, inchiostro `#171B21` (il navy dello stemma),
  bianco per i packshot. Nessun colore d'accento: il colore lo portano le foto.
- **Tipografia** — Cormorant Garamond per i titoli, Jost per navigazione e
  interfaccia, maiuscoletto spaziato per le etichette.
- **Riferimenti** — Maison Margiela e Michel Paris, come indicato dal cliente.

Il payoff e la data vengono dal marchio reale: *performing hat*, dal 1967.

## Da decidere con il cliente

- Dominio e identità di **Jackson** (oggi il link punta a `b2b.tirabasso.com`).
- Nomi delle linee: qui sono una proposta editoriale, il riferimento di catalogo
  resta visibile in ogni scheda.
- Lingue: la demo è in italiano; il sito reale ha anche inglese e tedesco.
