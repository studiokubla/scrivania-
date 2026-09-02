import Link from "next/link";

import { CapBar, Card, Empty, Money$, Stat } from "@/components/ui";
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
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="occhiello">Panoramica</div>
        <h1 style={{ fontSize: 26 }}>Stagione {season.label}</h1>
      </div>

      <Card>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <Stat label="Squadre" value={rows.length} />
          <Stat
            label="Monte ingaggi della lega"
            value={formatMoney(totalCommitted)}
            hint={`su ${formatMoney(cap * rows.length)} disponibili`}
          />
          <Stat label="Capitale complessivo" value={formatMoney(totalCapital)} />
          <Stat label="Svincolati" value={freeAgents} hint="giocatori senza contratto" />
          <Stat
            label="Finestra di mercato"
            value={openWindow ? openWindow.label.replace("Finestra di ", "") : "Chiusa"}
            tone={openWindow ? "positivo" : "neutro"}
            hint={openWindow ? "aperta" : "nessuna sessione attiva"}
          />
        </div>
      </Card>

      <Card
        title="Le squadre"
        subtitle="Ordinate per monte ingaggi. Chi spende meno oggi ha più margine per il mercato di domani."
        padded={false}
      >
        <div className="scorre">
          <table className="griglia">
            <thead>
              <tr>
                <th>Squadra</th>
                <th>Manager</th>
                <th className="num">Rosa</th>
                <th className="num">Plur.</th>
                <th className="num">Ingaggi</th>
                <th className="num">Spazio</th>
                <th className="num">Capitale</th>
                <th className="num">Stadio</th>
                <th style={{ width: 120 }}>Tetto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id}>
                  <td>
                    <Link href={`/squadra/${r.team.id}`} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                      <span style={{ width: 4, height: 16, borderRadius: 2, background: r.team.color, flexShrink: 0 }} />
                      {r.team.name}
                      {session.teamId === r.team.id && (
                        <span style={{ fontSize: 11, color: "var(--inchiostro-tenue)", fontWeight: 500 }}>tu</span>
                      )}
                    </Link>
                  </td>
                  <td style={{ color: "var(--inchiostro-tenue)", fontSize: 12.5 }}>{r.team.manager?.name ?? "—"}</td>
                  <td className="num">{r.players}</td>
                  <td className="num">{r.multiYear}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{formatMoney(r.committed)}</td>
                  <td className="num" style={{ color: r.space < 0 ? "var(--allarme)" : "var(--positivo)" }}>
                    {formatMoney(r.space)}
                  </td>
                  <td className="num">{formatMoney(r.capital)}</td>
                  <td className="num" style={{ color: r.stadium === 0 ? "var(--inchiostro-tenue)" : undefined }}>
                    {r.stadium === 0 ? "—" : `liv. ${r.stadium}`}
                  </td>
                  <td>
                    <CapBar committed={r.committed} deadCap={0} cap={cap} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Card title="Calendario del mercato" subtitle="Art. 7" padded={false}>
          <table className="griglia">
            <tbody>
              {windows.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 550 }}>{w.label}</td>
                  <td style={{ color: "var(--inchiostro-tenue)", fontSize: 12.5 }}>
                    {w.opensAt.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} –{" "}
                    {w.closesAt.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                  </td>
                  <td className="num">
                    {w.status === "OPEN" ? (
                      <span className="tag tag-positivo">aperta</span>
                    ) : w.status === "CLOSED" ? (
                      <span className="tag tag-neutro">chiusa</span>
                    ) : (
                      <span className="tag tag-neutro">in programma</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card
          title="Ultime operazioni"
          subtitle="Art. 22 — registro pubblico"
          action={
            <Link href="/registro" className="bottone" style={{ padding: "5px 10px", fontSize: 12 }}>
              Tutto il registro
            </Link>
          }
          padded={false}
        >
          {recentAudit.length === 0 ? (
            <Empty>Nessuna operazione registrata in questa stagione.</Empty>
          ) : (
            <table className="griglia">
              <tbody>
                {recentAudit.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12.5 }}>{a.summary}</td>
                    <td className="num" style={{ color: "var(--inchiostro-tenue)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {a.createdAt.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Il regolamento in cifre" subtitle="Art. 3, 6 e 14 — i parametri che il motore applica a ogni operazione">
        <div
          style={{
            display: "grid",
            gap: "10px 22px",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            fontSize: 13,
          }}
        >
          {[
            ["Tetto salariale", formatMoney(cap)],
            ["Rosa", `${ruleset.roster.minPlayers}–${ruleset.roster.maxPlayers} giocatori`],
            ["Contratti pluriennali", `max ${ruleset.roster.maxMultiYearContracts}`],
            ["Rilancio minimo", formatMoney(fromMillions(ruleset.roster.minRaise))],
            ["Team Option", `${ruleset.options.teamOption.perSeason}/stagione, +${Math.round((ruleset.options.teamOption.rate - 1) * 100)}%`],
            ["Franchise Tag", `${ruleset.options.franchiseTag.perSeason}/stagione`],
            ["Dead cap dopo buy-out", `${Math.round(ruleset.buyout.deadCapRate * 100)}%`],
            ["Waiver", `${ruleset.market.waiverHours} ore`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "var(--inchiostro-tenue)" }}>{label}</span>
              <strong className="cifre">{value}</strong>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
