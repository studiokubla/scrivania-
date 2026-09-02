import Link from "next/link";
import { notFound } from "next/navigation";

import { CapBar, Card, ContractTag, Empty, Issues, Money$, OptionCounter, RoleBadge, Stat } from "@/components/ui";
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

  const ordered = [...inSeason].sort((a, b) => {
    const order: Record<PlayerRole, number> = { P: 0, D: 1, C: 2, A: 3 };
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    return salaryInYear(b.schedule, currentYear) - salaryInYear(a.schedule, currentYear);
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 6, height: 40, borderRadius: 3, background: team.color }} />
        <div>
          <div className="occhiello">{isMine ? "La mia squadra" : "Squadra"}</div>
          <h1 style={{ fontSize: 26 }}>{team.name}</h1>
        </div>
        {isMine && (
          <Link href="/mercato" className="bottone bottone-primario" style={{ marginLeft: "auto" }}>
            Vai al mercato
          </Link>
        )}
      </div>

      {(rosterCheck.errors.length > 0 || rosterCheck.warnings.length > 0) && (
        <Issues errors={rosterCheck.errors} warnings={rosterCheck.warnings} />
      )}

      {/* ── Colpo d'occhio ─────────────────────────────────────────────── */}
      <Card>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <Stat
            label="Monte ingaggi"
            value={formatMoney(current.total)}
            hint={`su ${formatMoney(current.cap)} di tetto`}
            tone={current.overCap ? "allarme" : "neutro"}
          />
          <Stat
            label="Spazio salariale"
            value={formatMoney(current.space)}
            tone={current.space < 0 ? "allarme" : current.space < fromMillions(5) ? "avviso" : "positivo"}
          />
          <Stat label="Capitale" value={formatMoney(state.capital)} hint="fondo societario" />
          <Stat
            label="Rosa"
            value={`${inSeason.length}`}
            hint={`${roles.P}P · ${roles.D}D · ${roles.C}C · ${roles.A}A`}
            tone={inSeason.length < ruleset.roster.minPlayers ? "avviso" : "neutro"}
          />
          <Stat
            label="Slot pluriennali"
            value={`${ruleset.roster.maxMultiYearContracts - state.freeSlots}/${ruleset.roster.maxMultiYearContracts}`}
            hint={`${state.freeSlots} liberi`}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <CapBar committed={current.committed} deadCap={current.deadCap} cap={current.cap} />
          {current.deadCap > 0 && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--allarme)" }}>
              Di cui <Money$ value={current.deadCap} /> di dead cap da svincoli (art. 12.3).
            </p>
          )}
        </div>
      </Card>

      {/* ── Matrice del tetto salariale ────────────────────────────────── */}
      <Card
        title="Proiezione del tetto salariale"
        subtitle="Quanto pesano oggi le firme di oggi, stagione per stagione. È la tabella che nei fogli Excel si compilava a mano."
        padded={false}
      >
        <div className="scorre">
          <table className="griglia">
            <thead>
              <tr>
                <th>Stagione</th>
                <th className="num">Ingaggi</th>
                <th className="num">Dead cap</th>
                <th className="num">Totale</th>
                <th className="num">Spazio</th>
                <th className="num">Giocatori</th>
                <th className="num">Pluriennali</th>
                <th style={{ width: 140 }}>Occupazione</th>
              </tr>
            </thead>
            <tbody>
              {state.capMatrix.map((y) => (
                <tr key={y.year}>
                  <td style={{ fontWeight: 600 }}>
                    {y.label}
                    {y.year === currentYear && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: "var(--inchiostro-tenue)" }}>in corso</span>
                    )}
                  </td>
                  <td className="num">{formatMoney(y.committed)}</td>
                  <td className="num" style={{ color: y.deadCap > 0 ? "var(--allarme)" : "var(--inchiostro-tenue)" }}>
                    {y.deadCap > 0 ? formatMoney(y.deadCap) : "—"}
                  </td>
                  <td className="num" style={{ fontWeight: 650 }}>
                    {formatMoney(y.total)}
                  </td>
                  <td className="num" style={{ color: y.space < 0 ? "var(--allarme)" : "var(--positivo)" }}>
                    {formatMoney(y.space)}
                  </td>
                  <td className="num">{y.playerCount}</td>
                  <td className="num">{y.multiYearCount}</td>
                  <td>
                    <CapBar committed={y.committed} deadCap={y.deadCap} cap={y.cap} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: 0, padding: "10px 14px", fontSize: 12, color: "var(--inchiostro-tenue)", borderTop: "1px solid var(--bordo)" }}>
          Le stagioni future mostrano solo i contratti già firmati: lo spazio che appare libero è
          lo spazio con cui costruire le rose successive, non un avanzo.
        </p>
      </Card>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)" }}>
        {/* ── Rosa ─────────────────────────────────────────────────────── */}
        <Card title="Rosa" subtitle={`${inSeason.length} giocatori sotto contratto in ${current.label}`} padded={false}>
          {ordered.length === 0 ? (
            <Empty>Nessun giocatore sotto contratto.</Empty>
          ) : (
            <div className="scorre">
              <table className="griglia">
                <thead>
                  <tr>
                    <th style={{ width: 30 }} />
                    <th>Giocatore</th>
                    <th>Contratto</th>
                    <th className="num">Ingaggio</th>
                    <th className="num">Scadenza</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((c) => {
                    const expiring = c.endYear === currentYear;
                    return (
                      <tr key={c.id}>
                        <td>
                          <RoleBadge role={c.role} />
                        </td>
                        <td style={{ fontWeight: 550 }}>{c.playerName}</td>
                        <td>
                          <ContractTag type={c.type} years={c.years} />
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {formatMoney(salaryInYear(c.schedule, currentYear))}
                        </td>
                        <td className="num" style={{ color: expiring ? "var(--avviso)" : "var(--inchiostro-tenue)" }}>
                          {expiring ? "in scadenza" : `${c.endYear}/${String((c.endYear + 1) % 100)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {/* ── Opzioni ─────────────────────────────────────────────────── */}
          <Card title="Opzioni disponibili" subtitle="Si azzerano il 1° luglio">
            <OptionCounter label="Team Option" article="art. 6.1" used={state.counters.TEAM_OPTION} total={ruleset.options.teamOption.perSeason} />
            <OptionCounter label="Franchise Tag" article="art. 6.2" used={state.counters.FRANCHISE_TAG} total={ruleset.options.franchiseTag.perSeason} />
            <OptionCounter label="Performance buy-out" article="art. 12.4" used={state.counters.PERFORMANCE_BUYOUT} total={ruleset.options.performanceBuyout.perSeason} />
            <OptionCounter label="Offerte free agency" article="art. 9.1" used={state.counters.FREE_AGENCY_OFFER} total={ruleset.options.freeAgencyOffers.perSeason} />
            <OptionCounter label="Pre-contract" article="art. 11.2" used={state.counters.PRE_CONTRACT} total={ruleset.options.preContract.perSeason} />
            <OptionCounter label="Contratti tampone" article="art. 4.4" used={state.counters.TAMPONE} total={ruleset.contracts.TAMPONE.maxPerSeason} />
          </Card>

          {/* ── Società ─────────────────────────────────────────────────── */}
          <Card title="Società">
            <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Stadio</span>
                <strong>
                  {tier ? `Livello ${tier.level} — ${tier.name}` : "Nessuno"}
                </strong>
              </div>
              {tier && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--inchiostro-tenue)", fontSize: 12 }}>
                  <span>Manutenzione annua</span>
                  <span className="cifre">{formatMoney(tier.maintenance)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Settore giovanile</span>
                <strong>
                  {youth.length}/{academy?.capacity ?? ruleset.youth.baseCapacity} posti
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Osservatori</span>
                <strong>{scouts.length}</strong>
              </div>
              {scouts.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 16, color: "var(--inchiostro-tenue)", fontSize: 12 }}>
                  {scouts.map((s) => (
                    <li key={s.id}>
                      {s.club ?? s.league}
                      {s.club && <span> ({s.league})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* ── Capitale ────────────────────────────────────────────────── */}
          <Card title="Movimenti di capitale" subtitle={`Saldo ${formatMoney(state.capital)}`} padded={false}>
            {movements.length === 0 ? (
              <Empty>Nessun movimento.</Empty>
            ) : (
              <table className="griglia">
                <tbody>
                  {movements.map((m) => {
                    const amount = fromDecimal(m.amount);
                    return (
                      <tr key={m.id}>
                        <td style={{ fontSize: 12.5 }}>{m.description}</td>
                        <td
                          className="num"
                          style={{ fontWeight: 600, color: amount >= 0 ? "var(--positivo)" : "var(--allarme)" }}
                        >
                          {formatMoney(amount, { sign: true })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>

      {society && (
        <div>
          <div className="occhiello" style={{ marginBottom: 8 }}>
            Investimenti societari · titolo V
          </div>
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
        </div>
      )}

      {youth.length > 0 && (
        <Card title="Settore giovanile" subtitle="Non percepiscono ingaggio finché non vengono promossi (art. 16.3)" padded={false}>
          <table className="griglia">
            <thead>
              <tr>
                <th style={{ width: 30 }} />
                <th>Giocatore</th>
                <th className="num">Chiamata</th>
                <th className="num">Ingaggio alla promozione</th>
              </tr>
            </thead>
            <tbody>
              {youth.map((y) => (
                <tr key={y.id}>
                  <td>
                    <RoleBadge role={y.player.role} />
                  </td>
                  <td style={{ fontWeight: 550 }}>{y.player.name}</td>
                  <td className="num">#{y.draftPickNumber}</td>
                  <td className="num">
                    {formatMoney(
                      fromMillions(
                        ruleset.youth.promotionSalaryByPick.find((t) => y.draftPickNumber <= t.maxPick)?.salary ?? 0.25,
                      ),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
