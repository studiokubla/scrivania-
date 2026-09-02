"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Result } from "../mercato/client";
import type { ActionResult } from "@/app/actions/contracts";

export interface CallablePlayer {
  id: string;
  name: string;
  role: string;
  serieATeam: string | null;
  quotation: number;
  age: number | null;
  basePrice: number;
}

interface OpenLot {
  id: string;
  playerName: string;
  role: string;
  serieATeam: string | null;
  basePrice: number;
  closesAt: string | null;
  calledBy: string;
  tieBreakRound: number;
  bidsReceived: number;
  myBid: number | null;
}

const COLORE_RUOLO: Record<string, string> = { P: "#a16207", D: "#0f766e", C: "#1d4ed8", A: "#b91c1c" };

/**
 * Il banco d'asta.
 *
 * Si aggiorna da solo ogni due secondi mentre una chiamata è aperta: durante l'asta
 * dieci persone guardano la stessa schermata e devono vedere lo stesso stato senza
 * premere niente. Fuori dalla chiamata il ritmo scende, per non tempestare il server.
 */
export function AuctionFloor({
  status,
  bidWindowSeconds,
  isMyTurn,
  hasPassed,
  canParticipate,
  maxBidMillions,
  callable,
  lot,
  call,
  bid,
  pass,
}: {
  status: string;
  bidWindowSeconds: number;
  isMyTurn: boolean;
  hasPassed: boolean;
  canParticipate: boolean;
  maxBidMillions: number;
  callable: CallablePlayer[];
  lot: OpenLot | null;
  call: (playerId: string) => Promise<ActionResult>;
  bid: (lotId: string, amount: number) => Promise<ActionResult>;
  pass: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  // La busta già depositata riempie il campo quando cambia la chiamata, non a ogni
  // aggiornamento: altrimenti quello che il manager sta scrivendo verrebbe sovrascritto
  // dal polling ogni due secondi.
  const [lotoSincronizzato, setLotoSincronizzato] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  if (lot && lot.id !== lotoSincronizzato) {
    setLotoSincronizzato(lot.id);
    setAmount(lot.myBid !== null ? String(lot.myBid) : "");
  }

  const running = status === "RUNNING";

  useEffect(() => {
    if (!running) return;
    const fast = Boolean(lot);
    const id = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, fast ? 2000 : 8000);
    return () => clearInterval(id);
  }, [running, lot, router]);

  const secondsLeft = lot?.closesAt ? Math.max(0, Math.ceil((new Date(lot.closesAt).getTime() - now) / 1000)) : null;

  const matches = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return callable.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query, callable]);

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });

  // ── Chiamata in corso ───────────────────────────────────────────────
  if (lot) {
    const closing = secondsLeft !== null && secondsLeft <= 5;
    return (
      <section className="carta" style={{ overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 18px",
            background: closing ? "var(--allarme-tenue)" : "var(--accento-tenue)",
            borderBottom: "1px solid var(--bordo)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span
            className="cifre"
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: COLORE_RUOLO[lot.role],
              color: "#fff",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {lot.role}
          </span>
          <div>
            <div className="occhiello">
              {lot.tieBreakRound > 0 ? "Spareggio" : "All'asta"} · chiamato da {lot.calledBy}
            </div>
            <h2 style={{ fontSize: 22 }}>{lot.playerName}</h2>
            <div style={{ fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>
              {lot.serieATeam} · base {lot.basePrice.toLocaleString("it-IT")} M
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div className="occhiello">Tempo</div>
            <div
              className="cifre"
              style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: closing ? "var(--allarme)" : "var(--inchiostro)" }}
            >
              {secondsLeft ?? "—"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--inchiostro-tenue)" }}>
              {lot.bidsReceived} {lot.bidsReceived === 1 ? "busta" : "buste"}
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {canParticipate ? (
            <>
              <label className="etichetta" htmlFor="offerta">
                La tua offerta, in milioni. Scrivi 0 se non ti interessa.
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  id="offerta"
                  className="campo cifre"
                  style={{ maxWidth: 160, fontSize: 20, fontWeight: 700 }}
                  type="number"
                  step="0.25"
                  min="0"
                  max={maxBidMillions}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={secondsLeft === 0}
                />
                <button
                  className="bottone bottone-primario"
                  disabled={pending || amount === "" || secondsLeft === 0}
                  onClick={() => run(() => bid(lot.id, Number(amount)))}
                >
                  {lot.myBid !== null ? "Correggi la busta" : "Sigilla l'offerta"}
                </button>
                <button
                  className="bottone"
                  disabled={pending || secondsLeft === 0}
                  onClick={() => run(() => bid(lot.id, 0))}
                >
                  Non mi interessa
                </button>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--inchiostro-tenue)" }}>
                Puoi al massimo {maxBidMillions.toLocaleString("it-IT")} M: il resto va lasciato per
                completare la rosa minima (art. 8.6).{" "}
                {lot.myBid !== null && (
                  <strong style={{ color: "var(--positivo)" }}>
                    Busta depositata a {lot.myBid.toLocaleString("it-IT")} M.
                  </strong>
                )}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--inchiostro-medio)" }}>
              Il commissioner non fa offerte (art. 1.2). Le buste si aprono da sole allo scadere del
              tempo.
            </p>
          )}
          <Result result={result} />
        </div>
      </section>
    );
  }

  // ── Nessuna chiamata: tocca a qualcuno ──────────────────────────────
  return (
    <section className="carta">
      <div style={{ padding: 16 }}>
        {!running ? (
          <p style={{ margin: 0, color: "var(--inchiostro-tenue)", fontSize: 13 }}>
            L&apos;asta non è in corso.
          </p>
        ) : hasPassed ? (
          <p style={{ margin: 0, color: "var(--inchiostro-medio)", fontSize: 13 }}>
            Hai chiuso la tua asta: non chiami e non offri più. La decisione era definitiva (art. 8.2).
          </p>
        ) : !isMyTurn ? (
          <p style={{ margin: 0, color: "var(--inchiostro-medio)", fontSize: 13 }}>
            In attesa della prossima chiamata. La pagina si aggiorna da sola.
          </p>
        ) : (
          <>
            <div className="occhiello" style={{ marginBottom: 6 }}>
              Tocca a te
            </div>
            <label className="etichetta" htmlFor="chiamata">
              Chiama un giocatore
            </label>
            <input
              id="chiamata"
              className="campo"
              placeholder="Almeno due lettere del cognome"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {matches.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  margin: "8px 0 0",
                  padding: 0,
                  border: "1px solid var(--bordo)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      className="bottone"
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        border: "none",
                        borderBottom: "1px solid var(--bordo)",
                        borderRadius: 0,
                        fontWeight: 500,
                      }}
                      disabled={pending}
                      onClick={() => run(() => call(p.id))}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          className="cifre"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            background: COLORE_RUOLO[p.role],
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {p.role}
                        </span>
                        {p.name}
                        <span style={{ color: "var(--inchiostro-tenue)", fontSize: 12 }}>
                          {p.serieATeam}
                          {p.age !== null && ` · ${p.age} anni`}
                        </span>
                      </span>
                      <span className="cifre" style={{ fontSize: 12 }}>
                        q. {p.quotation} · base {p.basePrice.toLocaleString("it-IT")} M
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                className="bottone"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Chiudere la tua asta? Non potrai più chiamare né offrire per il resto dell'asta.")) return;
                  run(pass);
                }}
              >
                Chiudo la mia asta
              </button>
              <span style={{ fontSize: 12, color: "var(--inchiostro-tenue)" }}>
                Ogni chiamata dà {bidWindowSeconds} secondi a tutti per offrire.
              </span>
            </div>
          </>
        )}
        <Result result={result} />
      </div>
    </section>
  );
}
