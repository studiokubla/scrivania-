# Da prototipo a servizio reale

Il prototipo dimostra che il prodotto ha senso. Renderlo reale non significa
"aggiungere un server": significa risolvere, nell'ordine, tre problemi diversi —
uno tecnico, uno legale, uno di persone. Il terzo è quello che affonda la maggior
parte delle app di questo tipo, ed è l'unico che il codice non risolve.

---

## Il problema che viene prima di tutti: il Radar vuoto

GdRadar vale solo se, quando apri il Radar, c'è qualcuno. Con dieci iscritti
sparsi su tutta Italia la schermata è vuota, la prima impressione è "non
funziona", e chi se ne va non torna.

Quindi la strategia non è "lanciare in Italia": è **saturare una città**.
Cinquanta persone attive a Milano valgono più di duemila sparse ovunque. Da qui
discendono le scelte tecniche che seguono: servono a portarti a una beta chiusa
in una città, non a reggere un milione di utenti che non hai.

Dove si trovano le prime persone, concretamente: ludoteche e circoli del gioco,
fiere (Lucca, Play Modena), gruppi Facebook e server Discord locali, negozi
specializzati. Non con la pubblicità: andandoci di persona, spiegando cosa fai e
chiedendo di provare. I primi cento utenti si conquistano uno alla volta.

---

## Fase 0 — Decisioni, prima di scrivere codice (1 settimana)

Cinque scelte che condizionano tutto il resto:

1. **Entità legale e titolare del trattamento.** Un servizio 18+ che tratta
   posizione e chat non si lancia a nome personale.
2. **Dominio e nome.** Verifica che *GdRadar* sia libero come marchio nella
   classe giusta e come dominio.
3. **Provider per la verifica dell'età.** Candidati europei: Yoti, Veriff,
   Onfido; in prospettiva IT-Wallet e il proof-of-age europeo. Chiedi tre
   preventivi: il costo è **a verifica**, e cambia il modello di business.
4. **Stack.** Vedi sotto: la scelta vera è "backend gestito" contro "backend tuo".
5. **Budget e tempo tuo reale.** Il piano sotto è circa 3 mesi di lavoro serio
   per una persona sola, o 6-7 settimane in due.

---

## La scelta tecnica: gestito o proprio

Il blueprint propone FastAPI + PostgreSQL/PostGIS. È corretto, ed è la strada da
prendere se hai un backend developer. Se invece parti da solo o quasi, c'è una
strada più corta che **non ti chiude nessuna porta**:

| | Backend gestito (Supabase) | Backend proprio (FastAPI) |
| --- | --- | --- |
| Database | Postgres con PostGIS incluso | Postgres da installare e gestire |
| Autenticazione | pronta, con Apple e Google | da scrivere (la parte più delicata) |
| Chat in tempo reale | inclusa | websocket da scrivere e scalare |
| Permessi per riga | RLS nel database | logica applicativa da scrivere |
| Tempo alla prima beta | settimane | mesi |
| Costo iniziale | gratis, poi ~25 €/mese | server + tempo |
| Se un giorno vuoi uscirne | è Postgres standard: si esporta | — |

**Raccomandazione**: Supabase per arrivare alla beta, con la logica di dominio
scritta in modo portabile (SQL e funzioni, non magie del provider). Il giorno che
i numeri lo giustificano, il database si sposta: è Postgres.

---

## Cosa di questo prototipo sopravvive

Non si riparte da zero. Delle 1.200 righe di logica, buona parte è già la logica
vera del prodotto:

| File | Destino |
| --- | --- |
| `match.js` (compatibilità) | **si sposta sul server**, quasi identico: il punteggio deve essere calcolato dove ci sono i dati veri, non nel browser |
| `geo.js` (distanze, vista pubblica) | **si sposta sul server** e diventa una query PostGIS: è la regola che impedisce alle coordinate di uscire |
| `store.js` (27 funzioni) | **si sostituisce**: stesse firme, dentro chiamate HTTP invece di `localStorage` |
| `data.js` (dati finti) | **muore**, tranne i vocabolari (sistemi, giorni, formati) che diventano tabelle |
| tutte le viste, CSS, marchio | **restano** |

È il motivo per cui `store.js` è stato scritto come un'unica porta: le viste non
sanno da dove arrivano i dati, quindi cambiare la sorgente non le tocca.

**Nota architetturale che cambia il codice**: oggi il browser riceve tutti i dati
e calcola la compatibilità in locale. Nel servizio reale il browser deve ricevere
**solo la vista pubblica** (zona, distanza arrotondata, punteggio già calcolato e
le sue motivazioni). Altrimenti la promessa sulla privacy della posizione è
scritta nell'interfaccia ma non nei fatti.

---

## Fase 1 — Fondazioni (2-3 settimane)

Traguardo: **due telefoni veri, in due case diverse, si vedono sul Radar**.

- Schema del database: `users`, `profiles`, `age_verifications`, `game_systems`,
  `user_games`, `availabilities`, `locations` (con `geography(Point)` e indice
  GiST), `parties`, `campaigns`, `listings`.
- Autenticazione email + Apple + Google.
- Row Level Security da subito, non "dopo": è la differenza fra una fuga di dati
  e una notte tranquilla.
- La query del Radar come funzione SQL che restituisce già la vista pubblica.
- Il frontend passa al livello dati vero.

## Fase 2 — Contatto (2 settimane)

Traguardo: **due persone si scrivono e si scambiano i contatti**.

- Richieste di contatto, accettazione, rifiuto.
- Chat in tempo reale, solo testo.
- Scambio contatti con doppio consenso registrato come evento (è quello che poi
  sblocca la Fairness).
- Notifiche push — anche perché sono la funzione nativa che giustifica l'app iOS
  agli occhi di Apple.

## Fase 3 — Fiducia e sicurezza (2 settimane)

- Blocchi e segnalazioni con effetti veri sulle query.
- Backoffice di moderazione su dominio separato, con ruoli e audit log.
- Fairness: feedback qualificati, Wilson lower bound, soglia dei cinque.
- Verifica 18+ collegata al provider scelto, con il gating delle funzioni.

## Fase 4 — Legale, in parallelo dalla Fase 1

Non è burocrazia rimandabile: senza, la beta è illegale.

- Privacy policy e Termini di servizio scritti da un avvocato — quelli
  nell'app sono un buon punto di partenza, non un documento legale.
- Registro dei trattamenti, base giuridica, tempi di conservazione.
- Nomina dei responsabili esterni (hosting, provider età, push).
- Procedura per le richieste degli utenti (accesso, cancellazione).
- Valutazione d'impatto: un servizio che incrocia posizione, minori esclusi e
  incontri dal vivo la richiede quasi certamente.

## Fase 5 — Beta chiusa in una città (4-6 settimane di calendario)

50-150 persone reali, inviti a mano. Qui non si sviluppa: si guarda.

Le metriche del blueprint diventano il cruscotto: percentuale di verificati,
profilo completo, **search-to-contact**, accettazione delle richieste,
scambio contatti, incontri confermati, tempo mediano per trovare un match utile,
blocchi e segnalazioni ogni mille interazioni.

**Il cancello**: si va allo store solo quando una persona nuova, in quella città,
trova qualcuno con cui giocare entro una settimana. Se questo non succede, l'App
Store non lo aggiusta.

## Fase 6 — App Store

A quel punto è meccanica: la pipeline è già scritta
(`.github/workflows/ios-testflight.yml`), gli screenshot e i testi sono in
`store/`, e i tre motivi di rifiuto elencati in `APPSTORE.md` sono nel frattempo
caduti da soli — perché i dati sono veri, la verifica è vera e le notifiche push
sono la funzione nativa che mancava.

---

## Ordine di grandezza dei costi, primo anno

Indicativi, da verificare con preventivi veri:

- Apple Developer: 99 €/anno · Dominio: ~15 €/anno
- Backend gestito: 0 € in beta, ~25 €/mese dopo
- Verifica età: costo **a verifica** — è la voce che scala con gli utenti
- Consulenza legale (policy + registro + DPIA): la voce più grande dell'anno zero
- Push e email transazionali: trascurabili all'inizio

---

## Il primo passo concreto

In quest'ordine, e uno alla volta:

1. Scegli fra backend gestito e backend proprio.
2. Crea il progetto e fai girare **lo schema del database**.
3. Sostituisci `store.js` con il livello dati vero, funzione per funzione,
   tenendo le stesse firme.

Il punto 2 si può fare subito: lo schema SQL completo — tabelle, indici
geografici, policy di sicurezza per riga, funzione del Radar e vocabolari già
popolati — è la cosa più utile da avere in mano prima di aprire qualsiasi conto.
