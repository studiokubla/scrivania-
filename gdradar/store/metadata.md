# App Store Connect — campi da incollare

Tutto quello che il modulo chiede, già scritto. I limiti di caratteri sono
quelli di Apple; i testi qui sotto ci stanno dentro.

---

## Scheda

**Nome** (30) — `GdRadar`

**Sottotitolo** (30) — `Trova con chi giocare di ruolo`

**Categoria** — Primaria: *Social Networking* · Secondaria: *Entertainment*

**Testo promozionale** (170)

> Il Radar mostra chi gioca vicino a te, con quanto siete compatibili e perché.
> Niente feed, niente recensioni al veleno: solo tavoli che possono funzionare.

**Descrizione** (4000)

> GdRadar mette in contatto giocatori, Master, Party e Campagne di gioco di ruolo
> vicini o compatibili.
>
> IL RADAR
> Scegli un raggio da 5 a 100 km e vedi chi c'è intorno: persone, gruppi, campagne
> aperte e annunci. La tua posizione precisa non viene mai mostrata a nessuno —
> gli altri leggono solo la zona e una distanza arrotondata.
>
> COMPATIBILITÀ SPIEGATA
> Ogni risultato porta un punteggio da 0 a 100 calcolato su sistema di gioco,
> distanza, disponibilità, ruolo, modalità e tipo di esperienza. Il punteggio è
> deterministico e ti mostra sempre il perché, voce per voce: nessun algoritmo
> che decide al buio.
>
> FAIRNESS, NON RECENSIONI
> Non misuriamo quanto giochi bene. Dopo un incontro nato su GdRadar puoi
> rispondere a quattro domande chiuse sulla correttezza dell'esperienza. Il
> feedback è anonimo verso chi lo riceve, non esiste testo libero pubblico e il
> punteggio compare solo dopo cinque esperienze, calcolato in modo prudenziale.
>
> CONTATTI SOLO CON CONSENSO
> Prima una richiesta, poi la chat. Telefono, Discord o Telegram passano solo
> quando entrambe le persone accettano, e puoi interrompere in qualsiasi momento.
>
> SICUREZZA VERA
> Blocco immediato e silenzioso, segnalazione anonima, moderazione umana con
> evidenze e ricorso. Nessun ban deciso da un algoritmo. Servizio riservato ai
> maggiorenni, con verifica dell'età che non conserva documenti.
>
> ADATTO A CHI INIZIA
> L'etichetta Newbie Friendly esiste su profilo, Party e singola campagna: chi
> gioca per la prima volta trova tavoli che lo aspettano davvero.

**Parole chiave** (100, separate da virgola)

```
gdr,gioco di ruolo,dnd,dungeons,master,tavolo,rpg,party,campagna,dadi,giocatori,d20
```

**URL di supporto** — `https://studiokubla.github.io/scrivania-/supporto.html`
**URL marketing** — `https://studiokubla.github.io/scrivania-/gdradar/`
**URL privacy** — `https://studiokubla.github.io/scrivania-/privacy.html`

*(diventano `studiokubla.github.io/gdradar/...` se pubblichi da un repository
chiamato gdradar; vanno raggiungibili prima di inviare, o la revisione si ferma)*

---

## Note per la revisione — il campo più importante

> L'app non richiede registrazione per essere valutata: nella schermata iniziale
> tocca **"Entra nella demo"**. Si apre un profilo già configurato a Milano, con
> richieste di contatto in sospeso, una conversazione aperta e un feedback in
> attesa, così tutti i flussi sono percorribili in un minuto.
>
> Percorsi da provare: Radar → tocca un dado → "Richiedi il contatto";
> Messaggi → "Proponi lo scambio"; Fairness → "Rispondi";
> scheda di un profilo → "Segnala" → il caso appare in Moderazione.
>
> Il servizio è riservato ai maggiorenni. La verifica dell'età avviene tramite
> provider esterno privacy-preserving: GdRadar riceve solo un esito e non
> conserva documenti, numeri di documento o selfie.

**Account demo** — non serve: nessun login.

---

## Classificazione per età

Rispondi così al questionario. Il risultato atteso è **17+ / 18+**.

| Domanda | Risposta |
| --- | --- |
| Contenuti sessuali o nudità | Nessuno |
| Violenza realistica / fantastica | Nessuna |
| Riferimenti a alcol, tabacco, droghe | Nessuno |
| Gioco d'azzardo simulato | Nessuno |
| **App non filtrata con contenuti generati dagli utenti** | **Sì** (chat e annunci) |
| **Funzioni di incontro / social non filtrate** | **Sì** |
| **L'app permette di incontrare persone di persona** | **Sì** |

---

## Privacy — etichette nutrizionali

Per **questa versione prototipo**, in cui nulla lascia il dispositivo:

- *Data Not Collected* — l'app non invia dati a nessun server; profilo, chat e
  preferenze restano nella memoria locale del browser/dispositivo.

Quando arriva il backend, le voci diventano: **Identificativi** (account),
**Contatti** (solo quelli che l'utente sceglie di scambiare), **Posizione
approssimativa** (per la ricerca per distanza), **Contenuti utente** (messaggi e
annunci) — tutte con finalità *Funzionalità dell'app*, nessuna per tracciamento
pubblicitario, nessuna condivisione con terze parti.

---

## Conformità all'esportazione

L'app non usa crittografia propria oltre a HTTPS di sistema: la chiave
`ITSAppUsesNonExemptEncryption = false` è già impostata dal workflow, quindi la
domanda non ricompare a ogni build.

---

## Screenshot

In `store/screenshots/`, generati dall'app reale:

- `6.9-*.png` — 1290 × 2796 (iPhone 16 Pro Max e simili)
- `6.5-*.png` — 1242 × 2688 (iPhone 11 Pro Max e simili)

Ordine consigliato: Radar, compatibilità spiegata, messaggi con scambio contatti,
Fairness, sicurezza.
