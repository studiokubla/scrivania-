# Portare GdRadar sull'App Store

Tutto quello che serve è qui dentro, tranne le tre cose che solo tu puoi avere:
un account Apple Developer, la chiave API di App Store Connect e la scheda
dell'app. Il Mac invece non serve: la compilazione gira sui runner macOS di
GitHub.

---

## 1. Le tre cose da fare una volta sola

**a. Apple Developer Program** — 99 €/anno, su developer.apple.com. Serve un
account con verifica dell'identità; per una società servono anche il numero
D-U-N-S e i documenti. Mettici qualche giorno.

**b. Chiave API** — App Store Connect → *Users and Access* → *Integrations* →
*App Store Connect API* → genera una chiave con ruolo **App Manager**. Il file
`.p8` si scarica **una volta sola**: salvalo. Ti servono tre valori:
Key ID, Issuer ID e il contenuto del `.p8`.

**c. Scheda dell'app** — App Store Connect → *Apps* → **+** → nuova app iOS,
bundle ID **`com.studiokubla.gdradar`**, nome *GdRadar*, lingua principale
italiano.

## 2. I quattro segreti nel repository

GitHub → *Settings* → *Secrets and variables* → *Actions* → **New repository secret**:

| Nome | Valore |
| --- | --- |
| `APPSTORE_KEY_ID` | Key ID della chiave API |
| `APPSTORE_ISSUER_ID` | Issuer ID |
| `APPSTORE_PRIVATE_KEY` | il contenuto integrale del file `.p8`, incollato |
| `APPLE_TEAM_ID` | Team ID, 10 caratteri, in *Membership* |

## 3. Lanciare la build

GitHub → *Actions* → **iOS · TestFlight** → *Run workflow*. Circa venti minuti:
genera il progetto iOS, firma, compila, esporta l'`.ipa` e lo carica su App Store
Connect. Da lì la build compare in **TestFlight** (provala sul telefono) e poi si
promuove a *App Store* → *Invia per la revisione*.

Il workflow è in `.github/workflows/ios-testflight.yml`, commentato riga per riga.

## 4. Cosa incollare nel modulo

In **`store/metadata.md`**: nome, sottotitolo, descrizione, parole chiave,
categorie, risposte al questionario sull'età, etichette privacy, conformità
all'esportazione e — il campo che fa passare o bocciare una revisione — le
**note per il revisore**, con il percorso da seguire nella demo.

Screenshot già pronti alle misure obbligatorie in **`store/screenshots/`**:
1290 × 2796 e 1242 × 2688, generati dall'app vera.

Le pagine pubbliche che il modulo pretende (privacy e supporto) sono in
`store/pagine/` e vengono pubblicate insieme al sito:
`…/privacy.html` e `…/supporto.html`. **Devono rispondere prima dell'invio**,
quindi accendi GitHub Pages, altrimenti la revisione si ferma lì.

---

## 5. Se preferisci il Mac

```bash
cd gdradar
npm install
npm run ios:add     # genera ios/ (solo la prima volta)
npm run ios:sync    # ricostruisce www/ e la copia nel progetto
npm run ios:open    # apre Xcode
```

Poi *Product → Archive → Distribute App*. In `ios/App/App/Info.plist` va aggiunta
la motivazione della posizione, che in CI viene messa in automatico:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Serve solo a calcolare la distanza dai tavoli vicini. La tua posizione
precisa non viene mai mostrata agli altri utenti.</string>
```

---

## 6. Cosa aspettarsi dalla revisione

Vale la pena saperlo prima, per non prenderlo come una sorpresa. Il rischio non è
tecnico — la build passa — ma di merito, su tre punti:

- **4.2 Minimum Functionality**: un'app che è un sito impacchettato viene respinta
  se non aggiunge nulla di nativo. Contromisure, in ordine di costo: notifiche
  push, condivisione di sistema, mappa nativa.
- **2.1 App Completeness**: i profili sul Radar sono generati e la verifica 18+ è
  simulata. Finché è così, per Apple l'app è incompleta.
- **5.1.1(v)**: serve la cancellazione dell'account dentro l'app, non solo il
  reset locale.

Il resto è già in regola: blocco, segnalazione e moderazione umana — che Apple
pretende per le app con contenuti degli utenti — ci sono, e la privacy policy è
scritta.

Se la revisione respinge, la risposta arriva in *Resolution Center*: si corregge
e si rimanda, senza pagare di nuovo.
