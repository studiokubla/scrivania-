# Pacchetto di pubblicazione

Due file, e servono a una cosa sola: pubblicare l'applicazione su Vercel
**senza collegare il progetto a Git**.

L'applicazione sta in `dynasty/web`, cioè in una sottocartella. Un progetto
Vercel collegato a Git la trova solo se qualcuno imposta a mano la «Root
Directory»; se quel campo resta vuoto Vercel compila la radice del repository,
non trova nessun `package.json` e la build fallisce con *No Next.js version
detected*. Questo pacchetto toglie il problema alla radice: si carica così
com'è, e durante la build va a prendersi il codice dal repository pubblico.

## Cosa fa `bootstrap.mjs`

1. scarica l'archivio del commit indicato in `COMMIT`;
2. copia `dynasty/web` nella cartella di lavoro, sostituendo il `package.json`
   finto con quello vero;
3. toglie le dipendenze che servono solo a sviluppare — `playwright` da solo
   si porterebbe dietro il download di tre browser — e i due file che senza
   quelle non passerebbero il controllo dei tipi;
4. installa con `NODE_ENV=development`, perché con `NODE_ENV=production` npm
   salta tutte le dipendenze di sviluppo: fra queste TypeScript, Tailwind e la
   riga di comando di Prisma, senza le quali non si compila niente;
5. compila.

Il `package.json` di questo pacchetto dichiara `next` fra le dipendenze anche
se non lo usa: Vercel controlla che il framework ci sia **prima** di lanciare
la build, e senza quella riga non arriverebbe mai a eseguire lo script.

## Se la build fallisce non fallisce

Una build fallita lascia l'indirizzo di produzione senza niente da servire, e
il log si legge solo entrando nel pannello Vercel. Per questo, se qualcosa si
rompe, lo script pubblica al suo posto una pagina sola con il diario della
build dentro: l'errore si legge dall'indirizzo pubblico, senza dover chiedere
a nessuno di andare a guardare.

## Aggiornare la versione pubblicata

Cambia `COMMIT` in `bootstrap.mjs` e ripubblica il pacchetto. La versione
online è fissata a un commit preciso: non cambia da sola quando qualcuno
spinge sul branch.
