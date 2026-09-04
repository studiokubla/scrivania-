# Mettere online la lega

L'obiettivo è uno solo: **un allenatore apre un link e gioca**, senza registrarsi
da nessuna parte, senza account, senza installare niente.

Servono due cose, tutte e due gratuite:

| Cosa | A che serve | Costo |
| --- | --- | --- |
| **GitHub Pages** | tiene la pagina, all'indirizzo che manderai ai dieci | gratis, e non scade |
| **Firebase** | tiene i dati della lega, condivisi fra tutti | gratis fino a molto oltre quello che una lega da dieci consuma |

Perché non un server nostro: uno andrebbe pagato, aggiornato e sorvegliato, e
quando smette di rispondere la lega resta senza gestionale nel mezzo della
stagione. Una pagina su GitHub Pages non ha un deploy che possa fallire — c'è
finché c'è il repository.

---

## 1 · Il progetto Firebase — dieci minuti

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) e
   fai **Crea un progetto**. Il nome è tuo (per esempio `dynasty-league`).
   Google Analytics **non serve**: si può saltare.
2. Nel menu a sinistra, **Crea** → **Firestore Database** → *Crea database*.
   Scegli la regione europea (`eur3` o `europe-west`) e la **modalità di
   produzione**: le regole le mettiamo noi al punto 4.
3. Sempre a sinistra, **Crea** → **Authentication** → *Inizia* → nella scheda
   *Metodo di accesso* abilita **Anonimo**.

   Non chiede niente a nessuno: serve solo perché il database possa distinguere
   «arriva dalla pagina della lega» da «arriva da chissà dove». Chi sei nella
   lega lo decide il codice della tua squadra, che è un'altra cosa.

4. **Firestore Database** → scheda **Regole**, incolla questo e pubblica:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{documento=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

   Vuol dire: legge e scrive solo chi passa dalla pagina. Non è una cassaforte —
   dieci amici con lo stesso link possono scrivere tutti — ma tiene fuori il
   resto di internet.

5. **Impostazioni progetto** (l'ingranaggio in alto a sinistra) → in fondo,
   **Le tue app** → l'icona `</>` (web) → dai un nome qualsiasi → **Registra
   app**. Compare un blocco `firebaseConfig` con sei righe: copialo.

6. Incolla quei sei valori in [`firebase-config.js`](firebase-config.js), al
   posto dei segnaposto. **Non sono un segreto**: Firebase li pubblica apposta
   dentro le pagine web, e ciò che protegge il database sono le regole del
   punto 4, non queste stringhe.

---

## 2 · L'indirizzo — due minuti

Su GitHub, nel repository: **Settings** → **Pages** → sotto *Build and
deployment*, in *Source* scegli **Deploy from a branch**, poi il ramo `main` e
la cartella `/ (root)`. Salva.

Dopo un paio di minuti la lega è a:

```
https://studiokubla.github.io/scrivania-/lega/
```

È quello il link da mandare ai dieci. Non cambia mai più.

---

## 3 · Il primo avvio

Apri il link tu per primo: la pagina chiede di **fondare la lega** — nome e il
tuo codice da commissioner. Poi *Gestione* → incolli l'elenco delle dieci
squadre, una riga per ciascuna: `Nome squadra, Presidente`.

Da quel momento mandi il link a tutti. **Ognuno tocca la propria squadra ed è
dentro**: nessun codice, nessuna registrazione.

Se preferisci un codice per ciascuno — per evitare che qualcuno entri per sbaglio
nella squadra di un altro — si accende da *Gestione* → *Come si entra*. In
nessuno dei due casi il codice difende dei segreti: chi ha il link legge tutta la
lega comunque. Serve solo a non sbagliare porta.

---

## Se cambia qualcosa

L'applicazione è scritta una volta sola, in `app.html`. Le tre pagine — il sito,
la demo, la copia su claude.ai — si ricompongono con:

```bash
cd lega && node componi.mjs
```

Poi basta un commit: GitHub Pages pubblica da sé, non c'è nessun deploy da
lanciare. I dati della lega restano dove sono, perché stanno su Firebase e non
dentro la pagina.
