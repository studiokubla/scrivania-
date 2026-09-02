import Link from "next/link";

import { Card, ContractTag, Empty, Money$, RoleBadge, Stat, Tag } from "@/components/ui";
import { ActionButton, Countdown, OfferForm, type FreeAgent } from "./client";
import { buyoutContract, exerciseTeamOption, applyFranchiseTag } from "@/app/actions/contracts";
import { claimWaiver, resolveDueOffers, resolveDueWaivers, submitFreeAgencyOffer } from "@/app/actions/market";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeagueContext, getOptionCounters, getTeamState } from "@/lib/league";
import { formatMoney, fromDecimal, fromMillions } from "@/lib/money";
import { quoteBuyout } from "@/lib/rules/buyout";
import { ageAtSeason, salaryInYear } from "@/lib/rules/contracts";

export const dynamic = "force-dynamic";

export default async function MercatoPage() {
  const session = await requireSession();
  const { ruleset, season, currentYear } = await getLeagueContext();

  // Le scadenze si risolvono quando qualcuno guarda il mercato: per dieci manager
  // basta, e l'esito dipende solo da `closesAt`, non da chi apre la pagina.
  await Promise.all([resolveDueOffers(), resolveDueWaivers()]);

  const [openWindow, contests, waivers, myState] = await Promise.all([
    db.marketWindow.findFirst({ where: { seasonId: season.id, status: "OPEN" } }),
    db.marketOffer.findMany({
      where: { kind: "FREE_AGENCY", status: { in: ["SEALED", "REVEALED"] } },
      include: { player: { select: { id: true, name: true, role: true, serieATeam: true } } },
      orderBy: { closesAt: "asc" },
    }),
    db.waiverClaim.findMany({
      where: { seasonId: season.id, status: "PENDING" },
      include: { player: { select: { id: true, name: true, role: true } }, team: { select: { name: true } } },
      orderBy: { closesAt: "asc" },
    }),
    session.teamId
      ? getTeamState({ teamId: session.teamId, seasonId: season.id, currentYear, ruleset })
      : null,
  ]);

  const counters = session.teamId ? await getOptionCounters(session.teamId, season.id) : null;

  // Svincolati: giocatori senza contratto attivo. Si carica un elenco leggero
  // perché la ricerca avviene lato client durante l'asta e il mercato.
  const freeAgentRows = await db.player.findMany({
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
  });

  const contestByPlayer = new Map<string, { closesAt: Date; count: number }>();
  for (const c of contests) {
    const entry = contestByPlayer.get(c.playerId) ?? { closesAt: c.closesAt, count: 0 };
    entry.count += 1;
    contestByPlayer.set(c.playerId, entry);
  }

  const freeAgents: FreeAgent[] = freeAgentRows.map((p) => {
    const contest = contestByPlayer.get(p.id);
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      serieATeam: p.serieATeam,
      quotation: p.seasons[0]?.quotationCurrent ? Number(p.seasons[0].quotationCurrent) : null,
      age: ageAtSeason(p.birthDate, currentYear, ruleset),
      contestClosesAt: contest ? contest.closesAt.toISOString() : null,
      contestOffers: contest?.count ?? 0,
    };
  });

  const contestList = [...contestByPlayer.entries()].map(([playerId, info]) => {
    const offer = contests.find((c) => c.playerId === playerId)!;
    return { playerId, player: offer.player, closesAt: info.closesAt, count: info.count };
  });

  // I miei contratti in scadenza: è qui che si decide Team Option e Franchise Tag
  const expiring = (myState?.contracts ?? []).filter(
    (c) => c.status === "ACTIVE" && c.endYear === currentYear,
  );

  const offersLeft = counters
    ? Math.max(0, ruleset.options.freeAgencyOffers.perSeason - counters.FREE_AGENCY_OFFER)
    : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="occhiello">Sala mercato</div>
          <h1 style={{ fontSize: 26 }}>{openWindow ? openWindow.label : "Mercato chiuso"}</h1>
        </div>
        <Link href="/mercato/scambi" className="bottone" style={{ marginLeft: "auto" }}>
          Scambi
        </Link>
      </div>

      {!openWindow && (
        <div className="avviso avviso-attenzione">
          Nessuna finestra aperta. Si possono consultare le contese in corso, ma non presentare
          offerte né concludere scambi (art. 7).
        </div>
      )}

      {myState && (
        <Card>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <Stat label="Spazio salariale" value={formatMoney(myState.capMatrix[0].space)} tone={myState.capMatrix[0].space < 0 ? "allarme" : "positivo"} />
            <Stat label="Capitale" value={formatMoney(myState.capital)} />
            <Stat label="Offerte rimaste" value={`${offersLeft}/${ruleset.options.freeAgencyOffers.perSeason}`} hint="free agency" />
            <Stat label="Posti in rosa" value={`${ruleset.roster.maxPlayers - myState.capMatrix[0].playerCount}`} hint={`su ${ruleset.roster.maxPlayers}`} />
            <Stat label="Slot pluriennali" value={myState.freeSlots} hint="liberi" />
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)" }}>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {/* ── Contese aperte ────────────────────────────────────────── */}
          <Card
            title="Contese aperte"
            subtitle="Le offerte restano sigillate fino allo scadere. Si vede chi è conteso, non a quanto."
            padded={false}
          >
            {contestList.length === 0 ? (
              <Empty>Nessuna contesa in corso.</Empty>
            ) : (
              <table className="griglia">
                <thead>
                  <tr>
                    <th style={{ width: 30 }} />
                    <th>Giocatore</th>
                    <th className="num">Offerte</th>
                    <th className="num">Si apre tra</th>
                  </tr>
                </thead>
                <tbody>
                  {contestList.map((c) => (
                    <tr key={c.playerId}>
                      <td>
                        <RoleBadge role={c.player.role} />
                      </td>
                      <td style={{ fontWeight: 550 }}>
                        {c.player.name}
                        <span style={{ color: "var(--inchiostro-tenue)", fontSize: 12, marginLeft: 6 }}>
                          {c.player.serieATeam}
                        </span>
                      </td>
                      <td className="num">{c.count}</td>
                      <td className="num">
                        <Countdown to={c.closesAt.toISOString()} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* ── Waiver ────────────────────────────────────────────────── */}
          <Card
            title="Waiver"
            subtitle={`48 ore prima che un giocatore svincolato diventi free agent. A parità di reclami vince la peggio classificata (art. 10).`}
            padded={false}
          >
            {waivers.length === 0 ? (
              <Empty>Nessun giocatore in waiver.</Empty>
            ) : (
              <table className="griglia">
                <thead>
                  <tr>
                    <th style={{ width: 30 }} />
                    <th>Giocatore</th>
                    <th>Reclami</th>
                    <th className="num">Scade tra</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {waivers.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <RoleBadge role={w.player.role} />
                      </td>
                      <td style={{ fontWeight: 550 }}>{w.player.name}</td>
                      <td style={{ fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>{w.team.name}</td>
                      <td className="num">
                        <Countdown to={w.closesAt.toISOString()} />
                      </td>
                      <td className="num">
                        {session.teamId && session.teamId !== w.teamId && (
                          <ActionButton
                            label="Reclama"
                            action={async () => {
                              "use server";
                              return claimWaiver(w.playerId);
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* ── Contratti in scadenza ─────────────────────────────────── */}
          {myState && (
            <Card
              title="I tuoi contratti in scadenza"
              subtitle="Qui si decide chi trattenere e come. Ogni scelta consuma un'opzione e si vede nel registro."
              padded={false}
            >
              {expiring.length === 0 ? (
                <Empty>Nessun contratto in scadenza in questa stagione.</Empty>
              ) : (
                <div className="scorre">
                  <table className="griglia">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }} />
                        <th>Giocatore</th>
                        <th>Contratto</th>
                        <th className="num">Ingaggio</th>
                        <th className="num">Costo svincolo</th>
                        <th style={{ width: 260 }}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiring.map((c) => {
                        const quote = quoteBuyout({ contract: c, currentYear, isPerformance: false, ruleset });
                        const multiYear = ruleset.contracts[c.type].occupiesSlot;
                        return (
                          <tr key={c.id}>
                            <td>
                              <RoleBadge role={c.role} />
                            </td>
                            <td style={{ fontWeight: 550 }}>{c.playerName}</td>
                            <td>
                              <ContractTag type={c.type} years={c.years} />
                            </td>
                            <td className="num">{formatMoney(salaryInYear(c.schedule, currentYear))}</td>
                            <td className="num" style={{ color: "var(--allarme)" }}>
                              {formatMoney(quote.penalty)}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {multiYear && (
                                  <ActionButton
                                    label="Team Option"
                                    title="Estende di un anno al +20% (art. 6.1)"
                                    action={async () => {
                                      "use server";
                                      return exerciseTeamOption(c.id);
                                    }}
                                  />
                                )}
                                <ActionButton
                                  label="Franchise Tag"
                                  title="Blinda il giocatore per una stagione al prezzo maggiore tra +20% e la media di ruolo (art. 6.2)"
                                  action={async () => {
                                    "use server";
                                    return applyFranchiseTag(c.id);
                                  }}
                                />
                                <ActionButton
                                  label="Svincola"
                                  variant="pericolo"
                                  confirm={`Svincolare ${c.playerName}? La penale di ${formatMoney(quote.penalty)} esce dal Capitale e resta ${formatMoney(quote.deadCap)} di dead cap fino a fine stagione. L'operazione non si annulla.`}
                                  action={async () => {
                                    "use server";
                                    return buyoutContract({ contractId: c.id, performance: false });
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ── Colonna offerte ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {session.teamId ? (
            <Card
              title="Presenta un'offerta"
              subtitle={`${offersLeft} offerte rimaste su ${ruleset.options.freeAgencyOffers.perSeason} (art. 9.1)`}
            >
              {openWindow ? (
                <OfferForm
                  players={freeAgents}
                  offersLeft={offersLeft}
                  submit={async (input) => {
                    "use server";
                    return submitFreeAgencyOffer(input);
                  }}
                />
              ) : (
                <Empty>Le offerte si presentano a finestra aperta.</Empty>
              )}
            </Card>
          ) : (
            <Card title="Commissioner">
              <p style={{ margin: 0, fontSize: 13, color: "var(--inchiostro-medio)" }}>
                Non hai una squadra e non puoi presentare offerte (art. 1.2). Dal{" "}
                <Link href="/admin" style={{ color: "var(--accento)", fontWeight: 600 }}>
                  pannello di amministrazione
                </Link>{" "}
                apri e chiudi le finestre, importi i dati e risolvi le contestazioni.
              </p>
            </Card>
          )}

          <Card title="Come funziona la free agency" subtitle="Art. 9">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "grid", gap: 7, color: "var(--inchiostro-medio)" }}>
              <li>Presenti un&apos;offerta: ingaggio, durata, tipo di contratto. Resta sigillata.</li>
              <li>
                Il registro annuncia che una contesa è aperta, senza l&apos;importo. Gli altri hanno{" "}
                {ruleset.market.freeAgencyHours} ore per rilanciare, anch&apos;essi in segreto.
              </li>
              <li>Allo scadere tutte le buste si aprono insieme e vince l&apos;offerta più alta.</li>
              <li>
                A parità: prima la durata maggiore, poi la <strong>squadra peggio classificata</strong>.
              </li>
            </ol>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--inchiostro-tenue)" }}>
              Rilanciare su una contesa aperta da altri non consuma una delle tue offerte.
            </p>
          </Card>

          <Card title="Svincolati" subtitle={`${freeAgents.length} giocatori senza contratto`}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["P", "D", "C", "A"] as const).map((role) => (
                <Tag key={role}>
                  {role} {freeAgents.filter((p) => p.role === role).length}
                </Tag>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
