import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "./db";

/**
 * La chiave che firma le sessioni e le impronte delle offerte a busta chiusa.
 *
 * Se `AUTH_SECRET` è configurata, si usa quella: è il modo corretto in
 * produzione, perché la chiave non finisce nel database. Se non c'è, se ne
 * genera una alla prima richiesta e si conserva nelle impostazioni, così
 * mettere online la lega richiede una variabile d'ambiente sola invece di tre.
 *
 * In entrambi i casi la chiave resta **stabile**: se cambiasse, tutti
 * verrebbero disconnessi e le impronte delle buste già depositate non
 * tornerebbero più.
 */

let cache: string | undefined;

/**
 * `process.env.NOME` viene **sostituito col valore alla compilazione**: se la
 * variabile manca durante la build, il codice compilato contiene `undefined` e
 * il valore impostato a runtime non viene mai letto. Passando dalla variabile
 * intermedia la sostituzione non avviene e la lettura è quella vera, a ogni
 * richiesta. È la differenza tra «aggiungo la variabile e funziona» e «aggiungo
 * la variabile e non capisco perché non funziona».
 */
function daAmbiente(nome: string): string | undefined {
  const ambiente = process.env as Record<string, string | undefined>;
  return ambiente[nome];
}

export async function appSecret(): Promise<string> {
  const dallAmbiente = daAmbiente("AUTH_SECRET");
  if (dallAmbiente) return dallAmbiente;

  if (cache) return cache;

  // `upsert` invece di «leggi, e se manca scrivi»: due richieste in parallelo
  // al primo avvio genererebbero due chiavi diverse, e una delle due vincerebbe.
  const generata = randomBytes(32).toString("base64");
  const riga = await db.setting.upsert({
    where: { key: "app_secret" },
    create: { key: "app_secret", value: generata },
    update: {},
  });

  cache = riga.value;
  return cache;
}
