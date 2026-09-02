# Dynasty League

Gestionale per un fantacalcio in stile lega americana: rose, contratti, tetto salariale,
mercato, capitale societario e registro pubblico.

**Le formazioni restano su Leghe Fantacalcio.** Questo software copre tutto il resto — il
front office — che nelle stagioni precedenti viveva su fogli Excel duplicati per dieci
squadre, senza validazioni e senza uno storico consultabile.

- [`docs/REGOLAMENTO.md`](docs/REGOLAMENTO.md) — il regolamento consolidato, con la
  motivazione di ogni scelta e l'elenco delle modifiche rispetto ai documenti precedenti.
- [`docs/Regolamento-Dynasty-League-2026-27.pdf`](docs/Regolamento-Dynasty-League-2026-27.pdf)
  — lo stesso regolamento in venti diapositive, da mandare ai manager.
- [`brand/`](brand) — il marchio e la tavolozza.
- [`web/`](web) — l'applicazione.

---

## Cosa fa

**La proiezione del tetto salariale.** La tabella che nei fogli si compilava a mano, per
cinque stagioni: ingaggi, dead cap, spazio residuo, giocatori e slot pluriennali per ogni
annata. Firmare un triennale oggi si vede subito sul 2028.

**L'asta di settembre.** Il commissioner estrae l'ordine di chiamata e apre; a turno un
manager chiama un giocatore e tutti hanno venti secondi per depositare una busta. Allo
scadere si aprono insieme. Il software rifiuta l'offerta che non lascerebbe abbastanza
spazio per completare la rosa minima, e dice di quanto.

**Il mercato.** Free agency a busta chiusa con apertura automatica dopo 24 ore, waiver a
priorità inversa, scambi validati su entrambe le rose e su più stagioni, Team Option,
Franchise Tag, buy-out con preventivo. Le tre condizioni del performance buy-out si
misurano sui voti importati, non si discutono.

**Il capitale.** Stadio a cinque livelli con rientro dell'investimento calcolato, settore
giovanile, rete osservatori con registro datato — è ciò che risolve «chi ha investito
prima» — e premi delle competizioni versati in automatico.

**Il registro.** Ogni operazione è scritta in ordine di tempo, con l'impronta della
precedente. Non impedisce a chi ha accesso al database di modificare una riga, ma rende la
modifica visibile: la catena si spezza e la pagina lo dice.

Il commissioner amministra e **non possiede una squadra**: è la ragione per cui le buste
chiuse possono passare dal sistema senza il conflitto d'interesse che c'era quando le
offerte arrivavano in privato a un manager che a sua volta giocava.

---

## Avvio

Servono Node 22 e un PostgreSQL raggiungibile.

```bash
cd web
cp .env.example .env          # poi metti DATABASE_URL e AUTH_SECRET
npm install
npm run db:push               # crea le tabelle
npm run db:seed               # lega dimostrativa con 10 squadre e 400 giocatori
npm run dev
```

Accessi della lega dimostrativa:

| Ruolo | Indirizzo | Password |
| --- | --- | --- |
| Commissioner | `info@studiokubla.com` | `dynasty` |
| Manager | `manager1@dynasty.it` … `manager10@…` | `dynasty` |

I calciatori sono **quelli veri**: il seed legge il listone ufficiale in
`dati/Quotazioni_Fantacalcio_2026_27.xlsx`, lo stesso file che il commissioner ricaricherà
dal pannello a ogni aggiornamento delle quotazioni. Squadre e manager sono invece
segnaposto, da rinominare alla prima riunione di lega.

Il listone non porta le date di nascita: finché non si importano i dati Transfermarkt i
contratti Rookie e Veteran non si possono firmare (art. 4.2), e il seed non ne crea nessuno.

`AUTH_SECRET` firma i cookie di sessione e le impronte delle offerte a busta chiusa. In
produzione va generata: `openssl rand -base64 32`.

---

## I dati esterni

**Leghe Fantacalcio** è la fonte ufficiale per voti, presenze, quotazioni e ruoli (art. 21.1).
Non espone un'API pubblica: i dati arrivano dai file `.xlsx` che pubblica a ogni giornata,
che il commissioner carica dal pannello di amministrazione. È un passaggio manuale, ma è
l'unico che non si rompe quando un sito terzo cambia pagina, e lascia una traccia di chi ha
importato cosa e quando.

**Transfermarkt** non ha un'API pubblica e non consente l'estrazione automatica delle
pagine. Il software legge quindi un foglio compilato o esportato, con una riga per
giocatore; il modello è scaricabile dal pannello. Sono dati che cambiano poche volte
l'anno — la data di nascita mai — quindi un import a stagione basta.

Le date di nascita non sono un dettaglio: senza, i contratti Rookie e Veteran non si
possono firmare (art. 4.2) e i requisiti primavera non si verificano. Il pannello segnala
quanti giocatori sotto contratto ne sono privi.

Quello che non si riconcilia **non si indovina**: finisce in un elenco da risolvere a mano.
Un abbinamento sbagliato manderebbe i voti sul giocatore di un'altra squadra, ed è un
errore che nessuno noterebbe subito.

---

## Struttura

```
brand/                     marchio e tavolozza
dati/                      listone ufficiale della stagione
docs/                      regolamento, in testo e in presentazione
web/
  prisma/schema.prisma     modello dati
  prisma/seed.ts           lega dimostrativa
  src/lib/ruleset.ts       tutti i parametri del regolamento, validati con zod
  src/lib/money.ts         aritmetica in centesimi di milione
  src/lib/rules/           motore regole: funzioni pure, nessun database
  src/lib/import/          lettura dei file ufficiali e riconciliazione dei nomi
  src/lib/audit.ts         registro concatenato
  src/app/actions/         operazioni: contratti, mercato, asta, società, amministrazione
  src/app/(app)/           interfaccia
  scripts/                 verifiche end-to-end con browser reale
```

Due scelte che spiegano il resto del codice.

**Gli importi si contano in centesimi di milione**, non in numeri con la virgola. La lega
si muove a passi di 0,25 M e in virgola mobile `0.1 + 0.2` non fa `0.3`: un tetto salariale
sbagliato di un centesimo è un tetto salariale sbagliato. La conversione avviene solo ai
bordi.

**Il motore regole non contiene numeri.** Tetto, premi, durate, percentuali e costi stanno
tutti in `ruleset.ts`, validato con zod e salvato sulla lega. Cambiare regolamento è una
modifica di configurazione — che è quello che l'art. 24 prevede — non una riscrittura.

---

## Verifiche

```bash
npm test                  # 85 test unitari sul motore regole
npm run typecheck
npm run verifica          # tutte le verifiche end-to-end (serve il server avviato)
```

Le verifiche end-to-end guidano un browser vero contro l'applicazione in esecuzione, con
più manager collegati contemporaneamente:

| Script | Cosa percorre |
| --- | --- |
| `verifica-pagine.mjs` | ogni pagina con i due ruoli, più i controlli di accesso |
| `verifica-mercato.mjs` | offerta sigillata, rilancio, scadenza, assegnazione, registro |
| `verifica-asta.mjs` | chiamata fuori turno, tre buste segrete, spareggi, aggiudicazione |
| `verifica-import.mjs` | file in formato Leghe Fantacalcio, riconciliazione, fantavoti |
| `verifica-societa.mjs` | stadio, primavera, osservatori, premi, manutenzione |

Due strumenti a parte, che non fanno parte delle verifiche:

| Script | A cosa serve |
| --- | --- |
| `presentazione.mjs` | ricompone il PDF del regolamento dopo una modifica |
| `listone-da-pdf.mjs` | estrae il listone da un PDF di sole immagini, con OCR e doppia lettura di controllo — serve solo se le quotazioni arrivano come screenshot invece che come foglio di calcolo |

Per eseguirle serve il server avviato (`npm run build && npm start`) e il database popolato
con `npm run db:seed`. Impostano `BASE` se il server non è su `http://127.0.0.1:3100`.

---

## Messa in produzione

L'applicazione è un Next.js standard con un database PostgreSQL: sta su Vercel con un
Postgres gestito senza configurazioni particolari. Le due variabili da impostare sono
`DATABASE_URL` e `AUTH_SECRET`.

Le scadenze — le 24 ore della free agency, le 48 del waiver e degli scambi, i venti secondi
dell'asta — si risolvono quando qualcuno apre la pagina, non con un processo in background.
Per una lega di dieci persone è sufficiente e non richiede infrastruttura: l'esito dipende
solo dall'orario di scadenza, non da chi guarda né da quando.
