"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Result } from "../mercato/client";
import type { ImportState } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/contracts";

const TIPI = [
  {
    value: "QUOTAZIONI",
    label: "Listone e quotazioni — Leghe Fantacalcio",
    hint:
      "Il file «Quotazioni Fantacalcio» che Leghe Fantacalcio pubblica a inizio stagione e aggiorna. " +
      "Crea l'anagrafica e fissa le basi d'asta (art. 8.4). Va importato per primo.",
  },
  {
    value: "VOTI",
    label: "Voti di una giornata — Leghe Fantacalcio",
    hint:
      "Il file dei voti della giornata. Da qui escono presenze, media voto e giornate consecutive " +
      "senza voto, cioè le tre condizioni del performance buy-out (art. 12.4).",
  },
  {
    value: "TRANSFERMARKT",
    label: "Anagrafiche e valori — Transfermarkt",
    hint:
      "Transfermarkt non ha un'API pubblica e non consente l'estrazione automatica delle pagine: " +
      "questo import legge un foglio compilato a mano o esportato. Serve soprattutto per le date " +
      "di nascita, senza le quali Rookie e Veteran non si possono firmare.",
  },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="bottone bottone-primario" disabled={pending}>
      {pending ? "Importazione in corso…" : label}
    </button>
  );
}

export function ImportPanel({
  action,
  template,
  currentMatchday,
}: {
  action: (prev: ImportState, formData: FormData) => Promise<ImportState>;
  template: string;
  currentMatchday: number;
}) {
  const [state, formAction] = useActionState<ImportState, FormData>(action, { ok: true, message: "" });
  const [kind, setKind] = useState("QUOTAZIONI");
  const [showTemplate, setShowTemplate] = useState(false);

  const selected = TIPI.find((t) => t.value === kind);

  return (
    <section className="carta">
      <header style={{ padding: "12px 14px", borderBottom: "1px solid var(--bordo)" }}>
        <h2 style={{ fontSize: 15 }}>Import dei dati ufficiali</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>
          Art. 21 — in caso di discrepanza fa fede il dato Leghe Fantacalcio
        </p>
      </header>

      <form action={formAction} style={{ padding: 14, display: "grid", gap: 12 }}>
        <div>
          <label className="etichetta" htmlFor="kind">
            Cosa stai importando
          </label>
          <select id="kind" name="kind" className="campo" value={kind} onChange={(e) => setKind(e.target.value)}>
            {TIPI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {selected && (
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--inchiostro-medio)", lineHeight: 1.5 }}>
              {selected.hint}
            </p>
          )}
        </div>

        {kind === "VOTI" && (
          <div style={{ maxWidth: 160 }}>
            <label className="etichetta" htmlFor="matchday">
              Giornata
            </label>
            <input
              id="matchday"
              name="matchday"
              type="number"
              min="1"
              max="38"
              defaultValue={Math.min(38, currentMatchday + 1)}
              className="campo cifre"
              required
            />
          </div>
        )}

        <div>
          <label className="etichetta" htmlFor="file">
            File (.xlsx, .csv)
          </label>
          <input id="file" name="file" type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="campo" required />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Submit label="Importa" />
          {kind === "TRANSFERMARKT" && (
            <button type="button" className="bottone" onClick={() => setShowTemplate((v) => !v)}>
              {showTemplate ? "Nascondi il modello" : "Mostra il modello del foglio"}
            </button>
          )}
        </div>

        {showTemplate && kind === "TRANSFERMARKT" && (
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: "var(--carta-alt)",
              border: "1px solid var(--bordo)",
              borderRadius: 8,
              fontSize: 12,
              overflowX: "auto",
            }}
          >
            {template}
          </pre>
        )}

        {state.message && <Result result={state} />}

        {state.outcome && state.outcome.unmatched.length > 0 && (
          <details style={{ fontSize: 13 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              {state.outcome.unmatched.length} righe non riconciliate
            </summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--inchiostro-medio)" }}>
              {state.outcome.unmatched.slice(0, 40).map((u, i) => (
                <li key={i}>
                  <strong>{u.name}</strong> — {u.reason}
                  {u.ambiguous && <span> ({u.ambiguous.join(", ")})</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </form>
    </section>
  );
}

/** Compilazione della classifica finale trascinando l'ordine d'arrivo. */
export function StandingsEditor({
  competitionId,
  competitionName,
  teams,
  save,
}: {
  competitionId: string;
  competitionName: string;
  teams: { id: string; name: string }[];
  save: (input: { competitionId: string; order: string[] }) => Promise<ActionResult>;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const remaining = teams.filter((t) => !order.includes(t.id));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>
        Clicca le squadre nell&apos;ordine d&apos;arrivo di {competitionName}.
      </p>

      {order.length > 0 && (
        <ol className="cifre" style={{ margin: 0, paddingLeft: 20, fontSize: 13, columns: 2 }}>
          {order.map((id) => (
            <li key={id}>{teams.find((t) => t.id === id)?.name}</li>
          ))}
        </ol>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {remaining.map((t) => (
          <button
            key={t.id}
            className="bottone"
            style={{ fontSize: 12.5, padding: "5px 9px" }}
            onClick={() => setOrder((o) => [...o, t.id])}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="bottone bottone-primario"
          disabled={order.length < 2 || pending}
          onClick={() =>
            startTransition(async () => {
              const r = await save({ competitionId, order });
              setResult(r);
              if (r.ok) router.refresh();
            })
          }
        >
          Registra la classifica
        </button>
        {order.length > 0 && (
          <button className="bottone" onClick={() => setOrder([])} disabled={pending}>
            Ricomincia
          </button>
        )}
      </div>

      <Result result={result} />
    </div>
  );
}
