import Link from "next/link";

import { CapBar, Card, Empty, Piega, Riga, Tessera, TesseraGrande, Titolo } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeagueContext } from "@/lib/league";
import { formatMoney, fromDecimal, fromMillions, sum } from "@/lib/money";
import { salaryInYear } from "@/lib/rules/contracts";
import { toContractView } from "@/lib/league";

export default async function LeaguePage() {
  const session = await requireSession();
  const { league, ruleset, season, currentYear } = await getLeagueContext();

  const teams = await db.team.findMany({
    where: { leagueId: league.id },
    include: {
      manager: { select: { name: true } },
      contracts: {
        where: { status: "ACTIVE" },
        include: { player: { select: { name: true, role: true } } },
      },
      capitalTx: { where: { seasonId: season.id }, select: { amount: true } },
      stadiums: { where: { seasonId: season.id }, select: { level: true } },
    },
    orderBy: { name: "asc" },
  });

  const cap = fromMillions(ruleset.roster.salaryCap);

  const rows = teams
    .map((t) => {
      const contracts = t.contracts.map(toContractView);
      const inSeason = contracts.filter((c) => c.schedule.some((r) => r.year === currentYear));
      const committed = sum(inSeason.map((c) => salaryInYear(c.schedule, currentYear)));
      const capital = sum(t.capitalTx.map((x) => fromDecimal(x.amount)));
      const multiYear = inSeason.filter((c) => ruleset.contracts[c.type].occupiesSlot).length;
      return {
        team: t,
        players: inSeason.length,
        committed,
        space: cap - committed,
        capital,
        multiYear,
        stadium: t.stadiums[0]?.level ?? 0,
      };
    })
    .sort((a, b) => b.committed - a.committed);

  const [windows, recentAudit, freeAgents] = await Promise.all([
    db.marketWindow.findMany({ where: { seasonId: season.id }, orderBy: { opensAt: "asc" } }),
    db.auditEntry.findMany({ where: { seasonId: season.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.player.count({ where: { contracts: { none: { status: "ACTIVE" } } } }),
  ]);

  const openWindow = windows.find((w) => w.status === "OPEN");
  const totalCommitted = sum(rows.map((r) => r.committed));
  const totalCapital = sum(rows.map((r) => r.capital));

  return (
    <>
      <div style={{ padding: "6px 4px 2px" }}>
        <div className="occhiello">Panoramica</div>
        <h1>Stagione {season.label}</h1>
      </div>

      {/* La finestra di mercato è l'informazione che cambia il comportamento:
          se è aperta si può fare qualcosa, se è chiusa no. Sta in cima e grande. */}
      <TesseraGrande
        label="Finestra di mercato"
        value={openWindow ? openWindow.label.replace("Finestra di ", "") : "Chiusa"}
        hint={
          openWindow
            ? `Aperta fino al ${openWindow.closesAt.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`
            : "Nessuna sessione attiva in questo momento"
        }
        tinta={openWindow ? "menta" : "inchiostro"}
      />

      <div className="duetto">
        <Tessera label="Svincolati" value={freeAgents} hint="giocatori liberi" tinta="pesca" />
        <Tessera label="Squadre" value={rows.length} hint={`su ${ruleset.governance.teams}`} tinta="azzurro" />
      </div>

      {/* ── Le squadre ─────────────────────────────────────────────────── */}
      <Titolo>Le squadre</Titolo>

      {rows.length === 0 ? (
        <Card padded={false}>
          <Empty>
            Nessuna squadra iscritta.
            <br />
            Le iscrive il commissioner dal pannello di gestione.
          </Empty>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="elenco">
            {rows.map((r) => (
              <Riga
                key={r.team.id}
                href={`/squadra/${r.team.id}`}
                icona={
                  <span
                    aria-hidden
                    style={{ width: 10, height: 28, borderRadius: 5, background: r.team.color, flexShrink: 0 }}
                  />
                }
                titolo={
                  <>
                    {r.team.name}
                    {session.teamId === r.team.id && (
                      <span className="tag tag-accento" style={{ marginLeft: 8 }}>
                        tu
                      </span>
                    )}
                  </>
                }
                nota={`${r.players} giocatori · ${r.team.manager?.name ?? "senza manager"}`}
                valore={formatMoney(r.space)}
                sottovalore="di spazio"
              />
            ))}
          </div>
        </Card>
      )}

      {/* ── Il dettaglio ───────────────────────────────────────────────── */}
      <Titolo>Dettaglio</Titolo>

      <Piega titolo="Chi ha speso quanto" nota="Ordinate per monte ingaggi">
        {rows.length === 0 ? (
          <Empty>Ancora nessuna squadra.</Empty>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {rows.map((r) => (
              <div key={r.team.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                  <span style={{ fontWeight: 650, fontSize: 14 }}>{r.team.name}</span>
                  <span className="cifre" style={{ fontWeight: 700, fontSize: 14 }}>
                    {formatMoney(r.committed)}
                  </span>
                </div>
                <CapBar committed={r.committed} deadCap={0} cap={cap} />
              </div>
            ))}
          </div>
        )}
        <p className="didascalia" style={{ margin: "14px 0 0" }}>
          Monte ingaggi della lega {formatMoney(totalCommitted)} su {formatMoney(cap * Math.max(1, rows.length))}
          {" "}disponibili · capitale complessivo {formatMoney(totalCapital)}.
        </p>
      </Piega>

      <Piega titolo="Calendario del mercato" nota="Art. 7">
        <div className="elenco">
          {windows.map((w) => (
            <Riga
              key={w.id}
              titolo={w.label}
              nota={`${w.opensAt.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${w.closesAt.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`}
              coda={
                <span className={`tag ${w.status === "OPEN" ? "tag-positivo" : "tag-neutro"}`}>
                  {w.status === "OPEN" ? "aperta" : w.status === "CLOSED" ? "chiusa" : "in programma"}
                </span>
              }
            />
          ))}
        </div>
      </Piega>

      <Piega titolo="Ultime operazioni" nota="Art. 22 — registro pubblico">
        {recentAudit.length === 0 ? (
          <Empty>Nessuna operazione registrata in questa stagione.</Empty>
        ) : (
          <>
            <div className="elenco">
              {recentAudit.map((a) => (
                <Riga
                  key={a.id}
                  titolo={a.summary}
                  valore={a.createdAt.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                />
              ))}
            </div>
            <Link href="/registro" className="bottone bottone-largo" style={{ marginTop: 14 }}>
              Tutto il registro
            </Link>
          </>
        )}
      </Piega>

      <Piega titolo="Il regolamento in cifre" nota="I parametri che il motore applica a ogni operazione">
        <div className="elenco">
          {[
            ["Tetto salariale", formatMoney(cap)],
            ["Rosa", `${ruleset.roster.minPlayers}–${ruleset.roster.maxPlayers} giocatori`],
            ["Contratti pluriennali", `max ${ruleset.roster.maxMultiYearContracts}`],
            ["Rilancio minimo", formatMoney(fromMillions(ruleset.roster.minRaise))],
            [
              "Team Option",
              `${ruleset.options.teamOption.perSeason}/stagione, +${Math.round((ruleset.options.teamOption.rate - 1) * 100)}%`,
            ],
            ["Franchise Tag", `${ruleset.options.franchiseTag.perSeason}/stagione`],
            ["Dead cap dopo buy-out", `${Math.round(ruleset.buyout.deadCapRate * 100)}%`],
            ["Waiver", `${ruleset.market.waiverHours} ore`],
          ].map(([label, value]) => (
            <Riga key={label} titolo={label} valore={value} />
          ))}
        </div>
      </Piega>
    </>
  );
}
