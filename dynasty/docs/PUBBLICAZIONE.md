# Mettere online la Dynasty League

L'applicazione è pubblicata su Vercel. Serve **una sola variabile d'ambiente**,
`DATABASE_URL`: tutto il resto — chiave di firma delle sessioni compresa — se
lo genera e se lo conserva da sé al primo avvio.

Indirizzo attuale:
**https://dynasty-league-nk37v76ih-kubla.vercel.app**

---

## 1 · Il database

Serve un PostgreSQL. Qualunque fornitore va bene: quello che conta è la stringa
di connessione, che diventa `DATABASE_URL`.

| Fornitore | Come |
| --- | --- |
| **Prisma Postgres** | `npx create-db` dà un database in dieci secondi. **Va rivendicato entro 24 ore** dal link che stampa, altrimenti viene cancellato. |
| **Neon** | `neon.tech` — piano gratuito, la stringa è nella dashboard alla voce *Connection string*. |
| **Supabase** | `supabase.com` — la stringa è in *Project Settings → Database*, in modalità *Session*. |

Lo schema si allinea da solo: il comando di build esegue `prisma db push` prima
di compilare, quindi al primo deploy le tabelle vengono create. Se la variabile
non c'è, la build **non fallisce**: salta l'allineamento, lo scrive nel log, e
`/api/salute` risponde `503` spiegando cosa manca.

---

## 2 · Il deploy

Il progetto **non è collegato a Git**, e non per pigrizia: l'applicazione sta in
`dynasty/web`, cioè in una sottocartella, e un progetto collegato la compila solo
se qualcuno imposta a mano la «Root Directory». Lasciato vuoto quel campo, Vercel
compila la radice del repository, non trova nessun `package.json` e fallisce con
*No Next.js version detected*.

Si pubblica invece il pacchetto in [`dynasty/deploy/`](../deploy/README.md), che
durante la build va a prendersi il codice dal repository pubblico al commit
indicato. Per aggiornare la versione online: cambia `COMMIT` in
`dynasty/deploy/bootstrap.mjs` e ripubblica quei due file.

### Le impostazioni del progetto

| Voce | Valore |
| --- | --- |
| Framework | Next.js |
| Build Command | `node bootstrap.mjs` |
| Root Directory | *(vuoto)* |
| Deployment Protection → Vercel Authentication | **Disabled** |

L'ultima riga non è un dettaglio: con la protezione attiva su *All Deployments*
anche l'indirizzo di produzione rimbalza sul login Vercel, e i manager della lega
non entrerebbero.

### Le variabili d'ambiente

| Nome | Obbligatoria | A cosa serve |
| --- | --- | --- |
| `DATABASE_URL` | **sì** | la stringa del punto 1 |
| `AUTH_SECRET` | no | firma i cookie di sessione e le impronte delle offerte a busta chiusa. Se manca, viene generata al primo accesso e conservata nel database. Impostarla a mano serve solo se si vuole poterla ruotare. |
| `SETUP_TOKEN` | no | chiude la rotta di inizializzazione anche prima che la lega esista. Vedi sotto. |

---

## 3 · L'inizializzazione

A deploy finito, controlla che l'app veda il database:

```
https://<il-tuo-dominio>/api/salute
```

Deve rispondere `{"database":"raggiungibile","lega":null,"inizializzata":false}`.
Se dice `non raggiungibile`, la `DATABASE_URL` è sbagliata o non è stata salvata.

Poi crea la lega:

```bash
curl -X POST https://<il-tuo-dominio>/api/setup \
  -H "content-type: application/json" \
  -d '{"commissionerEmail":"info@studiokubla.com"}'
```

Risponde con lega, stagione, dieci squadre, i 531 giocatori del listone, le rose
iniziali e **le credenziali di tutti gli undici accessi**.

> Le password si vedono **una volta sola**: nel database resta solo la loro
> impronta. Salvale prima di chiudere il terminale.

Da quel momento la rotta si chiude da sé: a lega esistente risponde `403`, e
rifarla da zero richiede la variabile `SETUP_TOKEN` più l'intestazione
`x-setup-token` e `{"reset": true}` esplicito.

Resta una finestra scoperta: fra il primo deploy e l'inizializzazione, chi
conosce l'indirizzo può creare la lega al posto tuo. È il prezzo di poter
pubblicare con una variabile sola. Per chiuderla, imposta `SETUP_TOKEN` **prima**
del deploy e passa l'intestazione nella chiamata.

---

## 4 · Le prime cose da fare dentro l'app

1. **Rinomina le squadre.** Sono dieci segnaposto, con dieci indirizzi
   `manager1@dynasty.it`…`manager10@dynasty.it`. I nomi e gli indirizzi veri si
   mettono dal pannello di amministrazione, oppure si rifà l'inizializzazione
   una volta che li hai tutti.
2. **Importa le anagrafiche Transfermarkt.** Il listone non porta le date di
   nascita, e senza quelle i contratti Rookie e Veteran non si possono firmare
   (art. 4.2). Il pannello dice quanti giocatori sotto contratto ne sono privi,
   e da lì si scarica il modello del foglio da compilare.
3. **Apri l'asta** quando siete tutti collegati: il commissioner estrae l'ordine
   di chiamata dalla Sala d'asta.

---

## Aggiornare

Per pubblicare una versione nuova dell'applicazione: cambia `COMMIT` in
`dynasty/deploy/bootstrap.mjs` e ripubblica il pacchetto. I dati restano dove
sono, lo schema si riallinea in fase di build.

Per rifare la presentazione del regolamento dopo una modifica al testo:

```bash
cd dynasty/web && npm run presentazione
```

Per rigenerare il listone quando escono le quotazioni nuove: sostituisci il
foglio in `dynasty/dati/` e lancia `npm run listone:json`. Le quotazioni
aggiornate in corso di stagione, però, si caricano dal pannello di
amministrazione senza toccare il codice.
