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
| `listone.json` | i 531 giocatori di Serie A 2026/27, che al momento della pubblicazione vengono incorporati nella pagina |

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
altra parte: tetto 85 M, rosa 25-30, minimi 3P 8D 8C 6A, nove slot pluriennali,
i cinque tipi di contratto con i loro vincoli d'età e i massimali. Cambiare il
regolamento è una modifica a quell'oggetto, non una caccia dentro le funzioni.

## Cosa c'è e cosa manca

C'è: ingresso dei dieci presidenti e del commissioner, listone filtrabile per
ruolo, età e idoneità primavera, composizione della rosa con tipo di contratto e
ingaggio, tetto salariale con riserva per completare la rosa, slot pluriennali,
minimi di ruolo, pannello del commissioner, registro delle operazioni.

Manca ancora: l'asta di settembre, il mercato a buste chiuse, gli scambi e
l'economia societaria (stadio, settore giovanile, osservatori). Il regolamento
consolidato di tutte queste parti è in `dynasty/docs/REGOLAMENTO.md`.
