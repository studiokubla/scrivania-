# Mettere online la Dynasty League

L'applicazione è pubblicata su Vercel. Serve **una sola variabile d'ambiente**,
`DATABASE_URL`: tutto il resto — chiave di firma delle sessioni compresa — se
lo genera e se lo conserva da sé al primo avvio.

**Adesso non c'è nessun indirizzo attivo.** L'ultimo pubblicato —
`dynasty-league-r2gj1ivcn-kubla.vercel.app` — risponde `410 Gone`: era
l'indirizzo di un singolo deploy, e quei deploy non restano in piedi per sempre.
Per rimettere la lega online si rifà il passo 2 di questa guida.

Ed è la ragione per cui il passo che segue non è facoltativo: l'indirizzo di un
deploy cambia a ogni pubblicazione e prima o poi scade, quindi va bene per
provare, non per darlo a dieci presidenti. L'indirizzo stabile —
`dynasty-league-kubla.vercel.app` — va assegnato a mano dal pannello, *Project →
Domains → Add*, perché i deploy caricati come pacchetto, senza Git, non se lo
prendono da soli in modo affidabile. Fatto una volta resta valido per sempre: i
manager tengono lo stesso link e una ripubblicazione non lo tocca.

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

E vanno **inviate insieme al deploy**, non lasciate a quelle salvate nel
pannello. Se qualcuno tocca una di quelle voci — mettendo per esempio una Root
Directory che nel pacchetto non esiste — la build muore prima ancora di partire:
niente log utili, nessun diario, solo *Deployment has failed*. Dichiararle a ogni
pubblicazione rende il deploy indipendente da come è configurato il progetto in
quel momento.

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

Risponde con lega, stagione, i 531 giocatori del listone e **la password del
commissioner**.

La lega nasce **vuota**: nessuna squadra, nessun contratto, tutto il listone
svincolato. È così che parte una lega vera — le squadre le iscrivi tu dal
pannello, una per manager, e le rose si formano all'asta di settembre.

> La password si vede **una volta sola**: nel database resta solo la sua
> impronta. Salvala prima di chiudere il terminale.

Se invece vuoi solo guardare come funziona, aggiungi `"conSquadreDiProva": true`
al corpo della richiesta: ottieni dieci squadre finte con le rose già fatte. Non
usarlo sulla lega vera.

Da quel momento la rotta si chiude da sé: a lega esistente risponde `403`, e
rifarla da zero richiede la variabile `SETUP_TOKEN` più l'intestazione
`x-setup-token` e `{"reset": true}` esplicito.

Resta una finestra scoperta: fra il primo deploy e l'inizializzazione, chi
conosce l'indirizzo può creare la lega al posto tuo. È il prezzo di poter
pubblicare con una variabile sola. Per chiuderla, imposta `SETUP_TOKEN` **prima**
del deploy e passa l'intestazione nella chiamata.

### Controllare che sia tutto a posto

```bash
cd dynasty/web
BASE=https://<il-tuo-dominio> \
  COMMISSIONER='info@studiokubla.com:<password>' \
  MANAGER='manager1@dynasty.it:<password>' \
  npm run verifica:online
```

Ventuno controlli sull'ambiente vero: accesso col commissioner e con un
manager, password sbagliata respinta, pagine protette che rimbalzano al login,
un manager che non entra in amministrazione, dieci squadre con rose fatte di
giocatori del listone, e la rotta di inizializzazione chiusa. Non scrive
niente: si può rilanciare quando si vuole.

---

## 4 · Le prime cose da fare dentro l'app

1. **Iscrivi le squadre.** Gestione → *Squadre e manager*. Su una lega vuota c'è
   un solo pulsante che ne crea dieci in un colpo, chiamate «Squadra 1»…«Squadra
   10», e restituisce le dieci password insieme; si rinominano quando i
   presidenti scelgono i nomi veri. Altrimenti si aggiungono una alla volta, con
   nome, sigla, colore e indirizzo del manager. Ognuna nasce con la dotazione
   iniziale (art. 14), lo stadio a livello zero, il settore giovanile e le sue
   tre scelte al draft. **Le password si vedono una volta sola**: copiale e
   mandale. Se una si perde, il pulsante *Password* ne genera un'altra — la
   vecchia non è recuperabile da nessuno, commissioner compreso.
2. **Le età ci sono già.** Il listone porta l'età di 526 giocatori su 531:
   Rookie e Veteran si firmano dal primo giorno (art. 4.2) e il filtro
   *Primavera* del listone dice subito chi è idoneo (art. 16.1). I cinque senza
   restano marcati «da verificare» finché qualcuno non scrive l'età. L'import
   Transfermarkt resta utile — data di nascita esatta, valore, provenienza — ma
   non blocca più niente: il pannello dice quanti ne mancano e da lì si scarica
   il modello del foglio.
3. **L'asta si fa al tavolo.** L'applicazione non la conduce: la registra. Il
   commissioner apre il **Listone**, cerca il giocatore appena aggiudicato,
   sceglie la squadra e scrive la cifra; il listone si accorcia e le rose si
   riempiono sotto gli occhi di tutti. Se una cifra sfora il tetto o
   lascerebbe una squadra senza spazio per completare la rosa, l'applicazione
   la rifiuta mentre siete ancora seduti. Un errore di battitura si annulla
   dalla stessa pagina.
4. **Componi le rose.** Il giorno dopo l'asta si apre **Rosa** e si mette
   dentro quello che c'è sul foglio. Due strade, e si possono mescolare:
   cercare i giocatori uno a uno scrivendo costo e tipo di contratto, oppure
   caricare il foglio in Excel o CSV. Basta una colonna `giocatore`; se il
   foglio porta anche `costo` e `contratto` i giocatori entrano già firmati,
   altrimenti restano *da completare* e si sistemano con due tocchi. Un
   giocatore in attesa **è ancora svincolato**: chiunque potrebbe prenderlo,
   finché il prezzo non c'è.

   Ogni presidente compone la propria; il commissioner qualunque.

5. **Ad asta finita** il mercato passa dall'applicazione: offerte a busta chiusa
   sugli svincolati rimasti, waiver e scambi (artt. 9, 10 e 13).

Finché una squadra non ha contratti si può ritirare dalla lega; dopo l'asta no,
perché toglierla lascerebbe i suoi giocatori senza squadra e senza svincolo — e
quella è una decisione di lega, non un pulsante. Per rimettere tutto a zero c'è
*Ripartire da zero*, in fondo allo stesso pannello: chiede di riscrivere il nome
della lega, toglie squadre, manager, contratti e capitale, e lascia in piedi
stagione, listone, finestre, competizioni e il tuo accesso.

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
