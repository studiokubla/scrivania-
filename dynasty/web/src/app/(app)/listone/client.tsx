"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Empty, RoleBadge, Tag } from "@/components/ui";
import { Result } from "../mercato/client";
import { formatMoney, type Money } from "@/lib/money";
import type { ActionResult } from "@/app/actions/contracts";
import type { StatoPrimavera } from "@/lib/rules/youth";

export interface VoceListone {
  id: string;
  nome: string;
  ruolo: string;
  squadraSerieA: string | null;
  quotazione: Money | null;
  primavera: StatoPrimavera;
  perché: string;
}

interface Squadra {
  id: string;
  nome: string;
  sigla: string;
  colore: string;
  rosa: number;
}

const RUOLI = [
  { id: "TUTTI", label: "Tutti" },
  { id: "P", label: "Portieri" },
  { id: "D", label: "Difensori" },
  { id: "C", label: "Centrocampisti" },
  { id: "A", label: "Attaccanti" },
] as const;

function Etichetta({ stato, perché }: { stato: StatoPrimavera; perché: string }) {
  if (stato === "IDONEO") return <Tag tone="positivo">primavera</Tag>;
  if (stato === "DA_VERIFICARE") {
    return (
      <span title={perché}>
        <Tag tone="avviso">primavera?</Tag>
      </span>
    );
  }
  return null;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="bottone bottone-primario bottone-largo" disabled={pending}>
      {pending ? "Registro…" : label}
    </button>
  );
}

/**
 * Il listone, con la ricerca.
 *
 * Cinquecento nomi non si sfogliano: si cercano. La lista parte quindi chiusa
 * e si apre digitando, oppure filtrando per ruolo. L'unica eccezione è il
 * filtro «primavera», che ha senso sfogliare — sono pochi e si guardano tutti.
 *
 * Al commissioner ogni riga offre in più il pulsante per registrare l'acquisto
 * deciso al tavolo: si tocca il nome, si sceglie la squadra, si scrive la
 * cifra. Tre gesti, perché all'asta nessuno aspetta.
 */
export function Listone({
  voci,
  squadre,
  maxRosa,
  commissioner,
  ultimi,
  registra,
  annulla,
}: {
  voci: VoceListone[];
  squadre: Squadra[];
  maxRosa: number;
  commissioner: boolean;
  ultimi: { id: string; giocatore: string; squadra: string; importo: Money }[];
  registra: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  annulla: (contractId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [cerca, setCerca] = useState("");
  const [ruolo, setRuolo] = useState<string>("TUTTI");
  const [soloPrimavera, setSoloPrimavera] = useState(false);
  const [scelto, setScelto] = useState<VoceListone | null>(null);
  const [stato, azione] = useActionState<ActionResult, FormData>(registra, { ok: true, message: "" });
  const [esitoAnnullo, setEsitoAnnullo] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const filtrate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return voci.filter((v) => {
      if (ruolo !== "TUTTI" && v.ruolo !== ruolo) return false;
      if (soloPrimavera && v.primavera === "NON_IDONEO") return false;
      if (q.length > 0) {
        return v.nome.toLowerCase().includes(q) || (v.squadraSerieA ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [voci, cerca, ruolo, soloPrimavera]);

  // Senza filtri l'elenco sarebbe di cinquecento righe: si mostra la punta e si
  // dice quanti restano, invece di far scorrere il pollice per un minuto.
  const daMostrare = filtrate.slice(0, 60);
  const nascoste = filtrate.length - daMostrare.length;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ── Ricerca e filtri ─────────────────────────────────────────────── */}
      <div className="carta" style={{ padding: 14, display: "grid", gap: 10 }}>
        <input
          className="campo"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca per cognome o squadra"
          autoComplete="off"
          aria-label="Cerca nel listone"
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {RUOLI.map((r) => (
            <button
              key={r.id}
              type="button"
              className="bottone bottone-piccolo"
              style={{
                border: "none",
                background: ruolo === r.id ? "var(--inchiostro)" : "var(--carta-alt)",
                color: ruolo === r.id ? "var(--sfondo)" : "var(--inchiostro-medio)",
              }}
              onClick={() => setRuolo(r.id)}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            className="bottone bottone-piccolo"
            style={{
              border: "none",
              background: soloPrimavera ? "var(--verde)" : "var(--carta-alt)",
              color: soloPrimavera ? "#101010" : "var(--inchiostro-medio)",
            }}
            onClick={() => setSoloPrimavera((v) => !v)}
            title="Solo chi può entrare nel settore giovanile (art. 16.1)"
          >
            Primavera
          </button>
        </div>
        <div className="didascalia">
          {filtrate.length === voci.length
            ? `${voci.length} giocatori liberi`
            : `${filtrate.length} su ${voci.length}`}
        </div>
      </div>

      {/* ── Registrazione ────────────────────────────────────────────────── */}
      {commissioner && scelto && (
        <form action={azione} className="carta-menta imbottita" style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="playerId" value={scelto.id} />
          <div>
            <div className="occhiello">Registra l&apos;acquisto</div>
            <div className="numeretto" style={{ marginTop: 6 }}>
              {scelto.nome}
            </div>
            <div className="didascalia" style={{ marginTop: 2 }}>
              {scelto.squadraSerieA}
              {scelto.quotazione !== null && ` · quotato ${formatMoney(scelto.quotazione)}`}
            </div>
          </div>

          <div>
            <label className="etichetta" htmlFor="teamId">
              A quale squadra
            </label>
            <select id="teamId" name="teamId" className="campo" required defaultValue="">
              <option value="" disabled>
                Scegli…
              </option>
              {squadre.map((s) => (
                <option key={s.id} value={s.id} disabled={s.rosa >= maxRosa}>
                  {s.nome} — {s.rosa}/{maxRosa}
                  {s.rosa >= maxRosa ? " (rosa piena)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etichetta" htmlFor="amount">
              A quanto (milioni)
            </label>
            <input
              id="amount"
              name="amount"
              className="campo cifre"
              type="number"
              step="0.25"
              min="0.25"
              inputMode="decimal"
              placeholder="1"
              required
            />
          </div>

          {stato.message && <Result result={stato} />}

          <Submit label="Registra" />
          <button type="button" className="bottone bottone-largo" onClick={() => setScelto(null)}>
            Annulla
          </button>
        </form>
      )}

      {commissioner && !scelto && stato.message && <Result result={stato} />}
      {esitoAnnullo && <Result result={esitoAnnullo} />}

      {/* ── L'elenco ─────────────────────────────────────────────────────── */}
      <div className="carta" style={{ padding: 0 }}>
        {daMostrare.length === 0 ? (
          <Empty>Nessun giocatore libero con questi filtri.</Empty>
        ) : (
          <div className="elenco">
            {daMostrare.map((v) =>
              commissioner ? (
                <button
                  key={v.id}
                  type="button"
                  className="riga"
                  onClick={() => {
                    setScelto(v);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <RoleBadge role={v.ruolo} />
                  <div className="riga-corpo">
                    <div className="riga-titolo">{v.nome}</div>
                    <div className="riga-nota">
                      {v.squadraSerieA} <Etichetta stato={v.primavera} perché={v.perché} />
                    </div>
                  </div>
                  <div className="riga-valore">{v.quotazione !== null ? formatMoney(v.quotazione) : "—"}</div>
                </button>
              ) : (
                <div key={v.id} className="riga">
                  <RoleBadge role={v.ruolo} />
                  <div className="riga-corpo">
                    <div className="riga-titolo">{v.nome}</div>
                    <div className="riga-nota">
                      {v.squadraSerieA} <Etichetta stato={v.primavera} perché={v.perché} />
                    </div>
                  </div>
                  <div className="riga-valore">{v.quotazione !== null ? formatMoney(v.quotazione) : "—"}</div>
                </div>
              ),
            )}
          </div>
        )}
        {nascoste > 0 && (
          <p className="didascalia" style={{ margin: 0, padding: "14px 16px", textAlign: "center" }}>
            e altri {nascoste}. Cerca per cognome per trovarli.
          </p>
        )}
      </div>

      {/* ── Rimedio agli errori di battitura ─────────────────────────────── */}
      {commissioner && ultimi.length > 0 && (
        <details className="piega carta">
          <summary>
            <span>
              Ultimi acquisti registrati
              <div className="riga-nota" style={{ fontWeight: 400 }}>
                Se hai sbagliato a digitare, da qui si annulla
              </div>
            </span>
          </summary>
          <div className="elenco" style={{ padding: "0 4px 8px" }}>
            {ultimi.map((u) => (
              <div key={u.id} className="riga">
                <div className="riga-corpo">
                  <div className="riga-titolo">{u.giocatore}</div>
                  <div className="riga-nota">
                    {u.squadra} · {formatMoney(u.importo)}
                  </div>
                </div>
                <button
                  type="button"
                  className="bottone bottone-piccolo bottone-pericolo"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Annullare l'acquisto di ${u.giocatore}? Torna nel listone.`)) return;
                    startTransition(async () => {
                      setEsitoAnnullo(await annulla(u.id));
                      router.refresh();
                    });
                  }}
                >
                  Annulla
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
