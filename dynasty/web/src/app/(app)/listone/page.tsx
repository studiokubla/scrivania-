import { Card, Empty, Tessera, TesseraGrande, Titolo } from "@/components/ui";
import { Listone, type VoceListone } from "./client";
import { annullaAcquisto, registraAcquisto } from "@/app/actions/admin";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeagueContext } from "@/lib/league";
import { fromDecimal } from "@/lib/money";
import { etàAllaStagione } from "@/lib/rules/contracts";
import { motivoPiùFrequente, presenzeNote, youthEligibility } from "@/lib/rules/youth";

/**
 * Il listone.
 *
 * È l'elenco di chi non ha ancora una squadra, e **si svuota da solo**: un
 * giocatore sparisce da qui nel momento esatto in cui qualcuno gli fa un
 * contratto. Non c'è niente da spuntare a mano — la lista non è una copia dei
 * dati, è la domanda «chi è ancora libero?» fatta al database ogni volta.
 *
 * Durante l'asta di settembre, che la lega fa in presenza, questa pagina è il
 * tabellone: il commissioner registra chi ha preso chi mentre si è ancora
 * seduti al tavolo, e tutti vedono la lista accorciarsi.
 */

export const dynamic = "force-dynamic";

export default async function ListonePage() {
  const session = await requireSession();
  const { league, ruleset, season, currentYear } = await getLeagueContext();
  const commissioner = session.role === "COMMISSIONER";

  const [liberi, squadre, quantiSottoContratto, giornateImportate, ultimi] = await Promise.all([
    db.player.findMany({
      where: { contracts: { none: { status: "ACTIVE" } } },
      select: {
        id: true,
        name: true,
        role: true,
        serieATeam: true,
        birthDate: true, declaredAge: true, declaredAgeYear: true,
        seasons: {
          where: { seasonId: season.id },
          select: { quotationCurrent: true, appearances: true },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.team.findMany({
      where: { leagueId: league.id },
      select: { id: true, name: true, shortName: true, color: true, _count: { select: { contracts: true } } },
      orderBy: { name: "asc" },
    }),
    db.contract.count({ where: { status: "ACTIVE", seasonId: season.id } }),
    db.season.findUniqueOrThrow({ where: { id: season.id }, select: { matchday: true } }),
    // Le ultime firme, per poter annullare un errore di battitura al tavolo.
    // Dodici e non cinque: a un'asta dal vivo l'errore si nota qualche
    // chiamata dopo, non subito, e dover rifare la lega per una cifra
    // sbagliata sarebbe assurdo.
    commissioner
      ? db.contract.findMany({
          where: { status: "ACTIVE", seasonId: season.id },
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { player: { select: { name: true } }, team: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const esiti: ReturnType<typeof youthEligibility>[] = [];
  const voci: VoceListone[] = liberi.map((p) => {
    const stagione = p.seasons[0];
    const quotazione = stagione?.quotationCurrent ? fromDecimal(stagione.quotationCurrent) : null;
    const età = etàAllaStagione(p, currentYear, ruleset);
    const esito = youthEligibility(
      {
        età,
        appearances: presenzeNote(giornateImportate.matchday, stagione?.appearances),
        quotation: quotazione,
      },
      currentYear,
      ruleset,
    );
    esiti.push(esito);
    return {
      id: p.id,
      nome: p.name,
      ruolo: p.role,
      squadraSerieA: p.serieATeam,
      età,
      quotazione,
      primavera: esito.stato,
      perché: esito.motivi.join(", "),
    };
  });

  const perché = motivoPiùFrequente(esiti);
  const totale = voci.length + quantiSottoContratto;
  const idonei = voci.filter((v) => v.primavera === "IDONEO").length;
  const daVerificare = voci.filter((v) => v.primavera === "DA_VERIFICARE").length;

  return (
    <>
      <div style={{ padding: "6px 4px 2px" }}>
        <div className="occhiello">Art. 8 e 16</div>
        <h1>Listone</h1>
      </div>

      <TesseraGrande
        label="Ancora liberi"
        value={voci.length}
        hint={
          quantiSottoContratto === 0
            ? `Su ${totale} del listone. Nessuno ha ancora una squadra.`
            : `Su ${totale}. ${quantiSottoContratto} sono già andati.`
        }
        tinta="inchiostro"
      />

      <div className="duetto">
        <Tessera
          label="Idonei primavera"
          value={idonei}
          hint="under 20, ≤5 presenze, ≤7 M"
          tinta="menta"
        />
        <Tessera label="Da verificare" value={daVerificare} hint={perché ?? "dati incompleti"} tinta="pesca" />
      </div>

      {daVerificare > 0 && (
        <div className="avviso avviso-attenzione">
          Per {daVerificare} giocatori l&apos;idoneità al settore giovanile non è decidibile:{" "}
          {perché}. L&apos;art. 16.1 guarda le presenze della stagione precedente, e questa lega la
          sua prima stagione la sta giocando adesso: il requisito lo valuta il commissioner.
        </div>
      )}

      {commissioner && squadre.length === 0 && (
        <div className="avviso avviso-attenzione">
          Non c&apos;è ancora nessuna squadra: prima di registrare acquisti vanno iscritte dal
          pannello di gestione.
        </div>
      )}

      <Titolo>{commissioner ? "Asta dal vivo" : "Chi è ancora libero"}</Titolo>

      {voci.length === 0 ? (
        <Card padded={false}>
          <Empty>Il listone è vuoto: tutti hanno una squadra.</Empty>
        </Card>
      ) : (
        <Listone
          voci={voci}
          squadre={squadre.map((t) => ({
            id: t.id,
            nome: t.name,
            sigla: t.shortName,
            colore: t.color,
            rosa: t._count.contracts,
          }))}
          maxRosa={ruleset.roster.maxPlayers}
          commissioner={commissioner}
          ultimi={ultimi.map((c) => ({
            id: c.id,
            giocatore: c.player.name,
            squadra: c.team.name,
            importo: fromDecimal(c.baseSalary),
          }))}
          registra={registraAcquisto}
          annulla={annullaAcquisto}
        />
      )}
    </>
  );
}
