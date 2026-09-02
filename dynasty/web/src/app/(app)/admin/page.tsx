import Link from "next/link";

import { Card, Empty, Stat, Tag } from "@/components/ui";
import { ActionButton } from "../mercato/client";
import { ImportPanel, StandingsEditor, TeamsPanel } from "./client";
import {
  applicaEtàDalListone,
  awardPrizes,
  azzeraLega,
  chargeStadiumMaintenance,
  creaSquadra,
  iscriviSquadreSegnaposto,
  eliminaSquadra,
  modificaSquadra,
  rigeneraPassword,
  runImport,
  setSeasonPhase,
  setStandings,
  setWindowStatus,
} from "@/app/actions/admin";
import { requireCommissioner } from "@/lib/auth";
import { verifyAuditChain } from "@/lib/audit";
import { db } from "@/lib/db";
import { getLeagueContext } from "@/lib/league";
import { TRANSFERMARKT_TEMPLATE } from "@/lib/import/transfermarkt";

export const dynamic = "force-dynamic";

const FASI = [
  { value: "PRESEASON" as const, label: "Precampionato", hint: "asta, draft, scelte societarie" },
  { value: "REGULAR" as const, label: "Stagione regolare", hint: "campionato e finestre di mercato" },
  { value: "POSTSEASON" as const, label: "Fine stagione", hint: "opzioni, rinnovi, bilancio" },
  { value: "ARCHIVED" as const, label: "Archiviata", hint: "sola lettura" },
];

export default async function AdminPage() {
  await requireCommissioner();
  const { league, ruleset, season } = await getLeagueContext();

  const [windows, competitions, teams, imports, chain, missingBirthDates, unmatchedRuns] = await Promise.all([
    db.marketWindow.findMany({ where: { seasonId: season.id }, orderBy: { opensAt: "asc" } }),
    db.competition.findMany({
      where: { seasonId: season.id },
      include: { standings: { orderBy: { position: "asc" }, include: { team: { select: { name: true } } } } },
      orderBy: { kind: "asc" },
    }),
    db.team.findMany({
      where: { leagueId: league.id },
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        manager: { select: { email: true } },
        _count: { select: { contracts: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.importRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    verifyAuditChain(season.id),
    db.player.count({ where: { birthDate: null, declaredAge: null, contracts: { some: { status: "ACTIVE" } } } }),
    db.importRun.findMany({ where: { status: "PARTIAL" }, orderBy: { createdAt: "desc" }, take: 1 }),
  ]);

  const lastUnmatched = (unmatchedRuns[0]?.unmatched ?? []) as { name: string; reason: string }[];

  // Quante età il listone potrebbe dare, per non proporre un pulsante inutile.
  const etàNelListone = (
    (await import("@/data/listone-2026-27.json")).default as unknown as { giocatori: { età?: number }[] }
  ).giocatori.filter((g) => typeof g.età === "number").length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="occhiello">Art. 1.2</div>
        <h1 style={{ fontSize: 26 }}>Amministrazione</h1>
        <p style={{ margin: "6px 0 0", color: "var(--inchiostro-medio)", fontSize: 13.5, maxWidth: 640 }}>
          Da qui si apre e si chiude il mercato, si importano i dati ufficiali e si versano i premi.
          Il commissioner non possiede una squadra e non fa offerte: è la ragione per cui le buste
          chiuse possono passare da qui senza conflitto d&apos;interesse.
        </p>
      </div>

      <Card>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          <Stat label="Stagione" value={season.label} hint={FASI.find((f) => f.value === season.phase)?.label} />
          <Stat label="Giornata importata" value={season.matchday} hint="su 38" />
          <Stat
            label="Registro"
            value={chain.valid ? "integro" : "alterato"}
            tone={chain.valid ? "positivo" : "allarme"}
            hint={`${chain.entries} operazioni`}
          />
          <Stat
            label="Età mancanti"
            value={missingBirthDates}
            tone={missingBirthDates > 0 ? "avviso" : "positivo"}
            hint="giocatori sotto contratto"
          />
        </div>
        {missingBirthDates > 0 && (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--avviso)" }}>
              Senza età non si firmano contratti Rookie e Veteran (art. 4.2) né si verifica
              l&apos;idoneità primavera (art. 16.1). Il listone ne porta {etàNelListone}: applicale
              qui, oppure importa le anagrafiche Transfermarkt per avere le date esatte.
            </p>
            <div>
              <ActionButton
                label="Applica le età del listone"
                variant="primario"
                action={async () => {
                  "use server";
                  return applicaEtàDalListone();
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* ── Squadre e manager ───────────────────────────────────────────── */}
      <TeamsPanel
        teams={teams.map((t) => ({
          id: t.id,
          name: t.name,
          shortName: t.shortName,
          color: t.color,
          managerEmail: t.manager?.email ?? null,
          contratti: t._count.contracts,
        }))}
        maxTeams={ruleset.governance.teams}
        leagueName={league.name}
        crea={creaSquadra}
        modifica={modificaSquadra}
        rigenera={rigeneraPassword}
        elimina={eliminaSquadra}
        azzera={azzeraLega}
        segnaposto={iscriviSquadreSegnaposto}
      />

      {/* ── Fase e finestre ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Card title="Fase della stagione" subtitle="Determina cosa è permesso: lo stadio si costruisce solo in precampionato (art. 15.1)">
          <div style={{ display: "grid", gap: 8 }}>
            {FASI.map((f) => (
              <div key={f.value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13.5 }}>{f.label}</strong>
                  <div style={{ fontSize: 12, color: "var(--inchiostro-tenue)" }}>{f.hint}</div>
                </div>
                {season.phase === f.value ? (
                  <Tag tone="accento">in corso</Tag>
                ) : (
                  <ActionButton
                    label="Attiva"
                    action={async () => {
                      "use server";
                      return setSeasonPhase(f.value);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Finestre di mercato" subtitle="Una sola aperta alla volta (art. 7)" padded={false}>
          <table className="griglia">
            <tbody>
              {windows.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 550 }}>
                    {w.label}
                    <div style={{ fontSize: 12, color: "var(--inchiostro-tenue)" }}>
                      {w.opensAt.toLocaleDateString("it-IT")} – {w.closesAt.toLocaleDateString("it-IT")}
                    </div>
                  </td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    {w.status === "OPEN" ? (
                      <ActionButton
                        label="Chiudi"
                        action={async () => {
                          "use server";
                          return setWindowStatus(w.id, "CLOSED");
                        }}
                      />
                    ) : (
                      <ActionButton
                        label="Apri"
                        variant="primario"
                        action={async () => {
                          "use server";
                          return setWindowStatus(w.id, "OPEN");
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ── Import ─────────────────────────────────────────────────────── */}
      <ImportPanel action={runImport} template={TRANSFERMARKT_TEMPLATE} currentMatchday={season.matchday} />

      {lastUnmatched.length > 0 && (
        <Card
          title="Righe non riconciliate"
          subtitle="Dall'ultimo import parziale. Vanno risolte a mano: un abbinamento indovinato manderebbe voti sul giocatore sbagliato."
          padded={false}
        >
          <div className="scorre" style={{ maxHeight: 260 }}>
            <table className="griglia">
              <thead>
                <tr>
                  <th>Nome nel file</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {lastUnmatched.slice(0, 60).map((u, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 550 }}>{u.name}</td>
                    <td style={{ fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>{u.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Storico degli import" subtitle="Art. 21.3 — chi ha importato cosa e quando" padded={false}>
        {imports.length === 0 ? (
          <Empty>Nessun import eseguito.</Empty>
        ) : (
          <div className="scorre">
            <table className="griglia">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Tipo</th>
                  <th>File</th>
                  <th className="num">Giornata</th>
                  <th className="num">Righe</th>
                  <th>Esito</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((r) => (
                  <tr key={r.id}>
                    <td className="cifre" style={{ fontSize: 12.5, color: "var(--inchiostro-tenue)", whiteSpace: "nowrap" }}>
                      {r.createdAt.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{r.kind}</td>
                    <td style={{ fontSize: 12.5 }}>{r.fileName}</td>
                    <td className="num">{r.matchday ?? "—"}</td>
                    <td className="num">
                      {r.rowsApplied}/{r.rowsRead}
                    </td>
                    <td>
                      <Tag
                        tone={
                          r.status === "COMPLETED" ? "positivo" : r.status === "PARTIAL" ? "avviso" : r.status === "FAILED" ? "allarme" : "neutro"
                        }
                      >
                        {r.status === "COMPLETED"
                          ? "completo"
                          : r.status === "PARTIAL"
                            ? "parziale"
                            : r.status === "FAILED"
                              ? "fallito"
                              : "in corso"}
                      </Tag>
                      {r.error && <div style={{ fontSize: 12, color: "var(--allarme)" }}>{r.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Competizioni e premi ────────────────────────────────────────── */}
      <Card
        title="Competizioni e premi"
        subtitle="Le partite si giocano su Leghe Fantacalcio: qui arriva l'ordine d'arrivo, da cui dipendono premi, lotteria del draft e spareggi di mercato."
      >
        <div style={{ display: "grid", gap: 18 }}>
          {competitions.map((c) => (
            <div key={c.id} data-competizione={c.kind} style={{ borderTop: "1px solid var(--bordo)", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <strong style={{ fontSize: 14.5 }}>{c.name}</strong>
                <Tag tone={c.status === "FINISHED" ? "positivo" : "neutro"}>
                  {c.status === "FINISHED" ? "premi versati" : c.standings.length > 0 ? "classifica registrata" : "da giocare"}
                </Tag>
                {c.standings.length > 0 && c.status !== "FINISHED" && (
                  <div style={{ marginLeft: "auto" }}>
                    <ActionButton
                      label="Versa i premi"
                      variant="primario"
                      confirm={`Versare i premi di ${c.name}? I milioni finiscono nel Capitale delle squadre e l'operazione si può fare una volta sola.`}
                      action={async () => {
                        "use server";
                        return awardPrizes(c.id);
                      }}
                    />
                  </div>
                )}
              </div>

              {c.standings.length > 0 ? (
                <ol style={{ margin: 0, paddingLeft: 20, columns: 2, fontSize: 13 }}>
                  {c.standings.map((s) => (
                    <li key={s.id}>{s.team.name}</li>
                  ))}
                </ol>
              ) : (
                <StandingsEditor
                  competitionId={c.id}
                  competitionName={c.name}
                  teams={teams}
                  save={async (input) => {
                    "use server";
                    return setStandings(input);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── Manutenzioni ───────────────────────────────────────────────── */}
      <Card
        title="Chiusura di bilancio"
        subtitle="Art. 15.3 — la manutenzione si addebita a inizio stagione; chi non la copre vede lo stadio scendere di un livello"
      >
        <ActionButton
          label="Addebita la manutenzione degli stadi"
          confirm="Addebitare la manutenzione annuale a tutte le squadre con uno stadio? Chi non ha capitale sufficiente perde un livello."
          action={async () => {
            "use server";
            return chargeStadiumMaintenance();
          }}
        />
      </Card>

      <Card title="Il regolamento in vigore" subtitle={`Versione ${ruleset.version}`}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--inchiostro-medio)" }}>
          I parametri applicati dal motore sono quelli salvati sulla lega. Il testo completo, con
          le motivazioni di ogni scelta, è in <code>docs/REGOLAMENTO.md</code>. Le modifiche
          numeriche si votano a fine stagione (art. 24) e si applicano cambiando la configurazione,
          non il codice.
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 13 }}>
          <Link href="/registro" style={{ color: "var(--accento)", fontWeight: 600 }}>
            Vai al registro pubblico
          </Link>
        </p>
      </Card>
    </div>
  );
}
