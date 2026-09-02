/**
 * Il modello del foglio per comporre una rosa.
 *
 * Sta qui e non accanto all'azione perché un modulo `"use server"` può
 * esportare soltanto funzioni asincrone: una costante lì dentro fa fallire la
 * compilazione con un errore che non lo dice.
 *
 * Il foglio minimo ha una colonna sola, i nomi. Le altre sono facoltative:
 * quando ci sono, il giocatore entra in rosa già firmato; quando mancano,
 * resta in attesa e si completa dall'applicazione.
 */
export const MODELLO_ROSA = [
  "giocatore,squadra serie a,costo,contratto,anni",
  "Svilar,Roma,12,ANNUALE,1",
  "Dimarco,Inter,9,STANDARD,3",
  "Nico Paz,Como,13,,",
  "Bijlow,Genoa,,,",
].join("\n");
