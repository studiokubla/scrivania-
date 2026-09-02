import Link from "next/link";

import { Card, Empty, RoleBadge } from "@/components/ui";
import { ActionButton } from "../client";
import { TradeBuilder } from "./builder";
import { previewTrade, proposeTrade, respondToTrade, vetoTrade } from "@/app/actions/market";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeagueContext, getTeamContracts, toContractView } from "@/lib/league";
import { formatMoney, fromDecimal, toMillions } from "@/lib/money";
import { salaryInYear } from "@/lib/rules/contracts";

export const dynamic = "force-dynamic";

const STATO: Record<string, { label: string; tone: string }> = {
  PROPOSED: { label: "in attesa", tone: "tag-avviso" },
  ACCEPTED: { label: "accettato", tone: "tag-positivo" },
  EXECUTED: { label: "eseguito", tone: "tag-positivo" },
  REJECTED: { label: "rifiutato", tone: "tag-neutro" },
  EXPIRED: { label: "scaduto", tone: "tag-neutro" },
  WITHDRAWN: { label: "ritirato", tone: "tag-neutro" },
  VETOED: { label: "annullato", tone: "tag-allarme" },
};

export default async function ScambiPage() {
  const session = await requireSession();
  const { league, season, currentYear } = await getLeagueContext();

  // Le proposte scadute si chiudono da sole: 48 ore e la palla torna al proponente
  await db.trade.updateMany({
    where: { seasonId: season.id, status: "PROPOSED", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  const [teams, trades, myContracts] = await Promise.all([
    db.team.findMany({
      where: { leagueId: league.id, ...(session.teamId ? { id: { not: session.teamId } } : {}) },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.trade.findMany({
      where: { seasonId: season.id },
      include: {
        proposer: { select: { id: true, name: true, color: true } },
        receiver: { select: { id: true, name: true, color: true } },
        items: { include: { contract: { include: { player: { select: { name: true, role: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    session.teamId ? getTeamContracts(session.teamId) : Promise.resolve([]),
  ]);

  const otherRosters = await db.contract.findMany({
    where: {
      status: "ACTIVE",
      team: { leagueId: league.id, ...(session.teamId ? { id: { not: session.teamId } } : {}) },
    },
    include: { player: { select: { name: true, role: true } } },
    orderBy: { baseSalary: "desc" },
  });

  const rosterByTeam: Record<string, { id: string; name: string; role: string; salary: number; type: string; years: number }[]> = {};
  for (const row of otherRosters) {
    const view = toContractView(row);
    (rosterByTeam[row.teamId] ??= []).push({
      id: view.id,
      name: view.playerName,
      role: view.role,
      salary: toMillions(salaryInYear(view.schedule, currentYear)),
      type: view.type,
      years: view.years,
    });
  }

  const mine = myContracts
    .filter((c) => c.status === "ACTIVE")
    .map((c) => ({
      id: c.id,
      name: c.playerName,
      role: c.role,
      salary: toMillions(salaryInYear(c.schedule, currentYear)),
      type: c.type,
      years: c.years,
    }));

  const incoming = trades.filter((t) => t.receiverId === session.teamId && t.status === "PROPOSED");
  const others = trades.filter((t) => !(t.receiverId === session.teamId && t.status === "PROPOSED"));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="occhiello">Art. 11.1</div>
          <h1 style={{ fontSize: 26 }}>Scambi</h1>
          <p style={{ margin: "6px 0 0", color: "var(--inchiostro-medio)", fontSize: 13.5, maxWidth: 620 }}>
            Si scambiano giocatori con il loro contratto e capitale, mai spazio salariale. Il
            contratto viaggia intatto: non si può ristrutturare per alleggerirlo. Il sistema valida
            entrambe le rose prima di lasciar proporre lo scambio.
          </p>
        </div>
        <Link href="/mercato" className="bottone" style={{ marginLeft: "auto" }}>
          Torna al mercato
        </Link>
      </div>

      {incoming.length > 0 && (
        <Card title="Proposte ricevute" subtitle="Hai 48 ore per rispondere" padded={false}>
          <table className="griglia">
            <tbody>
              {incoming.map((t) => {
                const fromThem = t.items.filter((i) => i.fromTeamId === t.proposerId);
                const fromMe = t.items.filter((i) => i.fromTeamId === t.receiverId);
                return (
                  <tr key={t.id}>
                    <td style={{ verticalAlign: "top", minWidth: 200 }}>
                      <strong>{t.proposer.name}</strong>
                      <div style={{ fontSize: 12.5, color: "var(--inchiostro-tenue)", marginTop: 2 }}>
                        scade {t.expiresAt.toLocaleString("it-IT")}
                      </div>
                      {t.message && (
                        <p style={{ margin: "6px 0 0", fontSize: 12.5, fontStyle: "italic" }}>«{t.message}»</p>
                      )}
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <div className="occhiello">Ricevi</div>
                      <TradeSide items={fromThem} />
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <div className="occhiello">Cedi</div>
                      <TradeSide items={fromMe} />
                    </td>
                    <td style={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <ActionButton
                          label="Accetta"
                          variant="primario"
                          confirm="Accettare lo scambio? I contratti passano subito e il commissioner può annullarlo solo entro 24 ore."
                          action={async () => {
                            "use server";
                            return respondToTrade(t.id, true);
                          }}
                        />
                        <ActionButton
                          label="Rifiuta"
                          action={async () => {
                            "use server";
                            return respondToTrade(t.id, false);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {session.teamId && (
        <Card title="Proponi uno scambio" subtitle="Il controllo di tetto salariale e composizione rosa avviene su entrambe le squadre, anche sulle stagioni future">
          <TradeBuilder
            teams={teams}
            myRoster={mine}
            rosterByTeam={rosterByTeam}
            preview={async (input) => {
              "use server";
              const result = await previewTrade(input);
              if (!result) return null;
              return {
                ok: result.ok,
                errors: result.errors,
                warnings: result.warnings,
                effects: result.effects.map((e) => ({
                  teamId: e.teamId,
                  teamName: e.teamName,
                  salaryDelta: toMillions(e.salaryDelta),
                  playersBefore: e.playersBefore,
                  playersAfter: e.playersAfter,
                  capitalAfter: toMillions(e.capitalAfter),
                })),
              };
            }}
            submit={async (input) => {
              "use server";
              return proposeTrade(input);
            }}
          />
        </Card>
      )}

      <Card title="Storico degli scambi" subtitle="Art. 22 — tutto quello che si è mosso in questa stagione" padded={false}>
        {others.length === 0 ? (
          <Empty>Nessuno scambio registrato.</Empty>
        ) : (
          <div className="scorre">
            <table className="griglia">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Squadre</th>
                  <th>Oggetto</th>
                  <th>Stato</th>
                  {session.role === "COMMISSIONER" && <th />}
                </tr>
              </thead>
              <tbody>
                {others.map((t) => {
                  const stato = STATO[t.status] ?? { label: t.status, tone: "tag-neutro" };
                  const players = t.items
                    .filter((i) => i.kind === "PLAYER")
                    .map((i) => i.contract?.player.name)
                    .filter(Boolean);
                  const capital = t.items
                    .filter((i) => i.kind === "CAPITAL")
                    .reduce((a, i) => a + fromDecimal(i.capitalAmount), 0);
                  const vetoable =
                    t.status === "EXECUTED" && t.vetoableUntil && t.vetoableUntil > new Date();

                  return (
                    <tr key={t.id}>
                      <td className="cifre" style={{ whiteSpace: "nowrap", fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>
                        {t.createdAt.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {t.proposer.name} <span style={{ color: "var(--inchiostro-tenue)" }}>↔</span> {t.receiver.name}
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {players.length > 0 ? players.join(", ") : "—"}
                        {capital > 0 && <span style={{ color: "var(--inchiostro-tenue)" }}> · {formatMoney(capital)}</span>}
                      </td>
                      <td>
                        <span className={`tag ${stato.tone}`}>{stato.label}</span>
                        {t.vetoReason && (
                          <div style={{ fontSize: 12, color: "var(--allarme)", marginTop: 3 }}>{t.vetoReason}</div>
                        )}
                      </td>
                      {session.role === "COMMISSIONER" && (
                        <td className="num">
                          {vetoable && (
                            <form
                              action={async (formData: FormData) => {
                                "use server";
                                await vetoTrade(t.id, String(formData.get("reason") ?? ""));
                              }}
                              style={{ display: "flex", gap: 6 }}
                            >
                              <input
                                name="reason"
                                className="campo"
                                placeholder="Motivo dell'annullamento"
                                style={{ width: 200, fontSize: 12.5 }}
                                required
                                minLength={10}
                              />
                              <button className="bottone bottone-pericolo" style={{ fontSize: 12 }}>
                                Annulla
                              </button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function TradeSide({
  items,
}: {
  items: {
    id: string;
    kind: string;
    capitalAmount: unknown;
    contract: { player: { name: string; role: string } } | null;
  }[];
}) {
  if (items.length === 0) return <span style={{ color: "var(--inchiostro-tenue)", fontSize: 12.5 }}>niente</span>;
  return (
    <ul style={{ margin: "3px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 3 }}>
      {items.map((i) => (
        <li key={i.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          {i.kind === "PLAYER" && i.contract ? (
            <>
              <RoleBadge role={i.contract.player.role} />
              {i.contract.player.name}
            </>
          ) : (
            <span className="cifre">{formatMoney(fromDecimal(i.capitalAmount))} di capitale</span>
          )}
        </li>
      ))}
    </ul>
  );
}
