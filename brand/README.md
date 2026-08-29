# DEZ 11 — identità

Marchio, tipografia e sistema colore per l'app di fantacalcio **DEZ 11**.

Il marchio è il **retro di una maglia**: il nome sopra, il numero sotto. Le lettere e
il numero sono disegnati come tracciati monolineari con terminali circolari; il numero
porta quattro anelli concentrici, che sono anche il punto in cui entra il colore.

## Il modulo

Tutto nasce da `1u = 30` unità, un quarto dell'asta del numero.

| | |
| --- | --- |
| Asta del nome | 2u |
| Altezza del nome | 6u |
| Asta del numero | 4u |
| Altezza del numero | 14u |
| Distanza nome / numero | 2u |
| Area di rispetto | 2u |
| Anelli del numero | 120 / 96 / 72 / 48, anima 24 |

Gli anelli chiari sono **bianco pieno**, non trasparenti: il marchio regge su qualsiasi fondo.

## Asset

I file in `assets/` sono generati da `_gen-assets.mjs` — si modifica quello, non gli SVG.

    node _gen-assets.mjs

| File | Uso |
| --- | --- |
| `dez11-marchio-positivo.svg` | versione predefinita, su fondi chiari |
| `dez11-marchio-negativo.svg` | su Nero Campo e fondi scuri pieni |
| `dez11-marchio-spettro.svg` | solo per la lega: copertine, avvio, chiusure |
| `dez11-marchio-orizzontale.svg` | testate, barre superiori, spazi bassi e larghi |
| `dez11-icona.svg` | icona app, avatar, favicon |

Dimensioni minime: 96 px il marchio verticale, 160 px il lockup orizzontale, 32 px il simbolo.

## Colore

Nucleo neutro — `#0B0C10` Nero Campo, `#FFFFFF` Smalto, `#C6FF3D` Lampo (una sola
azione per schermata, mai testo). Lo spettro sono 12 famiglie × 4 gradi: 48 tinte da
cui ogni squadra riceve una coppia. Primario fra i gradi 02 e 03, secondario da una
famiglia distante almeno tre posizioni — o il Nero Campo.

## Tipografia

Il lettering del marchio è disegnato e resta un file vettoriale. Nell'app:
**M PLUS Rounded 1c** ExtraBold per i titoli, **Archivo** per tutto il resto
(cifre tabellari per classifiche e punteggi).

## La board

Gli artboard `.dc.html` e `canvas.json` compongono la tavola dell'identità;
si rigenerano con:

    python3 -c "exec(open('_build.py').read()); build_main(); build_costruzione(); build_varianti(); build_tipografia(); build_colore(); build_squadre(); build_applicazioni()"
