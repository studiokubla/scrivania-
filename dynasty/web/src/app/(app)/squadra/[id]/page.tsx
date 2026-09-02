import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CapBar,
  Card,
  ContractTag,
  Empty,
  Issues,
  Money$,
  OptionCounter,
  Piega,
  Riga,
  RoleBadge,
  Tessera,
  TesseraGrande,
  Titolo,
} from "@/components/ui";
import { SocietyPanel } from "./societa";
import { buildStadium, expandAcademy, sendScout, societyOptions } from "@/app/actions/societa";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeagueContext, getTeamState } from "@/lib/league";
import { formatMoney, fromDecimal, fromMillions } from "@/lib/money";
import { countByRole, validateRoster } from "@/lib/rules/cap";
import { salaryInYear } from "@/lib/rules/contracts";
import { stadiumTier } from "@/lib/rules/capital";
import type { PlayerRole } from "@/lib/rules/types";

/**
 * La scrivania di una squadra.
 *
 * La domanda che ci si fa aprendola è una sola — **quanto mi resta da spendere?**
 * — e quella è la cifra grande in cima. Tutto il resto è secondario e sta più in
 * basso, o dietro una piega.
 *
 * La rosa non è più una tabella a cinque colonne: su un telefono era illeggibile.
 * È un elenco raggruppato per ruolo, con il nome grande e l'ingaggio a destra.
 */

const NOME_RUOLO: Record<PlayerRole, string> = {
  P: "Portieri",
  D: "Difensori",
  C: "Centrocampisti",
  A: "Attaccanti",
};

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const { ruleset, season, currentYear } = await getLeagueContext();

  const team = await db.team.findUnique({ where: { id } });
  if (!team) notFound();

  const state = await getTeamState({ teamId: id, seasonId: season.id, currentYear, ruleset });
  const isMine = session.teamId === id;

  const [stadium, academy, scouts, youth, movements] = await Promise.all([
    db.stadium.findUnique({ where: { teamId_seasonId: { teamId: id, seasonId: season.id } } }),
    db.academy.findUnique({ where: { teamId_seasonId: { teamId: id, seasonId: season.id } } }),
    db.scout.findMany({ where: { teamId: id, seasonId: season.id }, orderBy: { investedAt: "asc" } }),
    db.youthPlayer.findMany({
      where: { teamId: id, status: "IN_ACADEMY" },
      include: { player: { select: { name: true, role: true, birthDate: true } } },
      orderBy: { draftPickNumber: "asc" },
    }),
    db.capitalTransaction.findMany({
      where: { teamId: id, seasonId: season.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const active = state.contracts.filter((c) => c.status === "ACTIVE");
  const inSeason = active.filter((c) => c.schedule.some((r) => r.year === currentYear));
  const roles = countByRole(inSeason);
  const rosterCheck = validateRoster({
    contracts: state.contracts,
    year: currentYear,
    ruleset,
    strict: season.phase !== "PRESEASON",
  });

  const current = state.capMatrix[0];
  const tier = stadium ? stadiumTier(stadium.level, ruleset) : null;
  const society = isMine ? await societyOptions(id) : null;

  const perRuolo = (["P", "D", "C", "A"] as PlayerRole[]).map((ruolo) => ({
    ruolo,
    giocatori: inSeason
      .filter((c) => c.role === ruolo)
      .sort((a, b) => salaryInYear(b.schedule, currentYear) - salaryInYear(a.schedule, currentYear)),
  }));

  const inScadenza = inSeason.filter((c) => c.endYear === currentYear).length;

  return (
    <>
      {/* ── Chi siamo ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 4px 2px" }}>
        <span
          aria-hidden
          style={{ width: 14, height: 14, borderRadius: 5, background: team.color, flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="occhiello">{isMine ? "La mia squadra" : "Squadra"}</div>
          <h1>{team.name}</h1>
        </div>
      </div>

      {(rosterCheck.errors.length > 0 || rosterCheck.warnings.length > 0) && (
        <Issues errors={rosterCheck.errors} warnings={rosterCheck.warnings} />
      )}

      {/* ── La cifra che conta ───────────────────────────────────────────── */}
      <TesseraGrande
        label="Spazio salariale"
        value={formatMoney(current.space)}
        hint={`${formatMoney(current.total)} di ingaggi su ${formatMoney(current.cap)} di tetto`}
      >
        <div style={{ marginTop: 14 }}>
          <CapBar committed={current.committed} deadCap={current.deadCap} cap={current.cap} />
        </div>
        {current.deadCap > 0 && (
          <p className="didascalia" style={{ margin: "8px 0 0", color: "var(--allarme)" }}>
            Di cui <Money$ value={current.deadCap} /> di dead cap da svincoli (art. 12.3).
          </p>
        )}
        {isMine && (
          <Link
            href="/mercato"
            className="bottone bottone-primario bottone-largo"
            style={{ marginTop: 16 }}
          >
            Vai al mercato
          </Link>
        )}
      </TesseraGrande>

      <div className="duetto">
        <Tessera
          label="Rosa"
          value={inSeason.length}
          hint={`${roles.P}P · ${roles.D}D · ${roles.C}C · ${roles.A}A`}
          tinta="azzurro"
        />
        <Tessera label="Capitale" value={formatMoney(state.capital)} hint="fondo societario" tinta="lilla" />
      </div>

      <div className="duetto">
        <Tessera
          label="Slot pluriennali"
          value={`${ruleset.roster.maxMultiYearContracts - state.freeSlots}/${ruleset.roster.maxMultiYearContracts}`}
          hint={state.freeSlots === 0 ? "nessuno libero" : `${state.freeSlots} liberi`}
          tinta="menta"
        />
        <Tessera
          label="In scadenza"
          value={inScadenza}
          hint={inScadenza === 1 ? "contratto a giugno" : "contratti a giugno"}
          tinta="pesca"
        />
      </div>

      {/* ── Rosa ─────────────────────────────────────────────────────────── */}
      <Titolo>Rosa</Titolo>

      {inSeason.length === 0 ? (
        <Card padded={false}>
          <Empty>
            Nessun giocatore sotto contratto.
            <br />
            La rosa si forma all&apos;asta di settembre.
          </Empty>
        </Card>
      ) : (
        perRuolo
          .filter((g) => g.giocatori.length > 0)
          .map(({ ruolo, giocatori }) => (
            <Card
              key={ruolo}
              title={NOME_RUOLO[ruolo]}
              subtitle={`${giocatori.length} · ${formatMoney(
                giocatori.reduce((s, c) => s + salaryInYear(c.schedule, currentYear), 0),
              )}`}
              padded={false}
            >
              <div className="elenco">
                {giocatori.map((c) => (
                  <Riga
                    key={c.id}
                    icona={<RoleBadge role={c.role} />}
                    titolo={c.playerName}
                    nota={<ContractTag type={c.type} years={c.years} />}
                    valore={formatMoney(salaryInYear(c.schedule, currentYear))}
                    sottovalore={
                      c.endYear === currentYear ? (
                        <span style={{ color: "var(--avviso)" }}>in scadenza</span>
                      ) : (
                        `fino al ${c.endYear}`
                      )
                    }
                  />
                ))}
              </div>
            </Card>
          ))
      )}

      {/* ── Il dettaglio, che si apre solo se lo si cerca ─────────────────── */}
      <Titolo>Dettaglio</Titolo>

      <Piega
        titolo="Proiezione del tetto"
        nota="Quanto pesano le firme di oggi nelle prossime stagioni"
      >
        <div className="scorre">
          <table className="griglia">
            <thead>
              <tr>
                <th>Stagione</th>
                <th className="num">Ingaggi</th>
                <th className="num">Spazio</th>
                <th className="num">Rosa</th>
              </tr>
            </thead>
            <tbody>
              {state.capMatrix.map((y) => (
                <tr key={y.year}>
                  <td style={{ fontWeight: 650 }}>
                    {y.label}
                    {y.year === currentYear && <span className="riga-nota"> in corso</span>}
                  </td>
                  <td className="num">{formatMoney(y.total)}</td>
                  <td className="num" style={{ color: y.space < 0 ? "var(--allarme)" : "var(--positivo)", fontWeight: 650 }}>
                    {formatMoney(y.space)}
                  </td>
                  <td className="num">{y.playerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="didascalia" style={{ margin: "12px 0 0" }}>
          Le stagioni future mostrano solo i contratti già firmati: lo spazio che appare libero è lo
          spazio con cui costruire le rose successive, non un avanzo.
        </p>
      </Piega>

      <Piega titolo="Opzioni disponibili" nota="Si azzerano il 1° luglio">
        <OptionCounter label="Team Option" article="art. 6.1" used={state.counters.TEAM_OPTION} total={ruleset.options.teamOption.perSeason} />
        <OptionCounter label="Franchise Tag" article="art. 6.2" used={state.counters.FRANCHISE_TAG} total={ruleset.options.franchiseTag.perSeason} />
        <OptionCounter label="Performance buy-out" article="art. 12.4" used={state.counters.PERFORMANCE_BUYOUT} total={ruleset.options.performanceBuyout.perSeason} />
        <OptionCounter label="Offerte free agency" article="art. 9.1" used={state.counters.FREE_AGENCY_OFFER} total={ruleset.options.freeAgencyOffers.perSeason} />
        <OptionCounter label="Pre-contract" article="art. 11.2" used={state.counters.PRE_CONTRACT} total={ruleset.options.preContract.perSeason} />
        <OptionCounter label="Contratti tampone" article="art. 4.4" used={state.counters.TAMPONE} total={ruleset.contracts.TAMPONE.maxPerSeason} />
      </Piega>

      <Piega
        titolo="Società"
        nota={`${tier ? tier.name : "Nessuno stadio"} · ${youth.length}/${academy?.capacity ?? ruleset.youth.baseCapacity} giovani · ${scouts.length} osservatori`}
      >
        <div className="elenco">
          <Riga
            titolo="Stadio"
            nota={tier ? `Manutenzione ${formatMoney(tier.maintenance)} l'anno` : "Non costruito"}
            valore={tier ? `Livello ${tier.level}` : "—"}
          />
          <Riga
            titolo="Settore giovanile"
            valore={`${youth.length}/${academy?.capacity ?? ruleset.youth.baseCapacity}`}
            sottovalore="posti"
          />
          <Riga
            titolo="Osservatori"
            nota={scouts.map((s) => s.club ?? s.league).join(" · ") || undefined}
            valore={scouts.length}
          />
        </div>
      </Piega>

      <Piega titolo="Movimenti di capitale" nota={`Saldo ${formatMoney(state.capital)}`}>
        {movements.length === 0 ? (
          <Empty>Nessun movimento.</Empty>
        ) : (
          <div className="elenco">
            {movements.map((m) => {
              const amount = fromDecimal(m.amount);
              return (
                <Riga
                  key={m.id}
                  titolo={m.description}
                  valore={
                    <span style={{ color: amount >= 0 ? "var(--positivo)" : "var(--allarme)" }}>
                      {formatMoney(amount, { sign: true })}
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </Piega>

      {youth.length > 0 && (
        <Piega
          titolo="Settore giovanile"
          nota="Non percepiscono ingaggio finché non vengono promossi (art. 16.3)"
        >
          <div className="elenco">
            {youth.map((y) => (
              <Riga
                key={y.id}
                icona={<RoleBadge role={y.player.role} />}
                titolo={y.player.name}
                nota={`Chiamata #${y.draftPickNumber}`}
                valore={formatMoney(
                  fromMillions(
                    ruleset.youth.promotionSalaryByPick.find((t) => y.draftPickNumber <= t.maxPick)?.salary ?? 0.25,
                  ),
                )}
                sottovalore="alla promozione"
              />
            ))}
          </div>
        </Piega>
      )}

      {society && (
        <>
          <Titolo>Investimenti</Titolo>
          <SocietyPanel
            teamId={id}
            capital={society.capital}
            phase={society.phase}
            homeMatches={ruleset.capital.homeMatchesPerSeason}
            stadium={society.stadium}
            academy={society.academy}
            scouting={society.scouting}
            existingScouts={scouts.map((s) => ({ league: s.league, club: s.club }))}
            build={async (teamId: string, level: number) => {
              "use server";
              return buildStadium(teamId, level);
            }}
            expand={async (teamId: string, capacity: number) => {
              "use server";
              return expandAcademy(teamId, capacity);
            }}
            scout={async (input: { teamId: string; league: string; club?: string }) => {
              "use server";
              return sendScout(input);
            }}
          />
        </>
      )}
    </>
  );
}
