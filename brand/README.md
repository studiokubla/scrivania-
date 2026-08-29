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
| `dez11-marchio-squadra.svg` | anelli nelle due tinte di una squadra |
| `dez11-marchio-orizzontale.svg` | testate, barre superiori, spazi bassi e larghi |
| `dez11-icona.svg` | icona app, avatar, favicon |

Dimensioni minime: 96 px il marchio verticale, 160 px il lockup orizzontale, 32 px il simbolo.

## Colore

Il sistema è in bianco e nero. Neutri: `#0B0C10` Campo, `#14161C` Notte, `#23262E` Fango,
`#3A3E48` Grafite, `#5C616B` Cemento, `#8A9099` Ardesia, `#C9CCD3` Nebbia, `#F1F2F4` Calce,
`#FFFFFF` Smalto. **Nessun colore d'accento di sistema**: anche il bottone principale prende
la tinta viva della squadra di chi guarda.

L'unico colore è quello di una squadra, e una squadra è **due tinte** — una profonda e una
viva, della stessa famiglia. Mai una terza, mai due coppie nello stesso elemento.
Dieci coppie, una lega piena:

| | scuro | chiaro | | scuro | chiaro |
| --- | --- | --- | --- | --- | --- |
| Rosso | `#C81E12` | `#FF6B3D` | Ciano | `#00719F` | `#2BB8E8` |
| Ambra | `#C97400` | `#FFB627` | Azzurro | `#0B52B8` | `#3E93F5` |
| Lime | `#4F9400` | `#ADE035` | Blu | `#2B22C4` | `#6E63FF` |
| Verde | `#00874F` | `#2FD183` | Viola | `#5F1EBE` | `#A45CFF` |
| Menta | `#00857E` | `#23D2BE` | Rosa | `#B31358` | `#FF4F92` |

## Gradiente

Le due tinte non si accostano: si mischiano, e la mescolanza viene tagliata in **undici
colonne**. È l'unica geometria del sistema — la riga della maglia e il numero dei titolari
sono la stessa cosa. Tre modi, sempre con la grana:

| Modo | Dove |
| --- | --- |
| Pieno | sfondi ampi, copertine, schede lunghe |
| A colonne | undici righe scanalate: maglie, intestazioni, barre |
| A canne | undici colonne di altezza diversa: grafici, avvio, animazioni |

## Pittogramma

Ancora da scegliere: sei opzioni in `assets/pittogrammi/`, tutte sulla coppia Rosso e tutte
a due tinte — **A** Anelli, **B** Righe, **C** Canne, **D** Formazione, **E** Scudo,
**F** Maglia. Le tavole *Pittogramma* ne riportano motivazione, controindicazione e prova
a 84 / 42 / 26 / 18 px.

## Tipografia

Il lettering del marchio è disegnato e resta un file vettoriale. Nell'app:
**M PLUS Rounded 1c** ExtraBold per i titoli, **Archivo** per liste e testi,
**IBM Plex Mono** per tutto ciò che è misura — punteggi, quote, orari, etichette.

## La board

Gli artboard `.dc.html` e `canvas.json` compongono la tavola dell'identità;
si rigenerano con:

    python3 -c "exec(open('_build.py').read()); [f() for f in (build_main, build_costruzione, build_varianti, build_tipografia, build_colore, build_squadre, build_applicazioni, build_gradiente, build_pittogrammi, build_pittogrammi_prova)]"
