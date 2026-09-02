import Link from "next/link";

import { Card, ContractTag, Empty, Piega, Riga, RoleBadge, Tessera, TesseraGrande, Titolo } from "@/components/ui";
import { ActionButton, Countdown, OfferForm, type FreeAgent } from "./client";
import { buyoutContract, exerciseTeamOption, applyFranchiseTag } from "@/app/actions/contracts";
import { claimWaiver, resolveDueOffers, resolveDueWaivers, submitFreeAgencyOffer } from "@/app/actions/market";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeagueContext, getOptionCounters, getTeamState } from "@/lib/league";
import { formatMoney } from "@/lib/money";
import { quoteBuyout } from "@/lib/rules/buyout";
import { etàAllaStagione, salaryInYear } from "@/lib/rules/contracts";

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
      birthDate: true, declaredAge: true, declaredAgeYear: true,
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
      age: etàAllaStagione(p, currentYear, ruleset),
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
    <>
      <div style={{ padding: "6px 4px 2px" }}>
        <div className="occhiello">Sala mercato</div>
        <h1>{openWindow ? openWindow.label : "Mercato chiuso"}</h1>
      </div>

      {!openWindow && (
        <div className="avviso avviso-attenzione">
          Nessuna finestra aperta. Si possono guardare le contese in corso, ma non presentare
          offerte né concludere scambi (art. 7).
        </div>
      )}

      {/* ── Cosa posso fare adesso ───────────────────────────────────────── */}
      {myState && (
        <>
          <TesseraGrande
            label="Offerte rimaste"
            value={`${offersLeft}`}
            hint={`su ${ruleset.options.freeAgencyOffers.perSeason} in questa stagione (art. 9.1). Rilanciare su una contesa aperta da altri non ne consuma.`}
            tinta={offersLeft === 0 ? "inchiostro" : "menta"}
          />

          <div className="duetto">
            <Tessera
              label="Spazio salariale"
              value={formatMoney(myState.capMatrix[0].space)}
              hint="da spendere"
              tinta="azzurro"
            />
            <Tessera label="Capitale" value={formatMoney(myState.capital)} hint="fondo societario" tinta="lilla" />
          </div>

          <div className="duetto">
            <Tessera
              label="Posti in rosa"
              value={ruleset.roster.maxPlayers - myState.capMatrix[0].playerCount}
              hint={`su ${ruleset.roster.maxPlayers}`}
              tinta="pesca"
            />
            <Tessera label="Slot pluriennali" value={myState.freeSlots} hint="liberi" tinta="rosa" />
          </div>
        </>
      )}

      {/* ── Presenta un'offerta ──────────────────────────────────────────── */}
      {session.teamId ? (
        <>
          <Titolo>Presenta un&apos;offerta</Titolo>
          <Card>
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
        </>
      ) : (
        <Card title="Sei il commissioner">
          <p style={{ margin: 0, fontSize: 14, color: "var(--inchiostro-medio)" }}>
            Non hai una squadra e non fai offerte (art. 1.2). Dal{" "}
            <Link href="/admin" style={{ color: "var(--accento)", fontWeight: 700 }}>
              pannello di gestione
            </Link>{" "}
            apri e chiudi le finestre, importi i dati e risolvi le contestazioni.
          </p>
        </Card>
      )}

      {/* ── Contese ──────────────────────────────────────────────────────── */}
      <Titolo>
        Contese aperte
        {contestList.length > 0 && <span className="tag tag-accento">{contestList.length}</span>}
      </Titolo>

      <Card padded={false}>
        {contestList.length === 0 ? (
          <Empty>
            Nessuna contesa in corso.
            <br />
            Le offerte restano sigillate: si vede chi è conteso, non a quanto.
          </Empty>
        ) : (
          <div className="elenco">
            {contestList.map((c) => (
              <Riga
                key={c.playerId}
                icona={<RoleBadge role={c.player.role} />}
                titolo={c.player.name}
                nota={`${c.player.serieATeam} · ${c.count} ${c.count === 1 ? "offerta" : "offerte"}`}
                valore={<Countdown to={c.closesAt.toISOString()} />}
                sottovalore="si apre tra"
              />
            ))}
          </div>
        )}
      </Card>

      {/* ── Waiver ───────────────────────────────────────────────────────── */}
      {waivers.length > 0 && (
        <>
          <Titolo>Waiver</Titolo>
          <Card padded={false}>
            <div className="elenco">
              {waivers.map((w) => (
                <Riga
                  key={w.id}
                  icona={<RoleBadge role={w.player.role} />}
                  titolo={w.player.name}
                  nota={`svincolato da ${w.team.name}`}
                  valore={<Countdown to={w.closesAt.toISOString()} />}
                  coda={
                    session.teamId && session.teamId !== w.teamId ? (
                      <ActionButton
                        label="Reclama"
                        action={async () => {
                          "use server";
                          return claimWaiver(w.playerId);
                        }}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ── Contratti in scadenza ────────────────────────────────────────── */}
      {myState && (
        <>
          <Titolo>I tuoi contratti in scadenza</Titolo>
          {expiring.length === 0 ? (
            <Card padded={false}>
              <Empty>Nessun contratto in scadenza in questa stagione.</Empty>
            </Card>
          ) : (
            expiring.map((c) => {
              const quote = quoteBuyout({ contract: c, currentYear, isPerformance: false, ruleset });
              const multiYear = ruleset.contracts[c.type].occupiesSlot;
              return (
                <Card key={c.id} padded={false}>
                  <div className="riga" style={{ borderBottom: "1px solid var(--bordo)" }}>
                    <RoleBadge role={c.role} />
                    <div className="riga-corpo">
                      <div className="riga-titolo">{c.playerName}</div>
                      <div className="riga-nota">
                        <ContractTag type={c.type} years={c.years} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="riga-valore">{formatMoney(salaryInYear(c.schedule, currentYear))}</div>
                      <div className="riga-nota" style={{ color: "var(--allarme)" }}>
                        svincolo {formatMoney(quote.penalty)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 14 }}>
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
                </Card>
              );
            })
          )}
        </>
      )}

      {/* ── Il resto ─────────────────────────────────────────────────────── */}
      <Titolo>Altro</Titolo>

      <Card padded={false}>
        <div className="elenco">
          <Riga href="/mercato/scambi" titolo="Scambi" nota="Proponi uno scambio a un'altra squadra" valore="›" />
        </div>
      </Card>

      <Piega titolo="Svincolati" nota={`${freeAgents.length} giocatori senza contratto`}>
        <div className="elenco">
          {(["P", "D", "C", "A"] as const).map((role) => (
            <Riga
              key={role}
              icona={<RoleBadge role={role} />}
              titolo={{ P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" }[role]}
              valore={freeAgents.filter((p) => p.role === role).length}
            />
          ))}
        </div>
      </Piega>

      <Piega titolo="Come funziona la free agency" nota="Art. 9">
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
      </Piega>
    </>
  );
}
