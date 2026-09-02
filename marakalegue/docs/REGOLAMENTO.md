# Marakalegue — Regolamento

**Versione 3.0 — snello e manageriale**
Consolida `Regolamento 25/26`, `Nuovo Regolamento Marakalegue` e `Tipologia di contratti`.

Ogni articolo di questo regolamento è pensato per essere **calcolabile dal software**: se una
regola non è verificabile automaticamente dai dati che la lega possiede (voti, presenze, età,
quotazioni, importi, date), non entra nel regolamento. È il criterio che ha guidato tutte le
scelte qui sotto e la ragione per cui alcune regole delle versioni precedenti sono cambiate.

Le modifiche rispetto ai documenti precedenti sono marcate con **▸ Cambia** e motivate.

---

## Titolo I — Struttura

### Art. 1 — La lega

1. La Marakalegue è composta da **10 squadre**, ciascuna affidata a un **manager**.
2. La lega è amministrata da un **commissioner**, che non partecipa alle competizioni.
   Il commissioner apre e chiude le sessioni, convalida le operazioni contestate, importa i dati
   ufficiali e applica le sanzioni. Non possiede una squadra e non può fare offerte.
3. La stagione della lega coincide con la stagione di Serie A e si divide in:
   - **Precampionato** — asta, draft primavera, scelte societarie;
   - **Stagione regolare** — dalla 1ª alla 38ª giornata, con tre finestre di mercato;
   - **Fine stagione** — opzioni, rinnovi, scadenze, bilancio.

▸ **Cambia.** Il ruolo di commissioner sostituisce il "responsabile di lega" dell'art. 7 del
regolamento Marakalegue. Nella vecchia formulazione il responsabile riceveva le buste chiuse
*e poteva partecipare all'asta*, con la clausola di ripiego «se anch'esso fosse interessato al
giocatore, andrà comunicato a Matteo Smerilli». Con un commissioner non giocante e le buste
sigillate dal software, il conflitto d'interesse sparisce alla radice.

### Art. 2 — Le due economie

La lega ha due economie separate che **non comunicano**, salvo il passaggio unidirezionale
previsto dall'art. 12.

| | **Salary Cap** | **Capitale** |
|---|---|---|
| A cosa serve | pagare gli ingaggi dei giocatori | far crescere la società |
| Dotazione | 85 M per stagione, uguale per tutti | accumulato negli anni, diverso per ognuno |
| Si alimenta con | nulla: è un tetto, non un portafoglio | premi, stadio, sponsor |
| Si spende in | ingaggi | stadio, primavera, osservatori, penali di svincolo |
| Avanza a fine anno | no, si azzera | sì, si accumula |

1. Il Salary Cap **non è denaro**: è lo spazio massimo che la somma degli ingaggi può occupare.
   Non si trasferisce, non si presta, non si accumula.
2. Il Capitale **è denaro**: si accumula, si investe, si può cedere in un trade.
3. Nessuna operazione può convertire Capitale in spazio salariale.

▸ **Cambia.** È la risposta diretta all'art. 1 delle premesse («le maggiori criticità derivavano
dalla gestione dei milioni ottenuti dalle cessioni, dagli scambi poco chiari e dalle plusvalenze
non sempre regolari»). Con due economie che non si toccano, la plusvalenza fantasma non esiste:
non si vendono giocatori per fare cassa salariale, si liberano ingaggi.

---

## Titolo II — La rosa

### Art. 3 — Composizione

1. Rosa da **25 a 30 giocatori**, di cui **almeno 3 portieri** e almeno 8 difensori,
   8 centrocampisti e 6 attaccanti secondo la classificazione ufficiale di Leghe Fantacalcio.
2. Tetto salariale: **85 M**. La somma degli ingaggi della stagione in corso non può superarlo
   in nessun momento.
3. Massimo **9 contratti pluriennali** contemporaneamente attivi.
4. Il software rifiuta ogni operazione che violi uno di questi limiti, in asta come nel mercato.

### Art. 4 — Tipi di contratto

I contratti sono **tre**, più uno di emergenza. Il tipo è determinato dall'anagrafica del
giocatore al momento della firma e non cambia più.

| Tipo | Requisito | Durata | Ingaggio | Evoluzione annuale | Slot pluriennale |
|---|---|---|---|---|---|
| **Annuale** | nessuno | 1 anno | libero | — | no |
| **Standard** | nessuno | 2-3 anni | libero | **+10%** l'anno | sì |
| **Rookie** | Under 23 alla firma | 2-4 anni | max **6 M** | invariato | sì |
| **Veteran** | Over 30 alla firma | 2 anni | max **10 M** | **−20%** l'anno | sì |
| **Tampone** | nessuno | 4 giornate | max **1 M** | — | no |

1. Ogni acquisto all'asta è per default un **Annuale**. Il manager può convertirlo in
   pluriennale al momento dell'aggiudicazione, se ha slot liberi e se il giocatore ne ha i requisiti.
2. L'età si calcola al **1° settembre** della stagione di firma.
3. Tutti gli importi sono multipli di **0,25 M**. Gli escalator si arrotondano al multiplo di
   0,25 M più vicino, per eccesso.
4. Il **Tampone** serve a coprire un infortunio: lega un giocatore per 4 giornate, non occupa
   slot pluriennale, massimo **3 per stagione**. Alla scadenza il manager può trasformarlo in
   Annuale allo stesso ingaggio, altrimenti il giocatore torna svincolato.

▸ **Cambia, e parecchio.** I documenti precedenti descrivevano cinque tipi con numeri in
contraddizione tra loro: il Max Contract era «1-3 anni» in un file e «2-5 anni» nell'altro, con un
esempio (10 → 22 → 24 M) che non tornava con la regola dichiarata «+2 M l'anno»; il Rookie aveva
tre tetti diversi (3 M nel titolo, 8 M nel testo, 6 M in Marakalegue); il Veteran «scendeva di 1 M
l'anno» nel testo e «del 10% l'anno, massimo 30%» nella tabella subito sotto.

Il **Max Contract sparisce come tipo**: un contratto sopra i 10 M è semplicemente uno Standard
grosso, e non serve una categoria a parte per dirlo. Al suo posto arriva il **Franchise Tag**
(art. 6), che è lo strumento che serviva davvero: un modo per non perdere il proprio miglior
giocatore. Il **Veteran scende del 20%**, non del 10%: a −10% su due anni il risparmio è
irrilevante e nessuno lo userebbe.

### Art. 5 — Firma e rinnovo

1. Un contratto pluriennale si firma **solo** all'asta di settembre o durante una finestra di
   mercato, mai a mercato chiuso.
2. Alla scadenza naturale il giocatore diventa **free agent** e rientra nell'asta successiva,
   salvo Team Option (art. 6) o Franchise Tag (art. 6).
3. Un contratto in corso non si rinegozia. Lo si estende con la Team Option, lo si chiude con un
   buy-out, oppure lo si cede in un trade.

▸ **Cambia.** Il vecchio art. 7 concedeva alla squadra che riceveva un giocatore in trade di
«ristrutturare il contratto». Era la porta d'ingresso agli scambi poco chiari: due manager
d'accordo potevano azzerare un ingaggio scomodo. Ora **il contratto viaggia con il giocatore,
intatto**. Se pesa troppo, è un problema da valutare *prima* di accettare lo scambio — che è
esattamente la decisione manageriale che rende interessante il trade.

---

## Titolo III — Gli strumenti del manager

### Art. 6 — Opzioni

Ogni squadra dispone ogni stagione dei seguenti strumenti. I contatori si azzerano al 1° luglio.

| Strumento | Quante volte | Quando | Effetto |
|---|---|---|---|
| **Team Option** | 3 per stagione | fine stagione | estende un contratto di 1 anno a **+20%** |
| **Franchise Tag** | 1 per stagione | fine stagione | blinda 1 giocatore in scadenza per 1 anno |
| **Performance buy-out** | 3 per stagione | finestre di mercato | svincolo a costo dimezzato (art. 12) |
| **Diritto di pareggio** | illimitato | pre-contract | pareggia l'offerta ricevuta e trattiene il giocatore |

#### 6.1 — Team Option

Estende di un anno un contratto pluriennale in scadenza, all'ingaggio dell'ultimo anno **+20%**.
Applicabile più volte allo stesso giocatore, in anni diversi. L'anno di estensione occupa uno
slot pluriennale. Va dichiarata entro **7 giorni** dalla fine della stagione regolare.

#### 6.2 — Franchise Tag

Blinda un giocatore **in scadenza** per una stagione ulteriore. L'ingaggio diventa il maggiore tra:

- **120%** dell'ingaggio dell'ultimo anno;
- la **media dei 3 ingaggi più alti del suo ruolo** in tutta la lega.

Il giocatore taggato non può ricevere pre-contract e non può essere scambiato per tutta la
stagione. Un manager può taggare **un solo giocatore all'anno** e **non può taggare lo stesso
giocatore due anni di fila**.

▸ **Cambia.** Sostituisce l'opzione "Giocatore protetto" (5 all'anno), che era gratuita e quindi
senza costo strategico: proteggere cinque giocatori non è una scelta, è una formalità. Il tag ne
protegge **uno solo** e lo paga a prezzo di mercato. È lo strumento più manageriale del
regolamento: ti costringe a decidere chi è davvero incedibile, e a pagarlo.

---

## Titolo IV — Il mercato

### Art. 7 — Le finestre

| Sessione | Quando | Cosa si può fare |
|---|---|---|
| **Asta di settembre** | dopo la chiusura del mercato reale | asta a chiamata, draft primavera |
| **Finestra di novembre** | dopo la 12ª giornata | free agency, trade, buy-out |
| **Finestra di gennaio** | dopo la 20ª giornata | free agency, trade, buy-out |
| **Finestra di marzo** | dopo la 28ª giornata | free agency, trade, buy-out, pre-contract |
| **Waiver** | sempre attivo | reclamo sui giocatori appena svincolati |

La **trade deadline** è la fine della finestra di marzo. Dopo, la rosa è congelata fino a fine
stagione, salvo waiver per sostituire un infortunato di lungo corso.

### Art. 8 — Asta di settembre

1. Il software estrae l'ordine di chiamata.
2. A turno ogni manager chiama un giocatore. **Nessuno può passare** finché non ha 25 giocatori;
   una volta raggiunti i 25, può dichiarare chiusa la propria asta, e la decisione è definitiva.
3. Su ogni chiamata tutti i manager inseriscono nel software un'offerta segreta entro **20
   secondi**. Chi non è interessato inserisce 0. Le offerte si aprono tutte insieme.
4. Rilancio minimo **0,25 M**. Base d'asta secondo la quotazione Leghe Fantacalcio:

   | Quotazione LFC | Base d'asta |
   |---|---|
   | fino a 14 | 0,5 M |
   | 15-19 | 3 M |
   | 20-29 | 4 M |
   | 30 e oltre | 5 M |

5. A parità di offerta più alta, i manager in parità ripetono l'offerta segreta. Se la parità
   persiste, il giocatore va a chi ha chiamato per primo nell'ordine estratto.
6. Il software rifiuta un'offerta che lascerebbe il manager senza spazio salariale sufficiente a
   completare la rosa minima di 25 giocatori a 0,5 M ciascuno.

▸ **Cambia.** Le lavagnette diventano schermi. Il punto 6 è nuovo e risolve il problema classico
dell'asta a busta chiusa: chi spende tutto sui primi nomi e poi non può completare la rosa. Ora è
il software a impedirlo, in tempo reale, senza discussioni.

### Art. 9 — Free agency

1. Durante una finestra ogni manager può presentare fino a **5 offerte** per stagione ai
   giocatori svincolati.
2. L'offerta è **segreta** e specifica ingaggio, durata e tipo di contratto. Il software la
   sigilla e apre alle altre squadre una finestra di **24 ore** per rilanciare, anch'esse in segreto.
3. Allo scadere delle 24 ore tutte le offerte si aprono insieme. Vince l'offerta più alta.
4. A parità di ingaggio vince, nell'ordine: la durata maggiore, poi la **squadra peggio
   posizionata** in classifica.

▸ **Cambia.** Il criterio di parità si rovescia: prima vinceva la squadra messa meglio, ora vince
quella messa peggio. È il principio di *waiver priority* delle leghe americane e serve a
contenere il divario: chi va male ha almeno il vantaggio della precedenza. Sposta il regolamento
verso la competizione equilibrata che l'art. 2 dei documenti originali dichiarava di voler
ottenere («diminuire la componente fortuna», «premiare la pianificazione»).

### Art. 10 — Waiver

1. Un giocatore svincolato durante la stagione **non diventa subito free agent**: resta 48 ore in
   waiver.
2. In quelle 48 ore chiunque può reclamarlo assumendone il contratto residuo. Se più squadre lo
   reclamano, lo ottiene la **peggio posizionata** in classifica.
3. Scadute le 48 ore senza reclami, il giocatore diventa free agent e rientra nella free agency
   ordinaria.

▸ **Nuovo.** Non esisteva. Impedisce la corsa al click sul giocatore appena tagliato e dà alle
squadre in difficoltà una possibilità reale di rinforzarsi.

### Art. 11 — Trade e pre-contract

#### 11.1 — Trade

1. Si scambiano **giocatori con il loro contratto**, **scelte al draft primavera** (fino a due
   stagioni future) e **Capitale**. Mai spazio salariale.
2. Il software valida **entrambi i lati** dello scambio: tetto salariale, numero di giocatori,
   requisiti di ruolo, slot pluriennali. Se un lato non torna, lo scambio non si può proporre.
3. Uno scambio proposto va accettato dalla controparte entro 48 ore. Il commissioner può
   annullarlo entro le 24 ore successive solo se manifestamente collusivo, motivando pubblicamente.

#### 11.2 — Pre-contract

1. Nella sola finestra di marzo un manager può offrire pubblicamente un contratto a un giocatore
   **in scadenza** di un'altra squadra, a un ingaggio superiore a quello attuale.
2. Il proprietario ha **48 ore** per esercitare il **diritto di pareggio**: se pareggia, trattiene
   il giocatore al nuovo ingaggio. Se non pareggia, il giocatore passa alla squadra offerente a
   fine stagione.
3. Un giocatore con Franchise Tag non può ricevere pre-contract.
4. Massimo **3 pre-contract** per stagione a squadra.

### Art. 12 — Svincolo e buy-out

1. Il manager può svincolare un giocatore in qualsiasi finestra di mercato pagando una penale
   **dal Capitale**.
2. La penale è la somma degli **ingaggi residui** del contratto, maggiorata secondo gli anni che
   restano:

   | Anni residui | Penale |
   |---|---|
   | 1 | 100% dell'ingaggio residuo |
   | 2 | 110% |
   | 3 | 120% |
   | 4 | 130% |

3. Lo **spazio salariale si libera immediatamente**, tranne un **dead cap pari al 25%**
   dell'ingaggio corrente, che resta a carico della squadra fino a fine stagione.
4. **Performance buy-out**: la penale è **dimezzata** e il dead cap non si applica se il giocatore
   soddisfa almeno una di queste condizioni, tutte verificate automaticamente dal software sui
   dati ufficiali Leghe Fantacalcio:
   - ha giocato **meno del 50%** delle giornate disputate;
   - ha una **media voto sotto 6** su almeno 10 presenze;
   - non ha ricevuto voto per **5 giornate consecutive** per infortunio.

   Massimo 3 performance buy-out per stagione.

▸ **Cambia, ed è la modifica più importante.** L'art. 8 del regolamento 25/26 diceva che il
giocatore svincolato «occuperà lo stesso il tetto salariale», senza dire per quanto: fino a fine
contratto? per sempre? Era la regola più ambigua di tutto l'impianto e rendeva lo svincolo una
decisione che nessuno prendeva mai.

Ora il meccanismo è quello americano ed è netto: **paghi in contanti, liberi il campo, ti resta
una cicatrice**. Il dead cap del 25% è la punizione per l'errore di valutazione — abbastanza per
farti pensare, non tanto da paralizzarti. E siccome la penale esce dal Capitale, svincolare un
giocatore significa rinunciare a un pezzo di stadio: la scelta ha un costo che si vede.

### Art. 13 — Giocatori che lasciano la Serie A

1. Se un giocatore lascia la Serie A a titolo definitivo, il contratto si estingue: lo spazio
   salariale si libera **per intero e senza dead cap**, e lo slot pluriennale torna disponibile.
2. Se lo lascia in prestito, il manager sceglie entro 7 giorni: trattenerlo pagando il **50%**
   dell'ingaggio e conservando il contratto, oppure trattarlo come uscita definitiva.

---

## Titolo V — La società

### Art. 14 — Capitale

Il Capitale è il conto societario. Si alimenta con premi delle competizioni (art. 19), incassi
dello stadio (art. 15) e sponsor (art. 18). Si spende in stadio, primavera, osservatori e penali
di svincolo. Ogni movimento è registrato e pubblico.

Ogni squadra parte con **40 M** alla prima stagione.

### Art. 15 — Stadio

1. Lo stadio si costruisce **all'inizio della stagione**, entra in funzione **dalla 20ª giornata**
   (si simulano sei mesi di cantiere) e da lì genera incassi a ogni gara casalinga.
2. I livelli sono 5. Si sale **un livello alla volta** pagando la differenza tra i due costi di
   costruzione; per saltare un livello bisogna demolire e ricostruire da zero.
3. La manutenzione si addebita al Capitale all'inizio di ogni stagione. Un Capitale insufficiente
   a pagare la manutenzione fa **retrocedere lo stadio di un livello**.

| Livello | Costruzione | Manutenzione/anno | Incasso per gara in casa | Incasso stagione (19 gare) | Netto/anno | Fantapunti per gara in casa |
|---|---|---|---|---|---|---|
| 1 — Comunale | 30 M | 3 M | 0,50 M | 9,5 M | **+6,5 M** | +0,5 |
| 2 — Rinnovato | 60 M | 6 M | 0,90 M | 17,1 M | **+11,1 M** | +1,0 |
| 3 — Moderno | 100 M | 10 M | 1,40 M | 26,6 M | **+16,6 M** | +1,5 |
| 4 — Grande impianto | 150 M | 15 M | 2,00 M | 38,0 M | **+23,0 M** | +2,0 |
| 5 — Cattedrale | 210 M | 21 M | 2,70 M | 51,3 M | **+30,3 M** | +2,5 |

Rientro dell'investimento: circa 4,6 stagioni al livello 1, circa 6,9 al livello 5.

▸ **Cambia, perché i numeri non stavano in piedi.** Nella tabella originale un impianto di
livello 1 costava 50 M, ne chiedeva 15 all'anno di manutenzione e ne rendeva 0,25. Anche
interpretando l'incasso come per-partita, faceva 9,5 M l'anno contro 15 di manutenzione: **ogni
stadio era in perdita permanente, a ogni livello**. Nel nuovo regolamento Marakalegue il problema
era ancora più grosso, perché vincere il campionato pagava 5 M e uno stadio ne costava 50: sarebbe
servito un decennio di trionfi per posare le fondamenta.

Qui la manutenzione è il **10% del costo di costruzione**, l'incasso è per gara casalinga e il
saldo è positivo a ogni livello. Lo stadio torna a essere quello che deve essere: un investimento
lento che premia chi pianifica, non una tassa.

### Art. 16 — Settore giovanile

1. Ogni squadra può tesserare giocatori **Under 21** che nella stagione precedente abbiano
   totalizzato **non più di 5 presenze con voto** e abbiano una quotazione LFC **non superiore a 7 M**.
2. La capienza base è di **3 giovani**, ampliabile con investimento dal Capitale:

   | Giovani in rosa | Investimento | Mantenimento/anno |
   |---|---|---|
   | 0-3 | — | — |
   | 4-5 | 5 M | 1,0 M |
   | 6-7 | 7 M | 1,5 M |
   | 8-9 | 9 M | 2,0 M |
   | 10-11 | 10 M | 2,5 M |

3. I giovani **non percepiscono ingaggio** e non occupano spazio salariale.
4. La promozione in prima squadra è a discrezione del manager, sempre; il giocatore inizia allora
   a percepire un ingaggio determinato dal turno in cui fu scelto al draft:

   | Turno di chiamata | Ingaggio alla promozione |
   |---|---|
   | 1-3 | 0,75 M |
   | 4-6 | 0,50 M |
   | 7 e oltre | 0,25 M |

5. Al compimento dei 21 anni la promozione è **obbligatoria**: se manca spazio salariale o
   posto in rosa, il giocatore è svincolato senza penale.
6. Nessun manager può offrire contratti al giovane di un'altra squadra finché resta nel settore
   giovanile.

### Art. 17 — Draft e osservatori

#### 17.1 — Draft

Subito dopo l'asta di settembre. L'ordine di chiamata esce da una **lotteria pesata** che
favorisce le squadre peggio classificate: l'ultima ha la probabilità più alta di ottenere la prima
scelta, ma non la certezza. Le probabilità sono pubblicate prima dell'estrazione e l'estrazione è
registrata. Le scelte future sono scambiabili fino a due stagioni in avanti.

Pesi di lotteria per la prima scelta (10ª = ultima in classifica):

| Posizione | 10ª | 9ª | 8ª | 7ª | 6ª | 5ª | 4ª | 3ª | 2ª | 1ª |
|---|---|---|---|---|---|---|---|---|---|---|
| Peso | 20% | 17% | 15% | 12% | 10% | 8% | 7% | 5% | 4% | 2% |

#### 17.2 — Rete osservatori

1. Un manager può inviare osservatori nei campionati esteri per ottenere un **diritto di
   pareggio** sui giocatori che da lì arrivano in Serie A.
2. L'investimento è a due passi: prima il **campionato**, poi — in una sessione successiva — un
   **club specifico** di quel campionato. Il club costa quanto il campionato e **annulla**
   l'osservatore generale, a meno di pagarne un secondo.
3. Durata dell'osservazione: **una stagione**. Si rinnova pagando di nuovo.
4. Il diritto di pareggio consente di **eguagliare l'offerta più alta** ricevuta dal giocatore in
   asta o in free agency e portarselo a casa. Non è un acquisto esclusivo né uno sconto.
5. Gerarchia: chi ha scoutizzato il **club** batte chi ha scoutizzato il campionato. A parità di
   livello vince **chi ha investito prima**, secondo il registro datato del software. Se gli
   investimenti sono nella stessa sessione, si procede con **asta ristretta** tra i soli aventi
   diritto.

| Campionato | Costo per campionato | Costo per club |
|---|---|---|
| Premier League | 10 M | 10 M |
| La Liga | 9 M | 9 M |
| Bundesliga | 9 M | 9 M |
| Ligue 1 | 8 M | 8 M |
| Eredivisie | 8 M | 8 M |
| Primeira Liga | 8 M | 8 M |
| Serie B | 7 M | 7 M |
| Brasileirão | 6 M | 6 M |
| Primera División | 6 M | 6 M |
| Altri | 6 M | 6 M |

▸ **Chiarito.** Il diritto di prelazione diventa esplicitamente un **diritto di pareggio**: le due
versioni precedenti dicevano cose diverse (acquisto prima dell'asta in un caso, pareggio
dell'offerta più alta nell'altro). Il pareggio è la formula giusta: premia lo scouting senza
regalare il giocatore. E «chi ha investito prima» ha senso solo con un registro con l'orario —
che ora c'è.

### Art. 18 — Sponsor

1. All'inizio di ogni stagione il software propone a ogni squadra **3 contratti di sponsorizzazione**,
   calibrati sul piazzamento della stagione precedente. Ogni squadra ne firma **al massimo 2**.
2. Ogni sponsor ha durata **1-3 anni**, un compenso annuo versato al Capitale e un **obiettivo
   sportivo**. Se l'obiettivo non viene raggiunto, a fine stagione si paga una **penale** pari al
   50% del compenso annuo.
3. Un contratto sponsor non si rescinde.

Fascia di compenso indicativa per piazzamento dell'anno precedente:

| Piazzamento | Compenso annuo | Obiettivo tipico |
|---|---|---|
| 1°-3° | 18-25 M | primi 4 |
| 4°-7° | 12-18 M | primi 6 |
| 8°-10° | 8-12 M | non ultimo |

▸ **Formalizzato.** Gli sponsor esistevano nel foglio `AS Sorata 24/25` (Nike, Amazon, McDonald's,
pluriennali con penale) e l'art. 10 diceva che il Capitale si alimenta «dagli introiti degli
sponsor», ma nessun regolamento li disciplinava. Qui diventano una fonte di Capitale legata ai
risultati: chi va bene guadagna di più, ma firma obiettivi più difficili.

---

## Titolo VI — Le competizioni

### Art. 19 — Calendario e premi

| Competizione | Formato | Quando |
|---|---|---|
| **Marakalegue Apertura** | girone unico, 18 giornate | 3ª → 20ª di Serie A |
| **Marakalegue Clausura** | girone unico, 18 giornate | 21ª → 38ª di Serie A |
| **Marabao Cup** | 2 gironi, poi andata e ritorno | tutta la stagione |
| **Super Cup** | 8 squadre: prime 4 di Apertura e di Clausura | fine stagione |
| **Marakà Youth** | media voto dei primavera + bonus rosa | tutta la stagione |

**Apertura e Clausura** (identici):

| Pos. | Premio | Pos. | Premio |
|---|---|---|---|
| 1° | 27 M | 6° | 17 M |
| 2° | 25 M | 7° | 15 M |
| 3° | 23 M | 8° | 13 M |
| 4° | 21 M | 9° | 12 M |
| 5° | 19 M | 10° | 10 M |

**Marabao Cup**: quarti 5 M · semifinali 7 M · finale 10 M · vittoria 15 M
**Super Cup**: semifinali 3 M · finale 5 M · vittoria 7 M
**Marakà Youth**: 1° 5 M · 2° 3 M · 3° 1 M

Bonus progressivo Marakà Youth secondo l'ampiezza del settore giovanile: 4-5 giovani +0,2 ·
6-7 +0,4 · 8-9 +0,6 · 10-11 +0,8. Con 3 o meno giovani non ci si iscrive.

### Art. 20 — Premi in denaro

Quota d'iscrizione **75 € a squadra**.

| Competizione | 1° | 2° | 3° |
|---|---|---|---|
| Marakalegue Apertura | 130 € | 100 € | 70 € |
| Marakalegue Clausura | 130 € | 100 € | 70 € |
| Marabao Cup | 75 € | 50 € | — |
| Super Cup | 25 € | — | — |
| Marakà Youth | 30 € | 15 € | — |

---

## Titolo VII — Dati e trasparenza

### Art. 21 — Fonti ufficiali

1. **Leghe Fantacalcio** è la fonte ufficiale per formazioni, voti, presenze, quotazioni e
   classificazione dei ruoli. In caso di discrepanza, fa fede il dato Leghe Fantacalcio.
2. **Transfermarkt** è la fonte di riferimento per data di nascita, nazionalità, club e campionato
   di provenienza, e valore di mercato. Il valore di mercato **non ha effetti regolamentari**:
   serve solo come riferimento nelle valutazioni dei manager.
3. Il commissioner importa i dati dopo ogni giornata. Le regole che dipendono dalle prestazioni
   (art. 12.4) si calcolano solo su dati importati.

### Art. 22 — Registro pubblico

Ogni operazione — firma, rinnovo, opzione, svincolo, trade, reclamo waiver, investimento, premio,
movimento di Capitale — è scritta in un registro **pubblico, cronologico e immutabile**,
consultabile da tutti i manager in ogni momento. Nessuna operazione esiste se non è a registro.

### Art. 23 — Contestazioni

Una contestazione va presentata entro **48 ore** dall'operazione. Decide il commissioner, con
motivazione scritta a registro. Contro la decisione è ammesso il voto dei manager: serve la
maggioranza di **7 su 10** per ribaltarla.

### Art. 24 — Modifiche al regolamento

Le modifiche si votano a fine stagione, entrano in vigore dalla stagione successiva e richiedono
la maggioranza di **6 su 10**. Le modifiche ai parametri numerici (tetto, premi, costi) sono
configurabili dal commissioner senza voto solo se migliorative per tutte le squadre allo stesso modo.

---

## Appendice A — Quadro sinottico dei parametri

| Parametro | Valore |
|---|---|
| Squadre | 10 |
| Tetto salariale | 85 M |
| Rosa | 25-30 giocatori (min. 3 P, 8 D, 8 C, 6 A) |
| Contratti pluriennali | max 9 |
| Rilancio minimo | 0,25 M |
| Capitale iniziale | 40 M |
| Team Option | 3 per stagione, +20% |
| Franchise Tag | 1 per stagione |
| Performance buy-out | 3 per stagione |
| Offerte free agency | 5 per stagione |
| Pre-contract | 3 per stagione |
| Contratti tampone | 3 per stagione |
| Dead cap dopo buy-out | 25% dell'ingaggio corrente |
| Durata waiver | 48 ore |
| Durata asta free agency | 24 ore |
| Giovani in rosa | 3, fino a 11 con investimento |

## Appendice B — Riepilogo delle modifiche

| # | Cosa cambia | Perché |
|---|---|---|
| 1 | Commissioner non giocante | elimina il conflitto d'interesse del responsabile di lega |
| 2 | Tipi di contratto da 5 a 3 (+1) | i cinque tipi avevano numeri in contraddizione tra i documenti |
| 3 | Max Contract abolito | era uno Standard sopra i 10 M con un nome diverso |
| 4 | Veteran a −20% l'anno | a −10% su due anni il risparmio era irrilevante |
| 5 | Franchise Tag al posto di Giocatore protetto | proteggerne 5 gratis non è una scelta; taggarne 1 a prezzo di mercato sì |
| 6 | Contratto non ristrutturabile in trade | era la porta d'ingresso agli scambi collusivi |
| 7 | Buy-out libera il cap + dead cap 25% | l'art. 8 del 25/26 non diceva per quanto restasse occupato |
| 8 | Waiver a 48 ore | impedisce la corsa al click, aiuta chi va male |
| 9 | Parità in free agency alla peggio classificata | contiene il divario, come nelle leghe americane |
| 10 | Stadio riequilibrato | a ogni livello l'impianto era in perdita permanente |
| 11 | Prelazione osservatori = diritto di pareggio | le due versioni dicevano cose diverse |
| 12 | Sponsor formalizzati | esistevano nei fogli, in nessun regolamento |
| 13 | Registro pubblico immutabile | è la vera cura per gli «scambi poco chiari» dell'art. 1 |
