import { Card, Empty, RoleBadge, Stat, Tag } from "@/components/ui";
import { ActionButton } from "../mercato/client";
import { AuctionFloor, type CallablePlayer } from "./floor";
import {
  callPlayer,
  finishAuction,
  passAuctionTurn,
  pauseAuction,
  resolveDueLots,
  startAuction,
  submitAuctionBid,
} from "@/app/actions/auction";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeagueContext, getTeamState } from "@/lib/league";
import { formatMoney, fromDecimal, toMillions } from "@/lib/money";
import { basePriceFor } from "@/lib/rules/auction";
import { canAfford } from "@/lib/rules/cap";
import { ageAtSeason } from "@/lib/rules/contracts";

export const dynamic = "force-dynamic";

export default async function AstaPage() {
  const session = await requireSession();
  const { league, ruleset, season, currentYear } = await getLeagueContext();

  await resolveDueLots();

  const auction = await db.auction.findUnique({ where: { seasonId: season.id } });
  const teams = await db.team.findMany({
    where: { leagueId: league.id },
    select: { id: true, name: true, shortName: true, color: true },
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const lots = auction
    ? await db.auctionLot.findMany({
        where: { auctionId: auction.id },
        include: {
          player: { select: { name: true, role: true, serieATeam: true } },
          bids: { include: { team: { select: { name: true, shortName: true } } } },
        },
        orderBy: { sequence: "desc" },
        take: 40,
      })
    : [];

  const openLot = lots.find((l) => l.status === "OPEN" || l.status === "TIE_BREAK");
  const activeOrder = auction ? auction.callOrder.filter((id) => !auction.passedTeams.includes(id)) : [];
  const currentCallerId = activeOrder.length > 0 && auction ? activeOrder[auction.currentTurn % activeOrder.length] : null;

  const myState = session.teamId
    ? await getTeamState({ teamId: session.teamId, seasonId: season.id, currentYear, ruleset })
    : null;

  // Quanto posso offrire senza restare senza soldi per completare la rosa (art. 8.6)
  const maxBid = myState
    ? canAfford({ contracts: myState.contracts, year: currentYear, amount: 0, ruleset, enforceReserve: true })
    : null;

  const myBid = openLot && session.teamId
    ? openLot.bids.find((b) => b.teamId === session.teamId && b.round === openLot.tieBreakRound)
    : null;

  // Elenco leggero per la ricerca durante la chiamata
  const callable: CallablePlayer[] = (
    await db.player.findMany({
      where: { contracts: { none: { status: "ACTIVE" } } },
      select: {
        id: true,
        name: true,
        role: true,
        serieATeam: true,
        birthDate: true,
        seasons: { where: { seasonId: season.id }, select: { quotationCurrent: true } },
      },
      orderBy: { name: "asc" },
      take: 600,
    })
  ).map((p) => {
    const q = p.seasons[0]?.quotationCurrent ? Number(p.seasons[0].quotationCurrent) : 0;
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      serieATeam: p.serieATeam,
      quotation: q,
      age: ageAtSeason(p.birthDate, currentYear, ruleset),
      basePrice: toMillions(basePriceFor(q, ruleset)),
    };
  });

  const isMyTurn = Boolean(session.teamId && currentCallerId === session.teamId);
  const hasPassed = Boolean(session.teamId && auction?.passedTeams.includes(session.teamId));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="occhiello">Art. 8</div>
          <h1 style={{ fontSize: 26 }}>Sala d&apos;asta</h1>
        </div>
        {session.role === "COMMISSIONER" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(!auction || auction.status === "FINISHED" || auction.status === "SCHEDULED") && (
              <ActionButton
                label={auction?.status === "FINISHED" ? "Riapri e riestrai" : "Apri l'asta ed estrai l'ordine"}
                variant="primario"
                confirm="Estrarre l'ordine di chiamata e aprire l'asta?"
                action={async () => {
                  "use server";
                  return startAuction();
                }}
              />
            )}
            {auction?.status === "RUNNING" && (
              <>
                <ActionButton
                  label="Pausa"
                  action={async () => {
                    "use server";
                    return pauseAuction(true);
                  }}
                />
                <ActionButton
                  label="Chiudi l'asta"
                  variant="pericolo"
                  confirm="Chiudere l'asta?"
                  action={async () => {
                    "use server";
                    return finishAuction();
                  }}
                />
              </>
            )}
            {auction?.status === "PAUSED" && (
              <ActionButton
                label="Riprendi"
                variant="primario"
                action={async () => {
                  "use server";
                  return pauseAuction(false);
                }}
              />
            )}
          </div>
        )}
      </div>

      {!auction || auction.status === "SCHEDULED" ? (
        <Card>
          <Empty>
            L&apos;asta non è ancora aperta. Il commissioner estrae l&apos;ordine di chiamata e la avvia.
          </Empty>
        </Card>
      ) : (
        <>
          {auction.status === "PAUSED" && <div className="avviso avviso-attenzione">Asta in pausa.</div>}
          {auction.status === "FINISHED" && (
            <div className="avviso avviso-nota">
              Asta chiusa il {auction.finishedAt?.toLocaleString("it-IT")}. Qui sotto il riepilogo delle chiamate.
            </div>
          )}

          {myState && (
            <Card>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                <Stat label="Spazio salariale" value={formatMoney(myState.capMatrix[0].space)} />
                <Stat
                  label="Offerta massima"
                  value={maxBid ? formatMoney(maxBid.maxAffordable) : "—"}
                  hint={maxBid ? `riserva ${formatMoney(maxBid.reserve)} per la rosa minima` : undefined}
                  tone="avviso"
                />
                <Stat
                  label="Rosa"
                  value={myState.capMatrix[0].playerCount}
                  hint={`ne mancano ${myState.capMatrix[0].missingToMinimum} al minimo`}
                />
                <Stat label="Turno" value={isMyTurn ? "Tocca a te" : "Attendi"} tone={isMyTurn ? "positivo" : "neutro"} />
              </div>
            </Card>
          )}

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)" }}>
            <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <AuctionFloor
                status={auction.status}
                bidWindowSeconds={auction.bidWindowSeconds}
                isMyTurn={isMyTurn && !hasPassed}
                hasPassed={hasPassed}
                canParticipate={Boolean(session.teamId)}
                maxBidMillions={maxBid ? toMillions(maxBid.maxAffordable) : 0}
                callable={callable}
                lot={
                  openLot
                    ? {
                        id: openLot.id,
                        playerName: openLot.player.name,
                        role: openLot.player.role,
                        serieATeam: openLot.player.serieATeam,
                        basePrice: toMillions(fromDecimal(openLot.basePrice)),
                        closesAt: openLot.closesAt?.toISOString() ?? null,
                        calledBy: teamById.get(openLot.calledById)?.name ?? "—",
                        tieBreakRound: openLot.tieBreakRound,
                        bidsReceived: openLot.bids.filter((b) => b.round === openLot.tieBreakRound).length,
                        myBid: myBid ? toMillions(fromDecimal(myBid.amount)) : null,
                      }
                    : null
                }
                call={async (playerId: string) => {
                  "use server";
                  return callPlayer(playerId);
                }}
                bid={async (lotId: string, amount: number) => {
                  "use server";
                  return submitAuctionBid(lotId, amount);
                }}
                pass={async () => {
                  "use server";
                  return passAuctionTurn();
                }}
              />

              <Card title="Chiamate" subtitle="All'apertura di ogni busta tutte le offerte diventano pubbliche (art. 8.3)" padded={false}>
                {lots.filter((l) => l.status === "ASSIGNED" || l.status === "VOIDED").length === 0 ? (
                  <Empty>Nessuna chiamata conclusa.</Empty>
                ) : (
                  <div className="scorre">
                    <table className="griglia">
                      <thead>
                        <tr>
                          <th className="num">#</th>
                          <th style={{ width: 30 }} />
                          <th>Giocatore</th>
                          <th>Chiamato da</th>
                          <th>Aggiudicato a</th>
                          <th className="num">Prezzo</th>
                          <th>Offerte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lots
                          .filter((l) => l.status === "ASSIGNED" || l.status === "VOIDED")
                          .map((l) => (
                            <tr key={l.id}>
                              <td className="num" style={{ color: "var(--inchiostro-tenue)" }}>{l.sequence}</td>
                              <td>
                                <RoleBadge role={l.player.role} />
                              </td>
                              <td style={{ fontWeight: 550 }}>{l.player.name}</td>
                              <td style={{ fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>
                                {teamById.get(l.calledById)?.shortName}
                              </td>
                              <td>
                                {l.wonByTeamId ? (
                                  <strong>{teamById.get(l.wonByTeamId)?.name}</strong>
                                ) : (
                                  <span style={{ color: "var(--inchiostro-tenue)" }}>nessuno</span>
                                )}
                              </td>
                              <td className="num" style={{ fontWeight: 600 }}>
                                {l.winningAmount ? formatMoney(fromDecimal(l.winningAmount)) : "—"}
                              </td>
                              <td style={{ fontSize: 11.5, color: "var(--inchiostro-tenue)" }}>
                                {l.bids
                                  .filter((b) => fromDecimal(b.amount) > 0)
                                  .sort((a, b) => fromDecimal(b.amount) - fromDecimal(a.amount))
                                  .map((b) => `${b.team.shortName} ${toMillions(fromDecimal(b.amount))}`)
                                  .join(" · ") || "nessuna"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <Card title="Ordine di chiamata" subtitle="Estratto all'apertura (art. 8.1)" padded={false}>
              <table className="griglia">
                <tbody>
                  {auction.callOrder.map((id, i) => {
                    const t = teamById.get(id);
                    const passed = auction.passedTeams.includes(id);
                    const isCurrent = id === currentCallerId;
                    return (
                      <tr key={id} style={isCurrent ? { background: "var(--accento-tenue)" } : undefined}>
                        <td className="num" style={{ width: 28, color: "var(--inchiostro-tenue)" }}>
                          {i + 1}
                        </td>
                        <td style={{ fontWeight: isCurrent ? 700 : 500 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 3, height: 14, borderRadius: 2, background: t?.color }} />
                            {t?.name}
                          </span>
                        </td>
                        <td className="num">
                          {passed ? <Tag>chiusa</Tag> : isCurrent ? <Tag tone="accento">chiama</Tag> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
