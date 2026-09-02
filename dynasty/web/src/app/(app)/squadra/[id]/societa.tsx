"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Result } from "../../mercato/client";
import type { ActionResult } from "@/app/actions/contracts";

interface StadiumTierView {
  level: number;
  name: string;
  cost: number;
  requiresDemolition: boolean;
  maintenance: number;
  incomePerHomeMatch: number;
  fantaPoints: number;
  affordable: boolean;
}

interface AcademyTierView {
  capacity: number;
  investment: number;
  maintenance: number;
  affordable: boolean;
}

interface ScoutOption {
  league: string;
  country: string;
  cost: number;
  affordable: boolean;
}

const M = (v: number) => `${(v / 100).toLocaleString("it-IT")} M`;

/**
 * Il pannello degli investimenti societari.
 *
 * Ogni riga mostra il costo, il rientro e il vincolo: lo stadio è la decisione
 * più lenta della lega — quattro o sette stagioni per rientrare — e va presa
 * guardando i numeri, non a occhio.
 */
export function SocietyPanel({
  teamId,
  capital,
  phase,
  homeMatches,
  stadium,
  academy,
  scouting,
  existingScouts,
  build,
  expand,
  scout,
}: {
  teamId: string;
  capital: number;
  phase: string;
  homeMatches: number;
  stadium: { currentLevel: number; tiers: StadiumTierView[] };
  academy: { currentCapacity: number; tiers: AcademyTierView[] };
  scouting: ScoutOption[];
  existingScouts: { league: string; club: string | null }[];
  build: (teamId: string, level: number) => Promise<ActionResult>;
  expand: (teamId: string, capacity: number) => Promise<ActionResult>;
  scout: (input: { teamId: string; league: string; club?: string }) => Promise<ActionResult>;
}) {
  const [tab, setTab] = useState<"stadio" | "primavera" | "osservatori">("stadio");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [scoutLeague, setScoutLeague] = useState(scouting[0]?.league ?? "");
  const [scoutClub, setScoutClub] = useState("");
  const router = useRouter();

  const run = (fn: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });
  };

  const preseason = phase === "PRESEASON";
  const leagueScouts = existingScouts.filter((s) => !s.club).map((s) => s.league);

  const tabs = [
    { id: "stadio" as const, label: "Stadio" },
    { id: "primavera" as const, label: "Settore giovanile" },
    { id: "osservatori" as const, label: "Osservatori" },
  ];

  return (
    <section className="carta">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 10px",
          borderBottom: "1px solid var(--bordo)",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            className="bottone"
            style={{
              border: "none",
              background: tab === t.id ? "var(--accento-tenue)" : "transparent",
              color: tab === t.id ? "var(--accento)" : "var(--inchiostro-medio)",
            }}
            onClick={() => {
              setTab(t.id);
              setResult(null);
            }}
          >
            {t.label}
          </button>
        ))}
        <span className="cifre" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>
          Capitale {M(capital)}
        </span>
      </header>

      <div style={{ padding: 14 }}>
        {tab === "stadio" && (
          <>
            {!preseason && (
              <div className="avviso avviso-attenzione" style={{ marginBottom: 12 }}>
                Lo stadio si costruisce solo in precampionato (art. 15.1). Qui puoi vedere i costi,
                non investire.
              </div>
            )}
            <div className="scorre">
              <table className="griglia">
                <thead>
                  <tr>
                    <th>Livello</th>
                    <th className="num">Costo</th>
                    <th className="num">Manutenzione</th>
                    <th className="num">Incasso/stagione</th>
                    <th className="num">Netto</th>
                    <th className="num">Fantapunti</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stadium.tiers.map((t) => {
                    const yearly = t.incomePerHomeMatch * homeMatches;
                    const net = yearly - t.maintenance;
                    const current = t.level === stadium.currentLevel;
                    return (
                      <tr key={t.level} style={current ? { background: "var(--accento-tenue)" } : undefined}>
                        <td style={{ fontWeight: 600 }}>
                          {t.level} — {t.name}
                          {current && <span style={{ marginLeft: 6, fontSize: 11 }}>attuale</span>}
                        </td>
                        <td className="num">{t.level > stadium.currentLevel ? M(t.cost) : "—"}</td>
                        <td className="num">{M(t.maintenance)}</td>
                        <td className="num">{M(yearly)}</td>
                        <td className="num" style={{ color: "var(--positivo)", fontWeight: 600 }}>
                          +{M(net)}
                        </td>
                        <td className="num">+{t.fantaPoints}</td>
                        <td className="num">
                          {t.level > stadium.currentLevel && (
                            <button
                              className="bottone"
                              disabled={!t.affordable || !preseason || pending}
                              title={
                                t.requiresDemolition
                                  ? "Salta più di un livello: demolizione e costo pieno (art. 15.2)"
                                  : undefined
                              }
                              onClick={() =>
                                run(
                                  () => build(teamId, t.level),
                                  t.requiresDemolition
                                    ? `Salire al livello ${t.level} richiede di demolire l'impianto attuale e pagare ${M(t.cost)} pieni. Procedere?`
                                    : `Investire ${M(t.cost)} per il livello ${t.level}?`,
                                )
                              }
                            >
                              {t.requiresDemolition ? "Ricostruisci" : "Costruisci"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--inchiostro-tenue)" }}>
              Si sale un livello alla volta pagando la differenza; per saltarne uno si demolisce e si
              ricostruisce da zero. Gli incassi partono dalla 20ª giornata dell&apos;anno di
              costruzione.
            </p>
          </>
        )}

        {tab === "primavera" && (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--inchiostro-medio)" }}>
              Capienza attuale: <strong>{academy.currentCapacity} posti</strong>. I giovani non
              percepiscono ingaggio e non occupano spazio salariale (art. 16.3). Con almeno 4 si
              partecipa al Dynasty Youth.
            </p>
            {academy.tiers.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--inchiostro-tenue)" }}>
                Hai già la capienza massima.
              </p>
            ) : (
              <table className="griglia">
                <thead>
                  <tr>
                    <th>Capienza</th>
                    <th className="num">Investimento</th>
                    <th className="num">Mantenimento/anno</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {academy.tiers.map((t) => (
                    <tr key={t.capacity}>
                      <td style={{ fontWeight: 600 }}>{t.capacity} posti</td>
                      <td className="num">{M(t.investment)}</td>
                      <td className="num">{M(t.maintenance)}</td>
                      <td className="num">
                        <button
                          className="bottone"
                          disabled={!t.affordable || pending}
                          onClick={() =>
                            run(
                              () => expand(teamId, t.capacity),
                              `Ampliare a ${t.capacity} posti per ${M(t.investment)}? Il mantenimento annuo diventa ${M(t.maintenance)}.`,
                            )
                          }
                        >
                          Amplia
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === "osservatori" && (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--inchiostro-medio)" }}>
              L&apos;osservatore dà il <strong>diritto di pareggio</strong> sui giocatori che da lì
              arrivano in Serie A: puoi eguagliare l&apos;offerta più alta e portarteli via (art. 17.2).
              Prima il campionato, poi — in una sessione successiva — un club specifico.
            </p>

            {existingScouts.length > 0 && (
              <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13 }}>
                {existingScouts.map((s, i) => (
                  <li key={i}>
                    {s.club ? (
                      <>
                        <strong>{s.club}</strong> <span style={{ color: "var(--inchiostro-tenue)" }}>({s.league})</span>
                      </>
                    ) : (
                      <strong>{s.league}</strong>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div>
                <label className="etichetta" htmlFor="campionato">
                  Campionato
                </label>
                <select
                  id="campionato"
                  className="campo"
                  value={scoutLeague}
                  onChange={(e) => setScoutLeague(e.target.value)}
                >
                  {scouting.map((s) => (
                    <option key={s.league} value={s.league}>
                      {s.league} — {M(s.cost)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etichetta" htmlFor="club">
                  Club specifico (facoltativo)
                </label>
                <input
                  id="club"
                  className="campo"
                  value={scoutClub}
                  placeholder={
                    leagueScouts.includes(scoutLeague) ? "Nome del club" : "Prima serve l'osservatore sul campionato"
                  }
                  disabled={!leagueScouts.includes(scoutLeague)}
                  onChange={(e) => setScoutClub(e.target.value)}
                />
              </div>
            </div>

            <button
              className="bottone bottone-primario"
              style={{ marginTop: 12 }}
              disabled={pending || !scoutLeague}
              onClick={() =>
                run(() =>
                  scout({ teamId, league: scoutLeague, club: scoutClub || undefined }),
                )
              }
            >
              Invia l&apos;osservatore
            </button>
          </>
        )}

        <Result result={result} />
      </div>
    </section>
  );
}
