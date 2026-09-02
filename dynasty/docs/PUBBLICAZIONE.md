# Mettere online la Dynasty League

Tre cose: un database, un posto dove gira l'app, e un colpo di inizializzazione.
Dieci minuti in tutto.

---

## 1 · Il database

L'app vuole un PostgreSQL. Qualunque fornitore va bene — quello che serve è una
stringa di connessione, che diventerà la variabile `DATABASE_URL`.

Le opzioni gratuite che reggono senza problemi una lega da dieci persone:

| Fornitore | Come |
| --- | --- |
| **Prisma Postgres** | `npx create-db` dà un database in dieci secondi. **Va rivendicato entro 24 ore** dal link che stampa, altrimenti viene cancellato. |
| **Neon** | `neon.tech` — piano gratuito, la stringa è nella dashboard alla voce *Connection string*. |
| **Supabase** | `supabase.com` — la stringa è in *Project Settings → Database*, usa quella in modalità *Session*. |

Lo schema si allinea da solo: il comando di build esegue `prisma db push` prima
di compilare, quindi al primo deploy le tabelle vengono create.

---

## 2 · Il deploy su Vercel

L'applicazione sta in `dynasty/web`, non nella radice del repository: è
l'unico dettaglio da non dimenticare.

1. Su Vercel, **Add New → Project**, e scegli questo repository.
2. **Root Directory**: `dynasty/web`.
3. Framework: Next.js (lo riconosce da solo).
4. Prima di premere *Deploy*, apri **Environment Variables** e aggiungi:

   | Nome | Valore |
   | --- | --- |
   | `DATABASE_URL` | la stringa del punto 1 |
   | `AUTH_SECRET` | una stringa casuale: `openssl rand -base64 32` |
   | `SETUP_TOKEN` | un'altra stringa casuale: `openssl rand -hex 24` |

5. Deploy.

`AUTH_SECRET` firma i cookie di sessione e le impronte delle offerte a busta
chiusa: se cambia, tutti vengono disconnessi. `SETUP_TOKEN` serve solo per il
passo 3 e **si toglie subito dopo**.

---

## 3 · L'inizializzazione

A deploy finito, controlla che l'app veda il database:

```
https://<il-tuo-dominio>/api/salute
```

Deve rispondere `{"database":"raggiungibile","lega":null,"inizializzata":false}`.
Se dice `non raggiungibile`, la `DATABASE_URL` è sbagliata.

Poi crea la lega:

```bash
curl -X POST https://<il-tuo-dominio>/api/setup \
  -H "x-setup-token: <SETUP_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"commissionerEmail":"info@studiokubla.com"}'
```

Risponde con lega, stagione, squadre, i 531 giocatori del listone, le rose
iniziali e **le credenziali di tutti gli undici accessi**.

> Le password si vedono **una volta sola**: nel database resta solo la loro
> impronta. Salvale prima di chiudere il terminale. Se le perdi, si rifà
> l'inizializzazione con `{"reset": true}` — che però cancella tutto, registro
> compreso.

Fatto questo, **togli la variabile `SETUP_TOKEN`** dalle impostazioni Vercel e
rilancia il deploy: senza quella variabile la rotta `/api/setup` risponde 404 e
la porta è chiusa.

---

## 4 · Le prime cose da fare dentro l'app

1. **Rinomina le squadre.** Sono dieci segnaposto, con dieci indirizzi
   `manager1@dynasty.it`…`manager10@dynasty.it`. I nomi veri e gli indirizzi
   veri si mettono a mano nel database, oppure si rifà l'inizializzazione una
   volta che li hai tutti.
2. **Importa le anagrafiche Transfermarkt** dal pannello di amministrazione. Il
   listone non porta le date di nascita, e senza quelle i contratti Rookie e
   Veteran non si possono firmare (art. 4.2). Il pannello ti dice quanti
   giocatori sotto contratto ne sono privi, e il modello del foglio da compilare
   si scarica da lì.
3. **Apri l'asta** quando siete tutti collegati: il commissioner estrae
   l'ordine di chiamata dalla Sala d'asta.

---

## Aggiornare l'app

Con il progetto collegato al repository, ogni push sul branch di produzione
fa un deploy nuovo. Lo schema si allinea da solo in fase di build; i dati
restano dove sono.

Per rifare la presentazione del regolamento dopo una modifica al testo:

```bash
cd dynasty/web && npm run presentazione
```

Per rigenerare il listone quando escono le quotazioni nuove: sostituisci il
foglio in `dynasty/dati/` e lancia `npm run listone:json`. Le quotazioni
aggiornate in corso di stagione, però, si caricano dal pannello di
amministrazione senza toccare il codice.
