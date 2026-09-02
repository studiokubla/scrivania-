import { Card, Empty, Piega, Riga, RoleBadge, Tag, Tessera, TesseraGrande, Titolo } from "@/components/ui";
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
    <>
      <div style={{ padding: "6px 4px 2px" }}>
        <div className="occhiello">Art. 8</div>
        <h1>Sala d&apos;asta</h1>
      </div>

      {session.role === "COMMISSIONER" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      {!auction || auction.status === "SCHEDULED" ? (
        <Card padded={false}>
          <Empty>
            L&apos;asta non è ancora aperta.
            <br />
            Il commissioner estrae l&apos;ordine di chiamata e la avvia.
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

          {/* Durante un'asta la domanda è una sola: fin dove posso spingermi? */}
          {myState && (
            <>
              <TesseraGrande
                label={isMyTurn ? "Tocca a te — offerta massima" : "Offerta massima"}
                value={maxBid ? formatMoney(maxBid.maxAffordable) : "—"}
                hint={
                  maxBid
                    ? `Oltre non si può: ${formatMoney(maxBid.reserve)} restano riservati per completare la rosa (art. 8.6)`
                    : undefined
                }
                tinta={isMyTurn ? "menta" : "inchiostro"}
              />

              <div className="duetto">
                <Tessera
                  label="Spazio salariale"
                  value={formatMoney(myState.capMatrix[0].space)}
                  hint="sul tetto"
                  tinta="azzurro"
                />
                <Tessera
                  label="Rosa"
                  value={myState.capMatrix[0].playerCount}
                  hint={
                    myState.capMatrix[0].missingToMinimum > 0
                      ? `ne mancano ${myState.capMatrix[0].missingToMinimum}`
                      : "al minimo"
                  }
                  tinta="pesca"
                />
              </div>
            </>
          )}

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

          {/* ── Ordine di chiamata ─────────────────────────────────────── */}
          <Titolo>Ordine di chiamata</Titolo>
          <Card padded={false}>
            <div className="elenco">
              {auction.callOrder.map((id, i) => {
                const t = teamById.get(id);
                const passed = auction.passedTeams.includes(id);
                const isCurrent = id === currentCallerId;
                return (
                  <Riga
                    key={id}
                    icona={
                      <span
                        className="ruolo"
                        style={{ background: "var(--carta-alt)", color: "var(--inchiostro-tenue)" }}
                      >
                        {i + 1}
                      </span>
                    }
                    titolo={
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: isCurrent ? 800 : 650 }}>
                        <span
                          aria-hidden
                          style={{ width: 8, height: 20, borderRadius: 4, background: t?.color, flexShrink: 0 }}
                        />
                        {t?.name}
                      </span>
                    }
                    coda={passed ? <Tag>chiusa</Tag> : isCurrent ? <Tag tone="accento">chiama</Tag> : undefined}
                  />
                );
              })}
            </div>
          </Card>

          {/* ── Chiamate concluse ──────────────────────────────────────── */}
          <Titolo>Chiamate</Titolo>
          {lots.filter((l) => l.status === "ASSIGNED" || l.status === "VOIDED").length === 0 ? (
            <Card padded={false}>
              <Empty>Nessuna chiamata conclusa.</Empty>
            </Card>
          ) : (
            <Card padded={false}>
              <div className="elenco">
                {lots
                  .filter((l) => l.status === "ASSIGNED" || l.status === "VOIDED")
                  .map((l) => (
                    <Riga
                      key={l.id}
                      icona={<RoleBadge role={l.player.role} />}
                      titolo={l.player.name}
                      nota={
                        l.wonByTeamId
                          ? `a ${teamById.get(l.wonByTeamId)?.name} · chiamato da ${teamById.get(l.calledById)?.shortName}`
                          : `nessuno · chiamato da ${teamById.get(l.calledById)?.shortName}`
                      }
                      valore={l.winningAmount ? formatMoney(fromDecimal(l.winningAmount)) : "—"}
                      sottovalore={
                        l.bids
                          .filter((b) => fromDecimal(b.amount) > 0)
                          .sort((a, b) => fromDecimal(b.amount) - fromDecimal(a.amount))
                          .map((b) => `${b.team.shortName} ${toMillions(fromDecimal(b.amount))}`)
                          .join(" · ") || "nessuna offerta"
                      }
                    />
                  ))}
              </div>
            </Card>
          )}

          <Piega titolo="Come funziona una chiamata" nota="Art. 8">
            <ol
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 14,
                display: "grid",
                gap: 9,
                color: "var(--inchiostro-medio)",
                lineHeight: 1.45,
              }}
            >
              <li>Chi è di turno chiama un giocatore svincolato. La base è la sua quotazione.</li>
              <li>
                Tutti depositano un&apos;offerta a busta chiusa entro {auction.bidWindowSeconds} secondi. Chi non
                è interessato registra zero.
              </li>
              <li>Allo scadere le buste si aprono insieme: vince la più alta, e diventano tutte pubbliche.</li>
              <li>A parità si ripete la chiamata fra i soli pari merito.</li>
            </ol>
          </Piega>
        </>
      )}
    </>
  );
}
