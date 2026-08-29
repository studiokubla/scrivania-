# Portare GdRadar su iPhone

Due strade, molto diverse per costo e per tempi. La prima funziona stasera, la
seconda richiede un backend che oggi non esiste.

---

## 1. Installarla sul telefono senza store (funziona ora)

L'app è una **PWA**: ha manifest, icone e service worker, quindi si installa
dalla schermata Home e si apre a tutto schermo, senza barra del browser, anche
senza rete.

Su iPhone: apri l'indirizzo in **Safari** (non Chrome), tocca **Condividi** →
**Aggiungi a Home**. Compare l'icona con il dado, e da lì si comporta come
un'app.

Cosa ottieni: schermo intero, icona, funzionamento offline, aggiornamento
automatico a ogni pubblicazione.
Cosa non ottieni: presenza sull'App Store, notifiche push affidabili su iOS,
accesso pieno all'hardware.

---

## 2. L'app nativa per l'App Store

Il guscio nativo è già configurato (Capacitor): la stessa base di codice viene
impacchettata dentro un'app iOS vera, che può poi crescere con funzioni native.

### Cosa serve, e non posso averlo io

- Un **Mac** con **Xcode** (il progetto iOS si genera solo su macOS).
- Un account **Apple Developer Program** — 99 €/anno.
- Un record dell'app su **App Store Connect**, con certificati e profili di firma.

### I comandi, sul Mac

```bash
cd gdradar
npm install
npm run ios:add     # genera la cartella ios/ (solo la prima volta)
npm run ios:sync    # ricostruisce www/ e la copia dentro il progetto iOS
npm run ios:open    # apre Xcode
```

In Xcode: seleziona il team di firma, poi *Product → Archive → Distribute App*.

### Da aggiungere a mano in `ios/App/App/Info.plist`

La geolocalizzazione è facoltativa nell'app, ma iOS pretende comunque la
motivazione, altrimenti la chiamata fallisce in silenzio:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Serve solo a calcolare la distanza dai tavoli vicini. La tua posizione
precisa non viene mai mostrata agli altri utenti.</string>
```

---

## 3. Perché oggi Apple la rifiuterebbe

Va detto chiaramente, perché sono soldi e settimane in gioco. Questo è un
prototipo funzionante, non un prodotto pubblicabile:

| Regola Apple | Problema | Cosa serve |
| --- | --- | --- |
| **4.2 Minimum Functionality** | Un contenitore attorno a una pagina web viene respinto se non aggiunge nulla di nativo | Notifiche push, mappa nativa, condivisione di sistema, gestione contatti |
| **2.1 App Completeness** | I 32 profili sul Radar sono generati, la chat risponde da sola, la verifica 18+ è simulata | Backend reale (PostgreSQL + PostGIS), utenti veri, provider di età vero |
| **5.1.1(v) Account Deletion** | Non c'è cancellazione dell'account dentro l'app | Un percorso di cancellazione, non solo il reset locale |
| **5.1.1 Privacy** | Serve una privacy policy raggiungibile da un URL pubblico | La pagina esiste già in-app: va anche pubblicata e collegata in App Store Connect |
| **1.2 User-Generated Content** | Richiede filtri, segnalazione, blocco e un contatto per lo sviluppatore | Blocco, segnalazione e moderazione ci sono già ✓ — manca il contatto pubblico |
| **Age Rating** | Servizio 18+ con incontri dal vivo | Classificazione 17+/18+ e verifica dell'età reale, non dichiarata |

Tradotto: **prima il backend, poi lo store**. Nell'ordine del blueprint —
fondazioni e auth, profili, verifica dell'età, Radar geospaziale, chat, Fairness
e moderazione — e a quel punto la sottomissione diventa un lavoro meccanico,
perché il guscio iOS è già pronto qui.

Nel frattempo la PWA copre il caso d'uso vero: farla provare a qualcuno, dal
telefono, con l'icona sulla Home.
