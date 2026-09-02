"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { ContractTag, Empty, RoleBadge, Tag, Titolo } from "@/components/ui";
import { Result } from "../mercato/client";
import { formatMoney, type Money } from "@/lib/money";
import type { ActionResult } from "@/app/actions/contracts";
import type { ImportRosaState } from "@/app/actions/rosa";

export interface Libero {
  id: string;
  nome: string;
  ruolo: string;
  squadraSerieA: string | null;
  /** Età al 1° settembre. `null` quando il listone non la stampa: allora
   *  Rookie e Veteran non si possono firmare (art. 4.2). */
  età: number | null;
}

export interface VoceAttesa extends Libero {
  playerId: string;
  importo: Money | null;
  tipo: string | null;
  anni: number | null;
}

interface InRosa {
  id: string;
  nome: string;
  ruolo: string;
  tipo: string;
  anni: number;
  importo: Money;
}

interface TipoContratto {
  id: string;
  label: string;
  anni: number[];
  nota: string;
  /** Rookie e Veteran dipendono dall'età: se non si conosce, non si firmano. */
  serveEtà?: boolean;
}

const CONTRATTI: TipoContratto[] = [
  { id: "ANNUALE", label: "Annuale", anni: [1], nota: "1 anno, nessun requisito, non occupa slot" },
  { id: "STANDARD", label: "Standard", anni: [2, 3], nota: "2-3 anni, +10% l'anno, occupa uno slot" },
  { id: "ROOKIE", label: "Rookie", anni: [2, 3, 4], nota: "under 23 alla firma, ingaggio invariato", serveEtà: true },
  { id: "VETERAN", label: "Veteran", anni: [2], nota: "over 30 alla firma, −20% l'anno", serveEtà: true },
  { id: "TAMPONE", label: "Tampone", anni: [1], nota: "4 giornate, max 1 M, tre a stagione" },
];

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="bottone bottone-primario bottone-largo" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Il modulo della firma.
 *
 * Tre campi e nient'altro: quanto, che contratto, per quanti anni. Gli anni
 * seguono il tipo — un Annuale dura un anno e basta, quindi il campo sparisce —
 * e i tipi che dipendono dall'età si spengono da soli quando l'età non si
 * conosce, dicendo perché invece di far scoprire il rifiuto dopo.
 */
function Firma({
  giocatore,
  teamId,
  slotLiberi,
  azione,
  stato,
  onChiudi,
}: {
  giocatore: Libero | VoceAttesa;
  teamId: string;
  slotLiberi: number;
  azione: (formData: FormData) => void;
  stato: ActionResult;
  onChiudi: () => void;
}) {
  const precompilato = "importo" in giocatore ? giocatore : null;
  const [tipo, setTipo] = useState<string>(precompilato?.tipo ?? "ANNUALE");
  const scelto = CONTRATTI.find((c) => c.id === tipo) ?? CONTRATTI[0];

  return (
    <form action={azione} className="carta-menta imbottita" style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="playerId" value={"playerId" in giocatore ? giocatore.playerId : giocatore.id} />

      <div>
        <div className="occhiello">Metti in rosa</div>
        <div className="numeretto" style={{ marginTop: 6 }}>
          {giocatore.nome}
        </div>
        <div className="didascalia" style={{ marginTop: 2 }}>
          {giocatore.squadraSerieA}
          {giocatore.età !== null ? ` · ${giocatore.età} anni` : " · età sconosciuta"}
        </div>
      </div>

      <div>
        <label className="etichetta" htmlFor="amount">
          Costo (milioni)
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
          defaultValue={precompilato?.importo != null ? precompilato.importo / 100 : undefined}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="etichetta" htmlFor="type">
          Tipo di contratto
        </label>
        <select id="type" name="type" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {CONTRATTI.map((c) => {
            const bloccatoEtà = c.serveEtà && giocatore.età === null;
            const bloccatoSlot = c.anni[0] > 1 && slotLiberi <= 0;
            return (
              <option key={c.id} value={c.id} disabled={bloccatoEtà || bloccatoSlot}>
                {c.label}
                {bloccatoEtà ? " — serve l’età del giocatore" : bloccatoSlot ? " — slot pluriennali esauriti" : ""}
              </option>
            );
          })}
        </select>
        <p className="didascalia" style={{ margin: "6px 0 0" }}>{scelto.nota}</p>
      </div>

      {scelto.anni.length > 1 ? (
        <div>
          <label className="etichetta" htmlFor="years">
            Durata
          </label>
          <select id="years" name="years" className="campo" defaultValue={String(precompilato?.anni ?? scelto.anni[0])}>
            {scelto.anni.map((a) => (
              <option key={a} value={a}>
                {a} anni
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="years" value={scelto.anni[0]} />
      )}

      {stato.message && <Result result={stato} />}

      <Submit label="Metti in rosa" pendingLabel="Firmo…" />
      <button type="button" className="bottone bottone-largo" onClick={onChiudi}>
        Annulla
      </button>
    </form>
  );
}

export function ComponiRosa({
  team,
  squadre,
  liberi,
  attesa,
  inRosa,
  maxRosa,
  slotLiberi,
  modello,
  firma,
  importa,
  togli,
  scarta,
  svuota,
}: {
  team: { id: string; name: string };
  squadre: { id: string; name: string }[];
  liberi: Libero[];
  attesa: VoceAttesa[];
  inRosa: InRosa[];
  maxRosa: number;
  slotLiberi: number;
  modello: string;
  firma: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  importa: (prev: ImportRosaState, formData: FormData) => Promise<ImportRosaState>;
  togli: (contractId: string) => Promise<ActionResult>;
  scarta: (entryId: string) => Promise<ActionResult>;
  svuota: (teamId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [cerca, setCerca] = useState("");
  const [scelto, setScelto] = useState<Libero | VoceAttesa | null>(null);
  const [statoFirma, azioneFirma] = useActionState<ActionResult, FormData>(firma, { ok: true, message: "" });
  const [statoImport, azioneImport] = useActionState<ImportRosaState, FormData>(importa, { ok: true, message: "" });
  const [esito, setEsito] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostraModello, setMostraModello] = useState(false);

  const trovati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (q.length < 2) return [];
    return liberi
      .filter((p) => p.nome.toLowerCase().includes(q) || (p.squadraSerieA ?? "").toLowerCase().includes(q))
      .slice(0, 25);
  }, [liberi, cerca]);

  const pienaAbbastanza = inRosa.length >= maxRosa;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Il commissioner compone per chiunque: la squadra si cambia da qui. */}
      {squadre.length > 1 && (
        <div className="carta" style={{ padding: 14 }}>
          <label className="etichetta" htmlFor="squadra">
            Quale squadra stai componendo
          </label>
          <select
            id="squadra"
            className="campo"
            value={team.id}
            onChange={(e) => router.push(`/rosa?squadra=${e.target.value}`)}
          >
            {squadre.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {esito && <Result result={esito} />}

      {/* ── Firma in corso ───────────────────────────────────────────────── */}
      {scelto && (
        <Firma
          // La chiave rimonta il modulo a ogni giocatore. Senza, React
          // riuserebbe lo stesso e il tipo di contratto resterebbe quello di
          // prima: si firmerebbe un pluriennale per sbaglio, credendo di aver
          // scelto Annuale.
          key={scelto.id}
          giocatore={scelto}
          teamId={team.id}
          slotLiberi={slotLiberi}
          azione={azioneFirma}
          stato={statoFirma}
          onChiudi={() => setScelto(null)}
        />
      )}

      {/* ── Righe in attesa di prezzo ────────────────────────────────────── */}
      {attesa.length > 0 && (
        <>
          <Titolo>
            Da completare <span className="tag tag-avviso">{attesa.length}</span>
          </Titolo>
          <div className="carta" style={{ padding: 0 }}>
            <p className="didascalia" style={{ margin: 0, padding: "14px 16px 4px" }}>
              Arrivati dal foglio senza prezzo o senza tipo di contratto. Finché restano qui il
              giocatore è ancora svincolato: chiunque potrebbe prenderlo.
            </p>
            <div className="elenco">
              {attesa.map((v) => (
                <div key={v.id} className="riga">
                  <RoleBadge role={v.ruolo} />
                  <div className="riga-corpo">
                    <div className="riga-titolo">{v.nome}</div>
                    <div className="riga-nota">
                      {v.squadraSerieA}
                      {v.importo != null && ` · ${formatMoney(v.importo)}`}
                      {v.tipo && ` · ${v.tipo}`}
                    </div>
                  </div>
                  <button type="button" className="bottone bottone-piccolo bottone-primario" onClick={() => setScelto(v)}>
                    Completa
                  </button>
                  <button
                    type="button"
                    className="bottone bottone-piccolo"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        setEsito(await scarta(v.id));
                        router.refresh();
                      })
                    }
                  >
                    Togli
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Aggiungi dal listone ─────────────────────────────────────────── */}
      <Titolo>Aggiungi dal listone</Titolo>
      <div className="carta" style={{ padding: 14, display: "grid", gap: 10 }}>
        <input
          className="campo"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca il giocatore che hai preso"
          aria-label="Cerca fra gli svincolati"
          autoComplete="off"
          disabled={pienaAbbastanza}
        />
        {pienaAbbastanza ? (
          <p className="didascalia" style={{ margin: 0 }}>
            Rosa al massimo: {maxRosa} giocatori.
          </p>
        ) : cerca.trim().length < 2 ? (
          <p className="didascalia" style={{ margin: 0 }}>
            Scrivi almeno due lettere del cognome. {liberi.length} giocatori ancora liberi.
          </p>
        ) : trovati.length === 0 ? (
          <p className="didascalia" style={{ margin: 0 }}>
            Nessuno svincolato con questo nome. Se l&apos;hai già messo in rosa non compare più qui.
          </p>
        ) : (
          <div className="elenco">
            {trovati.map((p) => (
              <button
                key={p.id}
                type="button"
                className="riga"
                onClick={() => {
                  setScelto(p);
                  setCerca("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <RoleBadge role={p.ruolo} />
                <div className="riga-corpo">
                  <div className="riga-titolo">{p.nome}</div>
                  <div className="riga-nota">
                    {p.squadraSerieA}
                    {p.età !== null && ` · ${p.età} anni`}
                  </div>
                </div>
                <span className="riga-valore">+</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Import del foglio ────────────────────────────────────────────── */}
      <details className="piega carta">
        <summary>
          <span>
            Carica il foglio dell&apos;asta
            <div className="riga-nota" style={{ fontWeight: 400 }}>
              Excel o CSV: mette dentro tutti i nomi in un colpo
            </div>
          </span>
        </summary>
        <div style={{ padding: "0 18px 18px", display: "grid", gap: 12 }}>
          <p className="didascalia" style={{ margin: 0 }}>
            Serve una colonna <strong>giocatore</strong>. Se il foglio porta anche{" "}
            <strong>costo</strong> e <strong>contratto</strong>, i giocatori entrano in rosa già
            firmati; altrimenti restano da completare qui sopra, e ti resta solo da scrivere prezzo
            e tipo.
          </p>

          <form action={azioneImport} style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="teamId" value={team.id} />
            <div>
              <label className="etichetta" htmlFor="file">
                File (.xlsx, .csv)
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                className="campo"
                required
              />
            </div>
            <Submit label="Carica la rosa" pendingLabel="Carico…" />
          </form>

          {statoImport.message && <Result result={statoImport} />}

          {statoImport.esito && (statoImport.esito.nonAbbinati.length > 0 || statoImport.esito.respinti.length > 0) && (
            <div className="avviso avviso-attenzione" style={{ display: "block" }}>
              {statoImport.esito.nonAbbinati.length > 0 && (
                <>
                  <strong>Non riconosciuti:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {statoImport.esito.nonAbbinati.slice(0, 10).map((r) => (
                      <li key={r.name}>
                        {r.name} — {r.reason}
                        {r.ambiguous?.length ? ` (${r.ambiguous.join(", ")})` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {statoImport.esito.respinti.length > 0 && (
                <>
                  <strong style={{ display: "block", marginTop: 8 }}>Respinti dalle regole:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {statoImport.esito.respinti.slice(0, 10).map((r) => (
                      <li key={r.name}>
                        {r.name} — {r.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <button type="button" className="bottone" onClick={() => setMostraModello((v) => !v)}>
            {mostraModello ? "Nascondi il modello" : "Come dev'essere fatto il foglio"}
          </button>
          {mostraModello && (
            <pre
              style={{
                margin: 0,
                padding: 12,
                background: "var(--carta-alt)",
                borderRadius: "var(--raggio-piccolo)",
                fontSize: 12.5,
                overflowX: "auto",
              }}
            >
              {modello}
            </pre>
          )}
        </div>
      </details>

      {/* ── La rosa che si sta formando ──────────────────────────────────── */}
      <Titolo>
        In rosa <span className="tag tag-accento">{inRosa.length}</span>
      </Titolo>

      <div className="carta" style={{ padding: 0 }}>
        {inRosa.length === 0 ? (
          <Empty>
            Ancora nessuno.
            <br />
            Cerca i giocatori che hai preso, oppure carica il foglio dell&apos;asta.
          </Empty>
        ) : (
          <div className="elenco">
            {inRosa.map((c) => (
              <div key={c.id} className="riga">
                <RoleBadge role={c.ruolo} />
                <div className="riga-corpo">
                  <div className="riga-titolo">{c.nome}</div>
                  <div className="riga-nota">
                    <ContractTag type={c.tipo} years={c.anni} />
                  </div>
                </div>
                <div className="riga-valore">{formatMoney(c.importo)}</div>
                <button
                  type="button"
                  className="bottone bottone-piccolo"
                  disabled={pending}
                  title="Toglilo dalla rosa: torna svincolato"
                  onClick={() =>
                    startTransition(async () => {
                      setEsito(await togli(c.id));
                      router.refresh();
                    })
                  }
                >
                  Togli
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {inRosa.length > 0 && (
        <details className="piega carta">
          <summary>
            <span>
              Ricominciare da capo
              <div className="riga-nota" style={{ fontWeight: 400 }}>
                Scioglie tutti i contratti di {team.name}
              </div>
            </span>
          </summary>
          <div style={{ padding: "0 18px 18px", display: "grid", gap: 10 }}>
            <p className="didascalia" style={{ margin: 0 }}>
              Serve se hai caricato il foglio sbagliato o la squadra sbagliata. I giocatori tornano
              tutti nel listone. Vale solo finché la rosa è in composizione: appena c&apos;è stato
              uno scambio o uno svincolo, le correzioni si fanno una per una.
            </p>
            <button
              type="button"
              className="bottone bottone-pericolo bottone-largo"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Sciogliere i ${inRosa.length} contratti di ${team.name}?`)) return;
                startTransition(async () => {
                  setEsito(await svuota(team.id));
                  router.refresh();
                });
              }}
            >
              Svuota la rosa
            </button>
          </div>
        </details>
      )}

      {inRosa.length > 0 && attesa.length === 0 && (
        <div className="avviso avviso-nota">
          <Tag tone="accento">{inRosa.length}</Tag>
          <span>
            Rosa composta. Le firme sono già valide: la trovi nella scrivania squadra, e il listone
            si è accorciato di altrettanto.
          </span>
        </div>
      )}
    </div>
  );
}
