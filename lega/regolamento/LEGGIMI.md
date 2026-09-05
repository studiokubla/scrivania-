# Il regolamento in quattro pagine

`Dynasty-League-regolamento.pdf` — quattro slide 16:9 da mandare agli allenatori:
la lega, i contratti, il mercato, la società.

I numeri sono gli stessi che l'applicazione applica davvero: stanno tutti
nell'oggetto `REGOLE` in cima a `app.html`. **Se cambi una regola lì, cambiala
anche qui** — un regolamento che dice una cosa e un'app che ne fa un'altra è
peggio di nessun regolamento.

## Rifarlo

`regolamento.html` è la sorgente, e si apre da sola in un browser: il pallone
della testata è dentro il file, i caratteri arrivano da Google Fonts.

```
python3 -m http.server 8099          # dalla cartella lega/
node regolamento/stampa.mjs          # riscrive il PDF e le quattro PNG
```

Lo script controlla anche che ogni slide stia dentro i 720 px: se una trabocca
lo dice, invece di lasciartelo scoprire nel PDF.
