# Rifare la demo

`demo.html` è un file solo, che si apre con un doppio clic e non ha bisogno di
niente: dentro ci sono l'applicazione, il listone e una lega di esempio già
giocata. Al posto del database condiviso c'è il `localStorage` del browser, così
la demo si può usare davvero — e chi la apre non tocca la lega vera.

Si ricompone da tre pezzi:

```bash
cd lega
node semina-demo.mjs      # rigenera demo-dati.json: dieci rose valide
# poi si incolla demo-guscio.html + app.html + la striscia finale in demo.html
```

`semina-demo.mjs` non inventa rose a caso: divide il budget per ruolo **prima**
di comprare — altrimenti le ultime squadre restano senza attaccanti — e alla
fine controlla ogni rosa contro il regolamento (tetto, venticinque giocatori,
minimi di ruolo, nove slot). Se una rosa non è valida, esce con errore invece di
scrivere una demo che mostra uno stato impossibile.

I giocatori idonei al settore giovanile restano fuori dalle rose: è come va in
una lega dinastica, e senza quella regola le dieci squadre se li prendevano
quasi tutti, lasciando il filtro *Primavera* con quattro nomi invece di
trentacinque.
