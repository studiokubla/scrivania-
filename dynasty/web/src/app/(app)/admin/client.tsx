"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Result } from "../mercato/client";
import type { CredenzialiState, ImportState } from "@/app/actions/admin";
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

// ───────────────────────────────────────────────── Squadre e manager (art. 1.1)

const COLORI = ["#1D4ED8", "#C2410C", "#047857", "#7C3AED", "#B91C1C", "#0F766E", "#A16207", "#374151", "#BE185D", "#0369A1"];

/**
 * Le credenziali appena generate. Restano a schermo finché il commissioner non
 * le chiude: nel database c'è solo la loro impronta, quindi questa è l'unica
 * occasione di leggerle e passarle al manager.
 */
function Credenziali({
  dati,
  onClose,
}: {
  dati: { team: string; email: string; password: string };
  onClose: () => void;
}) {
  const [copiato, setCopiato] = useState(false);
  const testo = `Dynasty League — ${dati.team}\nIndirizzo: ${dati.email}\nPassword: ${dati.password}`;

  return (
    <div
      className="avviso"
      style={{ display: "grid", gap: 10, background: "var(--verde-tenue)", borderColor: "var(--verde-scuro)" }}
      role="status"
    >
      <div>
        <strong style={{ fontSize: 13.5 }}>Credenziali per {dati.team}</strong>
        <div style={{ fontSize: 12.5, color: "var(--inchiostro-medio)", marginTop: 2 }}>
          Si vedono una volta sola. Passale al manager adesso: nel database resta solo l&apos;impronta,
          e se si perdono si rigenerano da capo.
        </div>
      </div>

      <pre
        style={{
          margin: 0,
          padding: 10,
          background: "var(--sfondo)",
          border: "1px solid var(--bordo)",
          borderRadius: 8,
          fontSize: 12.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {testo}
      </pre>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="bottone"
          onClick={() => {
            navigator.clipboard?.writeText(testo).then(
              () => setCopiato(true),
              () => setCopiato(false),
            );
          }}
        >
          {copiato ? "Copiate" : "Copia"}
        </button>
        <button type="button" className="bottone" onClick={onClose}>
          Ho finito
        </button>
      </div>
    </div>
  );
}

interface SquadraInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  managerEmail: string | null;
  contratti: number;
}

export function TeamsPanel({
  teams,
  maxTeams,
  leagueName,
  crea,
  modifica,
  rigenera,
  elimina,
  azzera,
}: {
  teams: SquadraInfo[];
  maxTeams: number;
  leagueName: string;
  crea: (prev: CredenzialiState, formData: FormData) => Promise<CredenzialiState>;
  modifica: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  rigenera: (teamId: string) => Promise<CredenzialiState>;
  elimina: (teamId: string) => Promise<ActionResult>;
  azzera: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [statoCrea, azioneCrea] = useActionState<CredenzialiState, FormData>(crea, { ok: true, message: "" });
  const [statoModifica, azioneModifica] = useActionState<ActionResult, FormData>(modifica, { ok: true, message: "" });
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [credenziali, setCredenziali] = useState<{ team: string; email: string; password: string } | null>(null);
  const [esito, setEsito] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Le credenziali arrivano dal risultato dell'azione, ma vanno tenute a schermo
  // anche dopo il ricaricamento della pagina che segue la creazione.
  const daMostrare = credenziali ?? statoCrea.credenziali ?? null;

  const mancanti = maxTeams - teams.length;
  const senzaManager = teams.filter((t) => !t.managerEmail).length;

  return (
    <section className="carta">
      <header style={{ padding: "12px 14px", borderBottom: "1px solid var(--bordo)" }}>
        <h2 style={{ fontSize: 15 }}>Squadre e manager</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>
          Art. 1.1 — {teams.length} su {maxTeams}
          {mancanti > 0 ? ` · ne mancano ${mancanti}` : " · lega al completo"}
          {senzaManager > 0 ? ` · ${senzaManager} senza manager` : ""}
        </p>
      </header>

      <div style={{ padding: 14, display: "grid", gap: 14 }}>
        {daMostrare && <Credenziali dati={daMostrare} onClose={() => setCredenziali(null)} />}
        {esito && <Result result={esito} />}

        {teams.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--inchiostro-medio)" }}>
            Nessuna squadra iscritta. Aggiungile qui sotto una alla volta: ognuna nasce con la
            dotazione iniziale, lo stadio a livello zero, il settore giovanile e le sue scelte al
            draft. Le rose si formano all&apos;asta di settembre.
          </p>
        ) : (
          <table className="griglia">
            <thead>
              <tr>
                <th>Squadra</th>
                <th>Manager</th>
                <th style={{ textAlign: "right" }}>Rosa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: t.color,
                        marginRight: 8,
                      }}
                    />
                    <strong style={{ fontWeight: 550 }}>{t.name}</strong>
                    <span style={{ color: "var(--inchiostro-tenue)", marginLeft: 6, fontSize: 12 }}>{t.shortName}</span>
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {t.managerEmail ?? <span style={{ color: "var(--avviso)" }}>nessuno</span>}
                  </td>
                  <td style={{ textAlign: "right", fontSize: 12.5 }}>{t.contratti}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="bottone"
                      onClick={() => setInModifica(inModifica === t.id ? null : t.id)}
                    >
                      {inModifica === t.id ? "Chiudi" : "Modifica"}
                    </button>{" "}
                    <button
                      type="button"
                      className="bottone"
                      disabled={pending || !t.managerEmail}
                      title={t.managerEmail ? "Genera una password nuova" : "Questa squadra non ha un manager"}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await rigenera(t.id);
                          setEsito(r.ok ? null : r);
                          if (r.credenziali) setCredenziali(r.credenziali);
                          router.refresh();
                        })
                      }
                    >
                      Password
                    </button>{" "}
                    <button
                      type="button"
                      className="bottone bottone-pericolo"
                      disabled={pending || t.contratti > 0}
                      title={t.contratti > 0 ? "Ha giocatori sotto contratto" : "Ritira la squadra dalla lega"}
                      onClick={() => {
                        if (!window.confirm(`Ritirare ${t.name} dalla lega? L'accesso del suo manager viene cancellato.`)) return;
                        startTransition(async () => {
                          setEsito(await elimina(t.id));
                          router.refresh();
                        });
                      }}
                    >
                      Ritira
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {inModifica && (
          <form action={azioneModifica} style={{ display: "grid", gap: 10, padding: 12, border: "1px solid var(--bordo)", borderRadius: 10 }}>
            <input type="hidden" name="teamId" value={inModifica} />
            {(() => {
              const t = teams.find((x) => x.id === inModifica);
              if (!t) return null;
              return (
                <>
                  <strong style={{ fontSize: 13.5 }}>Modifica {t.name}</strong>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
                    <div>
                      <label className="etichetta" htmlFor="m-name">Nome</label>
                      <input id="m-name" name="name" className="campo" defaultValue={t.name} required />
                    </div>
                    <div>
                      <label className="etichetta" htmlFor="m-short">Sigla</label>
                      <input id="m-short" name="shortName" className="campo" defaultValue={t.shortName} maxLength={4} required />
                    </div>
                    <div>
                      <label className="etichetta" htmlFor="m-color">Colore</label>
                      <input id="m-color" name="color" type="color" className="campo" defaultValue={t.color} />
                    </div>
                  </div>
                  <div>
                    <label className="etichetta" htmlFor="m-email">Indirizzo del manager</label>
                    <input id="m-email" name="managerEmail" type="email" className="campo" defaultValue={t.managerEmail ?? ""} required />
                  </div>
                  {statoModifica.message && <Result result={statoModifica} />}
                  <Submit label="Salva" />
                </>
              );
            })()}
          </form>
        )}

        {mancanti > 0 && (
          <form action={azioneCrea} style={{ display: "grid", gap: 10, padding: 12, border: "1px dashed var(--bordo)", borderRadius: 10 }}>
            <strong style={{ fontSize: 13.5 }}>Iscrivi una squadra</strong>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
              <div>
                <label className="etichetta" htmlFor="c-name">Nome</label>
                <input id="c-name" name="name" className="campo" placeholder="Real Marasca" required />
              </div>
              <div>
                <label className="etichetta" htmlFor="c-short">Sigla</label>
                <input id="c-short" name="shortName" className="campo" placeholder="MRS" maxLength={4} required />
              </div>
              <div>
                <label className="etichetta" htmlFor="c-color">Colore</label>
                <input id="c-color" name="color" type="color" className="campo" defaultValue={COLORI[teams.length % COLORI.length]} />
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label className="etichetta" htmlFor="c-email">Indirizzo del manager</label>
                <input id="c-email" name="managerEmail" type="email" className="campo" placeholder="nome@esempio.it" required />
              </div>
              <div>
                <label className="etichetta" htmlFor="c-manager">Nome del manager</label>
                <input id="c-manager" name="managerName" className="campo" placeholder="facoltativo" />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--inchiostro-tenue)" }}>
              La password si genera qui e si vede una volta sola.
            </p>
            {statoCrea.message && !statoCrea.credenziali && <Result result={statoCrea} />}
            <Submit label="Iscrivi la squadra" />
          </form>
        )}

        <details>
          <summary style={{ fontSize: 12.5, color: "var(--inchiostro-tenue)", cursor: "pointer" }}>
            Ripartire da zero
          </summary>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--inchiostro-medio)" }}>
              Toglie tutte le squadre, i loro manager, i contratti e il capitale, e rimette in
              circolazione tutti i giocatori. Restano la stagione, il listone, le finestre, le
              competizioni e il tuo accesso. Serve se la lega è partita con dati che non erano
              quelli veri; quello che cancella non torna.
            </p>
            <AzzeraForm leagueName={leagueName} azzera={azzera} />
          </div>
        </details>
      </div>
    </section>
  );
}

function AzzeraSubmit({ attivo }: { attivo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="bottone bottone-pericolo" disabled={pending || !attivo}>
      {pending ? "In corso…" : "Azzera la lega"}
    </button>
  );
}

/**
 * Un modulo vero, non un pulsante: così l'azzeramento resta raggiungibile anche
 * se il JavaScript non è partito. Il nome da riscrivere è la sola protezione,
 * ed è voluta — quello che questa operazione cancella non torna.
 */
function AzzeraForm({
  leagueName,
  azzera,
}: {
  leagueName: string;
  azzera: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [stato, azione] = useActionState<ActionResult, FormData>(azzera, { ok: true, message: "" });
  const [conferma, setConferma] = useState("");

  return (
    <form action={azione} style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label className="etichetta" htmlFor="conferma">
            Scrivi «{leagueName}» per confermare
          </label>
          <input
            id="conferma"
            name="conferma"
            className="campo"
            value={conferma}
            onChange={(e) => setConferma(e.target.value)}
            placeholder={leagueName}
            autoComplete="off"
          />
        </div>
        <AzzeraSubmit attivo={conferma.trim().toLowerCase() === leagueName.toLowerCase()} />
      </div>
      {stato.message && <Result result={stato} />}
    </form>
  );
}
