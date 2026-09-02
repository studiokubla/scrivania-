"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { ActionResult } from "@/app/actions/contracts";

/** Riquadro di esito condiviso: gli errori del motore arrivano con l'articolo. */
export function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
      <div className={`avviso ${result.ok ? "avviso-ok" : "avviso-errore"}`}>{result.message}</div>
      {result.errors?.map((e, i) => (
        <div key={i} className={`avviso ${result.ok ? "avviso-attenzione" : "avviso-errore"}`}>
          <strong style={{ flexShrink: 0 }}>{e.article}</strong>
          <span>{e.message}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Bottone che chiama un'azione del server e mostra l'esito.
 * `confirm` serve per le operazioni che costano: uno svincolo non si annulla.
 */
export function ActionButton({
  label,
  pendingLabel,
  action,
  confirm,
  variant = "normale",
  title,
}: {
  label: string;
  pendingLabel?: string;
  action: () => Promise<ActionResult>;
  confirm?: string;
  variant?: "normale" | "primario" | "pericolo";
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();

  const className =
    variant === "primario" ? "bottone bottone-primario" : variant === "pericolo" ? "bottone bottone-pericolo" : "bottone";

  return (
    <>
      <button
        className={className}
        disabled={pending}
        title={title}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            const r = await action();
            setResult(r);
            if (r.ok) router.refresh();
          });
        }}
      >
        {pending ? (pendingLabel ?? "Attendi…") : label}
      </button>
      <Result result={result} />
    </>
  );
}

export interface FreeAgent {
  id: string;
  name: string;
  role: string;
  serieATeam: string | null;
  quotation: number | null;
  age: number | null;
  /** Contesa già aperta su questo giocatore */
  contestClosesAt: string | null;
  contestOffers: number;
}

const TIPI = [
  { value: "ANNUALE", label: "Annuale — 1 anno" },
  { value: "STANDARD", label: "Standard — 2/3 anni, +10% l'anno" },
  { value: "ROOKIE", label: "Rookie — Under 23, 2/4 anni, max 6 M" },
  { value: "VETERAN", label: "Veteran — Over 30, 2 anni, max 10 M, −20% l'anno" },
  { value: "TAMPONE", label: "Tampone — 4 giornate, max 1 M" },
];

/** Modulo di offerta a busta chiusa (art. 9.2). */
export function OfferForm({
  players,
  submit,
  offersLeft,
}: {
  players: FreeAgent[];
  submit: (input: {
    playerId: string;
    salary: number;
    years: number;
    contractType: "ANNUALE" | "STANDARD" | "ROOKIE" | "VETERAN" | "TAMPONE";
  }) => Promise<ActionResult>;
  offersLeft: number;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FreeAgent | null>(null);
  const [salary, setSalary] = useState("1");
  const [years, setYears] = useState("1");
  const [type, setType] = useState<"ANNUALE" | "STANDARD" | "ROOKIE" | "VETERAN" | "TAMPONE">("ANNUALE");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const matches =
    query.trim().length < 2
      ? []
      : players.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <label className="etichetta" htmlFor="cerca">
          Cerca uno svincolato
        </label>
        <input
          id="cerca"
          className="campo"
          value={selected ? selected.name : query}
          placeholder="Scrivi almeno due lettere del cognome"
          onChange={(e) => {
            setSelected(null);
            setQuery(e.target.value);
            setResult(null);
          }}
        />
        {!selected && matches.length > 0 && (
          <ul
            className="carta"
            style={{ listStyle: "none", margin: "6px 0 0", padding: 4, display: "grid", gap: 2 }}
          >
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  className="bottone"
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    border: "none",
                    background: "transparent",
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    setSelected(p);
                    setQuery("");
                  }}
                >
                  <span>
                    {p.name}{" "}
                    <span style={{ color: "var(--inchiostro-tenue)", fontSize: 12 }}>
                      {p.role} · {p.serieATeam ?? "—"}
                      {p.age !== null && ` · ${p.age} anni`}
                    </span>
                  </span>
                  <span className="cifre" style={{ color: "var(--inchiostro-tenue)", fontSize: 12 }}>
                    q. {p.quotation ?? "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected?.contestClosesAt && (
        <div className="avviso avviso-nota">
          Contesa già aperta su {selected.name}: {selected.contestOffers}{" "}
          {selected.contestOffers === 1 ? "offerta" : "offerte"} sigillate, si apre il{" "}
          {new Date(selected.contestClosesAt).toLocaleString("it-IT")}. La tua offerta non consuma una
          delle {offersLeft} rimaste.
        </div>
      )}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        <div>
          <label className="etichetta" htmlFor="ingaggio">
            Ingaggio (M)
          </label>
          <input
            id="ingaggio"
            className="campo cifre"
            type="number"
            step="0.25"
            min="0.25"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
        </div>
        <div>
          <label className="etichetta" htmlFor="anni">
            Anni
          </label>
          <input
            id="anni"
            className="campo cifre"
            type="number"
            min="1"
            max="4"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="etichetta" htmlFor="tipo">
            Tipo di contratto
          </label>
          <select
            id="tipo"
            className="campo"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            {TIPI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="bottone bottone-primario"
        disabled={!selected || pending}
        onClick={() => {
          if (!selected) return;
          startTransition(async () => {
            const r = await submit({
              playerId: selected.id,
              salary: Number(salary),
              years: Number(years),
              contractType: type,
            });
            setResult(r);
            if (r.ok) {
              setSelected(null);
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Invio…" : "Invia offerta sigillata"}
      </button>

      <p style={{ margin: 0, fontSize: 12, color: "var(--inchiostro-tenue)" }}>
        L&apos;offerta resta segreta fino all&apos;apertura. Nel registro pubblico compare che una
        contesa è aperta, non a quanto.
      </p>

      <Result result={result} />
    </div>
  );
}

/** Conto alla rovescia leggibile, aggiornato ogni minuto. */
export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="tag tag-avviso">in apertura</span>;

  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return (
    <span className="cifre" style={{ fontSize: 12.5 }}>
      {hours > 0 ? `${hours}h ` : ""}
      {minutes}m
    </span>
  );
}
