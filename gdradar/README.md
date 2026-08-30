# GdRadar — prototipo funzionante della V1

Web app per trovare **giocatori, Master, Party e Campagne** vicini o compatibili, costruita
seguendo il *Product & Technical Blueprint V1*: Radar geolocalizzato, matching deterministico e
spiegabile, Fairness anonima, Trust & Safety e Moderation Core.

Nessuna build, nessuna dipendenza: HTML, CSS e JavaScript statici. Si apre facendo doppio clic su
`index.html` (o si carica su un qualsiasi hosting statico).

## Cosa c'è dentro

| Area | Dove | Cosa fa davvero |
| --- | --- | --- |
| **Landing pubblica** | `#/` | I quattro pilastri, come funziona, Fairness, sicurezza. |
| **Onboarding** (flusso A) | `#/onboarding` | Account → profilo → età dichiarata → prova 18+ → Patto di Community → giochi → zona → disponibilità. Ogni passo è validato. |
| **Radar** (flusso B) | `#/radar` | Ricerca geografica con raggi 5–100 km, filtri base e avanzati, visualizzazione radar o lista, ordinamento per compatibilità/distanza/recenza. |
| **Scheda** | drawer | Compatibilità con il dettaglio punto per punto, Fairness come segnale separato, blocco e segnalazione. |
| **Annunci** | `#/annunci` | Creazione, bozze, pubblicazione, sospensione e chiusura (lo storico resta, la ricercabilità no). |
| **Messaggi** (flusso C) | `#/messaggi` | Richiesta di contatto → accettazione → chat testuale → proposta di scambio → doppio consenso → scambio registrato. |
| **Fairness** (flusso D) | `#/fairness` | Le quattro domande chiuse, punteggio con Wilson lower bound, soglia dei 5 feedback, motivo negativo privato. |
| **Sicurezza** (flusso E) | `#/sicurezza` | Blocchi, segnalazioni inviate, cosa vedono gli altri, indicazioni per gli incontri dal vivo. |
| **Moderazione** | `#/moderazione` | Backoffice: coda casi, triage, severity S0–S4, evidenze vincolate al caso, azioni proporzionate, ricorsi, audit log, quattro ruoli. |
| **Gioco etico / Privacy** | `#/etica`, `#/privacy` | Patto di Community, Newbie Friendly, modello dati della verifica 18+. |

## Metterlo online, e sul telefono

`node gdradar/build.js` produce tre forme della stessa app:

- `dist/gdradar.html` — file singolo, doppio clic o da spedire;
- `docs/gdradar/` — l'app come cartella, **installabile**: manifest, icone e service worker, quindi
  su iPhone si aggiunge alla schermata Home e funziona anche offline;
- `www/` — la stessa cartella impacchettata dal guscio iOS (Capacitor), rigenerata a ogni build.

Per accendere il sito, una volta sola su GitHub: **Settings → Pages → Source: Deploy from a
branch**, poi il branch e la cartella `/docs`. L'indirizzo diventa
`https://studiokubla.github.io/scrivania-/gdradar/` e si aggiorna a ogni push.

Per l'app iOS e cosa chiede davvero l'App Store: **[APPSTORE.md](APPSTORE.md)**.
Per il percorso da prototipo a servizio reale: **[ROADMAP.md](ROADMAP.md)**.

## Come provarlo in trenta secondi

Apri `index.html` e clicca **Entra nella demo**: il profilo è già a Milano, con richieste di
contatto in sospeso, una chat aperta e un feedback in attesa. In alternativa **Crea il profilo**
per l'onboarding completo.

## Le decisioni di prodotto tradotte in codice

- **La posizione precisa non esce mai.** `geo.js` calcola le distanze; verso la UI passano solo
  `publicView()` — zona pubblica e distanza arrotondata (`fmtKm`).
- **Il matching è deterministico e spiegabile.** `match.js` assegna 100 punti su sei componenti
  (sistema 26, distanza 22, disponibilità 20, ruolo 14, modalità 10, tipo di esperienza 8) e
  restituisce, per ciascuna, i punti ottenuti *e la frase che li giustifica*.
- **Fairness fuori dal punteggio.** Non entra nel calcolo della compatibilità: viaggia come segnale
  separato, nascosto sotto i 5 feedback qualificati, calcolato con **Wilson lower bound** al 95%
  (5 su 5 → 57%, 97 su 100 → 92%) e con un lieve peso sulla recenza.
- **Newbie Friendly a tre livelli.** Profilo, Party e campagna/annuncio: nella singola ricerca pesa
  l'ultimo, e per chi è alle prime armi ha la precedenza sul livello dichiarato.
- **Verifica 18+ senza documenti.** Il modello salvato è `{status, threshold, provider, ref,
  verified_at, expires_at}` e niente altro. Il gate blocca contatti e pubblicazione.
- **Doppio consenso per i contatti.** Lo scambio è un evento di piattaforma: è ciò che rende la
  relazione *qualificata* e sblocca il feedback.
- **Moderazione umana.** I flag automatici aprono un caso, non lo chiudono. Ogni accesso a
  un'evidenza privata scrive una riga di audit; le azioni disponibili dipendono dal ruolo.

## Identità visiva

Palette e caratteri vengono da un manifesto di riferimento: notte blu profonda (`#080F1E`),
il **ciano del portale** (`#5FD0E8`) per tutto ciò che è vivo e misurato — anelli e spazzata del
Radar, compatibilità, selezioni — e l'**oro inciso** (`#E3B75E`) per marchio, titoli e azione
primaria. Brace (`#E0813F`), arcano (`#8F76E0`) e acciaio (`#7FA0C4`) restano semantici:
distinguono Party, Campagne e annunci.

Il **marchio** è una cosa sola letta due volte: il logotipo *GDRADAR* ha lettering uniforme —
stesso carattere, stesso peso, stessa spaziatura per ogni lettera — e l'unica che si stacca è la
**R**, in oro. Dietro quella R sta il d20, ancorato alla lettera con misure in `em`: cresce e si
ricentra da solo a ogni corpo, dal logotipo di 15 px alla testata. Lo stesso segno esiste anche
da solo, con la R incastonata nella faccia frontale (`GD.ui.d20Mark`), per favicon e icona, dove
la parola non entrerebbe.

I caratteri sono due più uno: **Cinzel** per i titoli (epigrafico, solo maiuscolo, senza corsivo —
il contrasto lo fa il colore), **Spectral** per testo e interfaccia, **Prata** per il solo
logotipo: serif moderno ad alto contrasto, con le grazie affilate, che regge fino a 15 px.

### Usare un carattere con licenza propria

Il logotipo passa da un solo token. Se hai la licenza di un display commerciale (per esempio
*Monster of Fantasy* di Storytype), servono due passaggi:

1. metti il file in `gdradar/assets/fonts/` e dichiaralo in cima a `base.css`:
   `@font-face{font-family:'Marchio';src:url('../fonts/marchio.woff2') format('woff2');font-display:swap}`
2. cambia una riga: `--serif-deco:'Marchio','Prata',Georgia,serif;`

Nel bundle in singolo file il font va incorporato come data URI, altrimenti resta un riferimento
esterno che non viaggia con la pagina.

Sul Radar i risultati non sono puntini ma **d20**: esagono di silhouette, faccia illuminata e tre
spigoli (`GD.ui.d20`), con la dimensione del dado che porta la compatibilità e il colore che porta
il tipo. Il dado d'oro al centro sei tu. Tutto passa dai token in `base.css`: cambiare mondo visivo
significa cambiare quel file.

## Struttura dei file

```
gdradar/
├── index.html
└── assets/
    ├── css/  base.css (token e controlli) · components.css · app.css (schermate)
    └── js/
        ├── util.js     template HTML sicuro, formattazione, icone
        ├── geo.js      città, distanze, rotte, vista pubblica della posizione
        ├── data.js     vocabolari di dominio e dati seed deterministici
        ├── match.js    compatibilità spiegabile + Fairness (Wilson)
        ├── store.js    stato, persistenza e azioni di dominio
        ├── ui.js       guscio dell'app, drawer, modali, card
        ├── view-*.js   una vista per schermata
        └── app.js      router e avvio
```

I nomi delle entità seguono lo schema dati del blueprint (utenti, party, campagne, annunci,
richieste, conversazioni, blocchi, report, feedback, casi di moderazione): sostituire
`store.js` con un client HTTP verso `/auth`, `/radar`, `/listings`, `/contacts`, `/fairness`,
`/moderation` è un cambio di adapter, non una riscrittura.

## Limiti del prototipo

Non c'è backend: i dati stanno nel `localStorage` del browser e le 32 persone, 10 Party,
12 Campagne e 30 annunci sul Radar sono generati con un seed fisso. La risposta in chat e la
verifica 18+ sono simulate. In produzione servono PostgreSQL + PostGIS per le query geospaziali,
un provider reale di proof-of-age e un backoffice separato con permessi propri, come indicato
nel blueprint.
