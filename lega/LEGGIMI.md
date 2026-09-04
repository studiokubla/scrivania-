# Dynasty League — la web app

Il gestionale della lega, rifatto da zero come pagina unica pubblicata su
claude.ai. **Non ha un server e non ha un database da mantenere**: lo stato
condiviso vive nel database dell'artifact, e i dieci presidenti vedono le mosse
degli altri mentre accadono.

È la differenza che conta rispetto alla versione precedente, che stava in
`dynasty/`: quella chiedeva un PostgreSQL, un deploy su Vercel e tre variabili
d'ambiente, e infatti a un certo punto l'indirizzo ha smesso di rispondere e la
lega è rimasta senza gestionale. Qui non c'è niente che possa scadere.

## I file

| File | Cosa contiene |
| --- | --- |
| `app.html` | l'applicazione intera: stile, regolamento, motore regole, interfaccia |
| `listone.json` | i 531 giocatori di Serie A 2026/27 con i **ruoli Mantra**; `componi.mjs` lo incorpora in `app.html` a ogni ricomposizione |
| `demo.html` | la demo autonoma: un file solo, apribile con un doppio clic, con una lega di esempio già giocata |
| `demo-guscio.html` | il guscio della demo: un database finto su `localStorage` al posto di quello condiviso |
| `demo-dati.json` | la lega di esempio — dieci squadre, 250 contratti, 60 voci di registro |
| `semina-demo.mjs` | genera `demo-dati.json` e verifica che ogni rosa rispetti il regolamento |

Come si rifà la demo è scritto in [`COSTRUISCI-DEMO.md`](COSTRUISCI-DEMO.md).

Il listone viaggia **dentro** la pagina, non nel database: è un dato di
riferimento della stagione che non cambia da solo, e tenerlo nel database
vorrebbe dire scriverlo una volta e poi mantenerlo a mano per sempre.

## Come si aggiorna

Si modifica `app.html` e si ripubblica sullo stesso indirizzo. I dati della lega
— squadre, rose, registro — restano dove sono: stanno nel database
dell'artifact, non nella pagina.

Per rigenerare il listone quando escono le quotazioni nuove, dal foglio
ufficiale:

```bash
cd dynasty/web && npm run listone:json     # aggiorna src/data/listone-2026-27.json
```

poi si ricompone `lega/listone.json` in forma compatta
(`[nome, ruolo, indice squadra, quotazione, valore, età]`) e si ripubblica.

## Il regolamento, in numeri

Tutte le regole stanno nell'oggetto `REGOLE` in cima allo script, e da nessuna
altra parte: tetto 85 M, rosa 25-30, nove slot pluriennali,
i cinque tipi di contratto con i loro vincoli d'età e i massimali, e i requisiti
del settore giovanile (fino a 20 anni, quotazione non oltre 3 M). Cambiare il
regolamento è una modifica a quell'oggetto, non una caccia dentro le funzioni:
il testo che l'app mostra ai presidenti legge da lì, quindi non può contraddirlo.

Si entra **toccando la propria squadra, senza codice**: chi ha il link è della
lega. Il commissioner può chiedere un codice per ciascuno da *Gestione* → *Come
si entra* (`chiediCodice` nella configurazione della lega); serve a non sbagliare
porta, non a difendere segreti, perché chi ha il link legge tutto comunque.

## Cosa c'è e cosa manca

**Svincolare libera il posto, non lo spazio.** L'ingaggio di chi viene svincolato
resta sul tetto fino a fine stagione: la rosa torna a ventiquattro, lo spazio
salariale no. È la regola che rende il mercato una cosa seria — un contratto
firmato è una decisione che si porta fino in fondo. A stagione conclusa il
commissioner li libera tutti insieme da *Gestione → Fine stagione*.

**Il fantacalcio è Mantra**: ogni giocatore porta i suoi ruoli veri — Por, Dd,
Dc, Ds, B, E, M, C, W, T, A, Pc — e 270 su 531 ne hanno più d'uno. Si vedono
accanto al nome ovunque, per esteso al momento della firma, e il listone si
filtra per ruolo Mantra oltre che per reparto. La rosa mostra quanti ne hai per
ruolo: sapere di avere otto difensori non dice se puoi schierare una difesa a
tre.

**Non ci sono minimi per ruolo**: si può stare con un portiere solo, purché la
rosa resti fra 25 e 30 giocatori. È una scelta di questa lega rispetto all'art.
3.1, e il conteggio per ruolo nella pagina Rosa resta un'informazione — racconta
com'è fatta la squadra, non come dovrebbe essere.

C'è: ingresso dei dieci presidenti e del commissioner, iscrizione delle squadre
coi nomi veri, listone filtrabile per ruolo, età e idoneità primavera,
composizione della rosa con tipo di contratto e ingaggio, tetto salariale con
riserva per completare la rosa, slot pluriennali, minimi di ruolo, l'economia
societaria (Capitale, stadio a cinque livelli, settore giovanile, rete
osservatori, movimenti col saldo), pannello del commissioner, registro delle
operazioni.

**Non ci sono segnaposto.** La lega nasce vuota e il commissioner iscrive le
dieci squadre con i nomi veri, incollando un elenco: una riga per squadra, nome
e presidente. Ognuna nasce con la dotazione dell'art. 14, e la riga che lo dice
finisce nel registro — un capitale che compare senza una traccia che lo spieghi
è un capitale su cui prima o poi qualcuno discute.

C'è anche il mercato: free agency a busta chiusa con apertura dopo 24 ore,
waiver di 48 ore su chi viene tagliato, scambi validati su **entrambe** le rose.
Le scadenze si risolvono quando qualcuno apre la pagina, non con un processo che
gira di notte: per dieci persone basta, e l'esito dipende solo dall'orario
scritto nel documento, non da chi guarda né da quando.

**L'asta di settembre non c'è, ed è voluto:** si fa al tavolo. La lega ha due
momenti, che il commissioner sceglie da *Gestione* → *A che punto siamo*:
`COMPOSIZIONE` per scrivere le rose come sono uscite dall'asta (dal listone si
firma subito) e `MERCATO` per il resto della stagione (sui liberi si depositano
buste).

Un limite da conoscere: **le buste sono chiuse per accordo, non per
crittografia.** L'applicazione non mostra a nessuno le offerte altrui prima
dell'apertura, ma chi sa aprire il database della lega potrebbe leggerle. Fra
dieci persone che si conoscono va bene, purché sia detto — e infatti la pagina
del mercato lo dice.
