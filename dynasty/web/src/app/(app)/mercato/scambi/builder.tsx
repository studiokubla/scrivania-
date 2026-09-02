"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Result } from "../client";
import type { ActionResult } from "@/app/actions/contracts";

interface RosterEntry {
  id: string;
  name: string;
  role: string;
  salary: number;
  type: string;
  years: number;
}

interface PreviewEffect {
  teamId: string;
  teamName: string;
  salaryDelta: number;
  playersBefore: number;
  playersAfter: number;
  capitalAfter: number;
}

interface Preview {
  ok: boolean;
  errors: { code: string; article: string; message: string }[];
  warnings: { code: string; article: string; message: string }[];
  effects: PreviewEffect[];
}

const COLORE_RUOLO: Record<string, string> = { P: "#a16207", D: "#0f766e", C: "#1d4ed8", A: "#b91c1c" };

function PlayerPicker({
  title,
  roster,
  selected,
  onToggle,
}: {
  title: string;
  roster: RosterEntry[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="occhiello" style={{ marginBottom: 6 }}>
        {title}
      </div>
      <div
        style={{
          maxHeight: 260,
          overflowY: "auto",
          border: "1px solid var(--bordo)",
          borderRadius: 8,
          background: "var(--carta)",
        }}
      >
        {roster.length === 0 ? (
          <p style={{ margin: 0, padding: 14, fontSize: 13, color: "var(--inchiostro-tenue)" }}>
            Scegli prima una squadra.
          </p>
        ) : (
          roster.map((p) => {
            const on = selected.has(p.id);
            return (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--bordo)",
                  cursor: "pointer",
                  background: on ? "var(--accento-tenue)" : undefined,
                  fontSize: 13,
                }}
              >
                <input type="checkbox" checked={on} onChange={() => onToggle(p.id)} />
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
                    flexShrink: 0,
                  }}
                >
                  {p.role}
                </span>
                <span style={{ flex: 1, fontWeight: 550 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "var(--inchiostro-tenue)" }}>
                  {p.type.slice(0, 3)}
                  {p.years > 1 ? ` ${p.years}a` : ""}
                </span>
                <span className="cifre" style={{ fontWeight: 600 }}>
                  {p.salary.toLocaleString("it-IT")} M
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export function TradeBuilder({
  teams,
  myRoster,
  rosterByTeam,
  preview,
  submit,
}: {
  teams: { id: string; name: string; color: string }[];
  myRoster: RosterEntry[];
  rosterByTeam: Record<string, RosterEntry[]>;
  preview: (input: {
    receiverId: string;
    contractsOut: string[];
    contractsIn: string[];
    capitalOut: number;
    capitalIn: number;
  }) => Promise<Preview | null>;
  submit: (input: {
    receiverId: string;
    contractsOut: string[];
    contractsIn: string[];
    capitalOut: number;
    capitalIn: number;
    message?: string;
  }) => Promise<ActionResult>;
}) {
  const [receiverId, setReceiverId] = useState("");
  const [out, setOut] = useState<Set<string>>(new Set());
  const [inn, setInn] = useState<Set<string>>(new Set());
  const [capitalOut, setCapitalOut] = useState("0");
  const [capitalIn, setCapitalIn] = useState("0");
  const [message, setMessage] = useState("");
  const [check, setCheck] = useState<Preview | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const theirRoster = receiverId ? (rosterByTeam[receiverId] ?? []) : [];

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void) => (id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
    setCheck(null);
    setResult(null);
  };

  const payload = {
    receiverId,
    contractsOut: [...out],
    contractsIn: [...inn],
    capitalOut: Number(capitalOut) || 0,
    capitalIn: Number(capitalIn) || 0,
  };

  const empty = out.size === 0 && inn.size === 0 && payload.capitalOut === 0 && payload.capitalIn === 0;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <label className="etichetta" htmlFor="controparte">
          Controparte
        </label>
        <select
          id="controparte"
          className="campo"
          value={receiverId}
          onChange={(e) => {
            setReceiverId(e.target.value);
            setInn(new Set());
            setCheck(null);
          }}
        >
          <option value="">Scegli una squadra…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <PlayerPicker title="Cedi" roster={myRoster} selected={out} onToggle={toggle(out, setOut)} />
        <PlayerPicker title="Ricevi" roster={theirRoster} selected={inn} onToggle={toggle(inn, setInn)} />
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div>
          <label className="etichetta" htmlFor="capOut">
            Capitale che cedi (M)
          </label>
          <input
            id="capOut"
            className="campo cifre"
            type="number"
            min="0"
            step="0.25"
            value={capitalOut}
            onChange={(e) => {
              setCapitalOut(e.target.value);
              setCheck(null);
            }}
          />
        </div>
        <div>
          <label className="etichetta" htmlFor="capIn">
            Capitale che ricevi (M)
          </label>
          <input
            id="capIn"
            className="campo cifre"
            type="number"
            min="0"
            step="0.25"
            value={capitalIn}
            onChange={(e) => {
              setCapitalIn(e.target.value);
              setCheck(null);
            }}
          />
        </div>
      </div>

      <div>
        <label className="etichetta" htmlFor="messaggio">
          Messaggio alla controparte (facoltativo)
        </label>
        <input
          id="messaggio"
          className="campo"
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Due righe per spiegare la proposta"
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className="bottone"
          disabled={!receiverId || empty || pending}
          onClick={() =>
            startTransition(async () => {
              setCheck(await preview(payload));
            })
          }
        >
          {pending ? "Verifica…" : "Verifica lo scambio"}
        </button>
        <button
          className="bottone bottone-primario"
          disabled={!receiverId || empty || pending || (check !== null && !check.ok)}
          onClick={() =>
            startTransition(async () => {
              const r = await submit({ ...payload, message: message || undefined });
              setResult(r);
              if (r.ok) {
                setOut(new Set());
                setInn(new Set());
                setCapitalOut("0");
                setCapitalIn("0");
                setMessage("");
                setCheck(null);
                router.refresh();
              }
            })
          }
        >
          Proponi
        </button>
      </div>

      {check && (
        <div style={{ display: "grid", gap: 8 }}>
          {check.errors.map((e, i) => (
            <div key={`e${i}`} className="avviso avviso-errore">
              <strong style={{ flexShrink: 0 }}>{e.article}</strong>
              <span>{e.message}</span>
            </div>
          ))}
          {check.warnings.map((w, i) => (
            <div key={`w${i}`} className="avviso avviso-attenzione">
              <strong style={{ flexShrink: 0 }}>{w.article}</strong>
              <span>{w.message}</span>
            </div>
          ))}
          {check.ok && check.errors.length === 0 && (
            <div className="avviso avviso-ok">Lo scambio è regolare per entrambe le squadre.</div>
          )}

          <table className="griglia" style={{ border: "1px solid var(--bordo)", borderRadius: 8 }}>
            <thead>
              <tr>
                <th>Squadra</th>
                <th className="num">Ingaggi</th>
                <th className="num">Rosa</th>
                <th className="num">Capitale dopo</th>
              </tr>
            </thead>
            <tbody>
              {check.effects.map((e) => (
                <tr key={e.teamId}>
                  <td style={{ fontWeight: 600 }}>{e.teamName}</td>
                  <td
                    className="num"
                    style={{ color: e.salaryDelta > 0 ? "var(--allarme)" : e.salaryDelta < 0 ? "var(--positivo)" : undefined }}
                  >
                    {e.salaryDelta > 0 ? "+" : ""}
                    {e.salaryDelta.toLocaleString("it-IT")} M
                  </td>
                  <td className="num">
                    {e.playersBefore} → {e.playersAfter}
                  </td>
                  <td className="num">{e.capitalAfter.toLocaleString("it-IT")} M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Result result={result} />
    </div>
  );
}
