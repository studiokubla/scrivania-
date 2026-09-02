import { redirect } from "next/navigation";

import { Card, Empty, Tessera, TesseraGrande } from "@/components/ui";
import { ComponiRosa, type Libero, type VoceAttesa } from "./client";
import { firmaInRosa, importaRosa, scartaVoce, svuotaRosa, togliDallaRosa } from "@/app/actions/rosa";
import { MODELLO_ROSA } from "@/lib/import/modello-rosa";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeagueContext, getTeamState } from "@/lib/league";
import { formatMoney, fromDecimal } from "@/lib/money";
import { countByRole } from "@/lib/rules/cap";
import { etàAllaStagione, salaryInYear } from "@/lib/rules/contracts";

/**
 * Componi rosa.
 *
 * È la schermata del giorno dopo l'asta: davanti si ha un foglio con
 * venticinque nomi e delle cifre a matita, e vanno messi dentro. Due strade —
 * uno alla volta cercandoli nel listone, oppure caricando il foglio — e in
 * mezzo il conto che si aggiorna a ogni nome: quanto è stato speso, quanto
 * resta, quanti giocatori per ruolo mancano al minimo.
 *
 * Il commissioner la usa per qualunque squadra; ogni presidente per la sua.
 */

export const dynamic = "force-dynamic";

export default async function RosaPage({ searchParams }: { searchParams: Promise<{ squadra?: string }> }) {
  const { squadra: squadraScelta } = await searchParams;
  const session = await requireSession();
  const { league, ruleset, season, currentYear } = await getLeagueContext();
  const commissioner = session.role === "COMMISSIONER";

  const squadre = await db.team.findMany({
    where: { leagueId: league.id },
    select: { id: true, name: true, shortName: true, color: true },
    orderBy: { name: "asc" },
  });

  // Il manager compone la sua e basta; il commissioner sceglie.
  const teamId = commissioner ? (squadraScelta ?? squadre[0]?.id) : session.teamId;
  if (!teamId) {
    return (
      <>
        <div style={{ padding: "6px 4px 2px" }}>
          <div className="occhiello">Art. 8</div>
          <h1>Componi rosa</h1>
        </div>
        <Card padded={false}>
          <Empty>
            Non c&apos;è ancora nessuna squadra.
            <br />
            Le iscrive il commissioner dal pannello di gestione.
          </Empty>
        </Card>
      </>
    );
  }

  const team = squadre.find((t) => t.id === teamId);
  if (!team) redirect("/rosa");

  const [state, liberiRaw, attesaRaw] = await Promise.all([
    getTeamState({ teamId, seasonId: season.id, currentYear, ruleset }),
    db.player.findMany({
      where: { contracts: { none: { status: "ACTIVE" } } },
      select: { id: true, name: true, role: true, serieATeam: true, birthDate: true, declaredAge: true, declaredAgeYear: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.auctionEntry.findMany({
      where: { teamId, seasonId: season.id },
      include: { player: { select: { id: true, name: true, role: true, serieATeam: true, birthDate: true, declaredAge: true, declaredAgeYear: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const inRosa = state.contracts
    .filter((c) => c.status === "ACTIVE" && c.schedule.some((r) => r.year === currentYear))
    .sort((a, b) => salaryInYear(b.schedule, currentYear) - salaryInYear(a.schedule, currentYear));
  const ruoli = countByRole(inRosa);
  const corrente = state.capMatrix[0];

  // Rookie e Veteran dipendono dall'età: senza, non si possono firmare, e
  // l'interfaccia deve dirlo prima invece di far scoprire il rifiuto dopo.
  const età = (p: { birthDate: Date | null; declaredAge: number | null; declaredAgeYear: number | null }) =>
    etàAllaStagione(p, currentYear, ruleset);

  const liberi: Libero[] = liberiRaw.map((p) => ({
    id: p.id,
    nome: p.name,
    ruolo: p.role,
    squadraSerieA: p.serieATeam,
    età: età(p),
  }));

  const attesa: VoceAttesa[] = attesaRaw.map((v) => ({
    id: v.id,
    playerId: v.player.id,
    nome: v.player.name,
    ruolo: v.player.role,
    squadraSerieA: v.player.serieATeam,
    età: età(v.player),
    importo: v.amount ? fromDecimal(v.amount) : null,
    tipo: v.type,
    anni: v.years,
  }));

  const mancanti = Object.entries(ruleset.roster.minByRole)
    .map(([r, minimo]) => ({ ruolo: r, mancano: Math.max(0, minimo - (ruoli[r as "P"] ?? 0)) }))
    .filter((x) => x.mancano > 0);

  return (
    <>
      <div style={{ padding: "6px 4px 2px" }}>
        <div className="occhiello">Art. 8 — dopo l&apos;asta</div>
        <h1>Componi rosa</h1>
      </div>

      <TesseraGrande
        label={`${team.name} · spazio salariale`}
        value={formatMoney(corrente.space)}
        hint={`${formatMoney(corrente.total)} spesi su ${formatMoney(corrente.cap)} di tetto`}
        tinta={corrente.space < 0 ? "rosa" : "inchiostro"}
      />

      <div className="duetto">
        <Tessera
          label="In rosa"
          value={`${inRosa.length}/${ruleset.roster.minPlayers}`}
          hint={`${ruoli.P}P · ${ruoli.D}D · ${ruoli.C}C · ${ruoli.A}A`}
          tinta="azzurro"
        />
        <Tessera
          label="Slot pluriennali"
          value={state.freeSlots}
          hint={`liberi su ${ruleset.roster.maxMultiYearContracts}`}
          tinta="menta"
        />
      </div>

      {mancanti.length > 0 && (
        <div className="avviso avviso-attenzione">
          Mancano al minimo di ruolo:{" "}
          {mancanti.map((m) => `${m.mancano} ${{ P: "portieri", D: "difensori", C: "centrocampisti", A: "attaccanti" }[m.ruolo as "P"]}`).join(", ")}{" "}
          (art. 3.2).
        </div>
      )}

      <ComponiRosa
        team={team}
        squadre={commissioner ? squadre : [team]}
        liberi={liberi}
        attesa={attesa}
        inRosa={inRosa.map((c) => ({
          id: c.id,
          nome: c.playerName,
          ruolo: c.role,
          tipo: c.type,
          anni: c.years,
          importo: salaryInYear(c.schedule, currentYear),
        }))}
        maxRosa={ruleset.roster.maxPlayers}
        slotLiberi={state.freeSlots}
        modello={MODELLO_ROSA}
        firma={firmaInRosa}
        importa={importaRosa}
        togli={togliDallaRosa}
        scarta={scartaVoce}
        svuota={svuotaRosa}
      />
    </>
  );
}
