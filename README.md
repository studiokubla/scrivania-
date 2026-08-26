# Pan & Gea — Spazzoliamo!

Piccolo platform arcade (stile Super Mario) per **Studio Pangea**, pensato per il telefono
e per bambini. Si sceglie uno dei due personaggi Pangea — **Pan** (giallo) o **Gea** (lilla) —
e si attraversa la Valle dei Denti schiacciando **carie** e **Animalicoli**.

Tutto il gioco sta in un unico file: `index.html`. Nessuna dipendenza, nessun build.

## Come si apre

- **In locale**: doppio clic su `index.html` (o `npx http-server .` se il browser blocca i file locali).
- **Online**: basta caricare `index.html` su un qualsiasi hosting statico
  (GitHub Pages, Netlify, la cartella del sito Pangea). È un solo file.
- **Sul telefono**: aperto da Safari/Chrome si può aggiungere alla schermata Home e si comporta come un'app.

## Come si gioca

| Comando | Cosa fa |
| --- | --- |
| ◀ ▶ | Cammina |
| SALTA (tenuto premuto) | Salta più in alto |
| Salto sopra un nemico | Pulisce carie e Animalicoli — 50 punti |
| Bolla di dentifricio | 10 punti |
| Spazzolino | 8 secondi di super pulizia: i nemici si puliscono al tocco |
| Spazzolino gigante | Fine della bocca: 100 punti + 50 per ogni dente rimasto |

Da tastiera (per provarlo al computer): frecce o `A`/`D` per muoversi, `spazio` per saltare, `Esc` per la pausa.

Tre vite (tre denti) per ogni bocca, che si ricaricano a ogni livello nuovo.
Se si cade in un buco si riparte dall'ultimo punto sicuro, non da capo.
Il record resta salvato sul telefono di chi gioca (`localStorage`).

## I contenuti

Personaggi, colori e lessico arrivano dai materiali Pangea nel Drive (`Lavori/Pangea`):

- `pangeapersonaggi.ai` — foglio personaggi: silhouette, occhio singolo, guanti bianchi.
- Palette: giallo `#F4D35F` / `#B4850E`, lilla `#CCB2D7` / `#877792`, menta `#A8CBB5`, smalto `#FFFFFF`.
- `Le favole di Pangea/Animalicoli` — da qui i nomi **Pan**, **Gea** e **Animalicoli**, e l'idea
  della bocca come valle di colline bianche.

I personaggi non sono immagini importate: sono disegnati a vettore dentro il canvas,
così restano nitidi su qualsiasi schermo e il file resta leggero.

## Modificare i livelli

I tre livelli sono in fondo alla costante `LIVELLI`, in coordinate di casella (una casella = 32 px,
la mappa è alta 11 righe, la riga 9 è il terreno e la 10 la gengiva):

```js
{
  nome:'La Valle dei Denti',
  larghezza:132,                       // caselle
  ground:[[0,28],[30,58]],             // fasce di terreno [dalla casella, alla casella)
  plat:[[10,6,4]],                     // piattaforma: colonna, riga, lunghezza
  bolle:[[11,5]], spazz:[[46,3]],      // raccoglibili: colonna, riga
  carie:[[14,8]], animal:[[24,8]],     // nemici: colonna, riga
  start:[2,8], goal:[128,8]
}
```

Due regole per restare giocabili: i buchi nel terreno non più larghi di **due caselle**,
e le piattaforme non più di **due righe** sopra quella da cui si salta.

## Note tecniche

- Canvas 2D, ciclo a passo variabile, collisioni AABB sulla griglia.
- Salto con *coyote time* e buffer di input: perdona i tempi imprecisi dei bambini.
- Comandi a schermo con Pointer Events; funziona anche con tastiera.
- Suoni generati con WebAudio (nessun file audio), disattivabili dal tasto ♪.
- Font: Fredoka + Nunito da Google Fonts, con fallback di sistema se non c'è rete.
- Layout verticale e orizzontale: in verticale il gioco sta in una cornice con i comandi sotto,
  in orizzontale riempie lo schermo con i comandi in trasparenza.
