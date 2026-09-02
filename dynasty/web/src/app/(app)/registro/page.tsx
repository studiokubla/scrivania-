import { Card, Empty, Riga } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { verifyAuditChain } from "@/lib/audit";
import { db } from "@/lib/db";
import { getLeagueContext } from "@/lib/league";

const ETICHETTA: Record<string, string> = {
  CONTRACT_SIGNED: "Firma",
  CONTRACT_BUYOUT: "Svincolo",
  TEAM_OPTION: "Team Option",
  FRANCHISE_TAG: "Franchise Tag",
  TRADE_PROPOSED: "Scambio proposto",
  TRADE_EXECUTED: "Scambio eseguito",
  TRADE_REJECTED: "Scambio rifiutato",
  TRADE_VETOED: "Scambio annullato",
  OFFER_SUBMITTED: "Offerta",
  OFFER_RESOLVED: "Offerta risolta",
  WAIVER_CLAIM: "Reclamo waiver",
  WAIVER_AWARDED: "Waiver assegnato",
  CAPITAL_INVESTMENT: "Investimento",
  PRIZE_AWARDED: "Premio",
  IMPORT: "Import dati",
  SEASON_PHASE: "Fase stagione",
  WINDOW: "Finestra di mercato",
};

export default async function RegistroPage() {
  await requireSession();
  const { season } = await getLeagueContext();

  const [entries, chain] = await Promise.all([
    db.auditEntry.findMany({
      where: { seasonId: season.id },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { team: { select: { name: true, color: true } }, user: { select: { name: true } } },
    }),
    verifyAuditChain(season.id),
  ]);

  return (
    <>
      <div style={{ padding: "6px 4px 2px" }}>
        <div className="occhiello">Art. 22</div>
        <h1>Registro pubblico</h1>
        <p className="didascalia" style={{ margin: "8px 0 0", fontSize: 13.5, maxWidth: 620 }}>
          Ogni operazione della lega è scritta qui, in ordine di tempo. Nessuna operazione esiste se
          non è a registro. Ogni riga porta l&apos;impronta della precedente: se qualcuno modificasse
          una riga a posteriori, la catena si spezzerebbe e il controllo qui sotto lo direbbe.
        </p>
      </div>

      <div className={`avviso ${chain.valid ? "avviso-ok" : "avviso-errore"}`}>
        {chain.valid ? (
          <span>
            Catena integra: {chain.entries} {chain.entries === 1 ? "operazione verificata" : "operazioni verificate"}.
          </span>
        ) : (
          <span>
            Catena interrotta a partire da «{chain.brokenAt?.summary}» del{" "}
            {chain.brokenAt?.createdAt.toLocaleString("it-IT")}. Il registro è stato alterato dopo la
            scrittura: avvisa il commissioner.
          </span>
        )}
      </div>

      <Card padded={false}>
        {entries.length === 0 ? (
          <Empty>
            Nessuna operazione in questa stagione.
            <br />
            Il registro si riempie appena il mercato si muove.
          </Empty>
        ) : (
          <div className="elenco">
            {entries.map((e) => (
              <Riga
                key={e.id}
                titolo={e.summary}
                nota={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span className="tag tag-neutro">{ETICHETTA[e.action] ?? e.action}</span>
                    {e.team ? e.team.name : "lega"} · {e.user?.name ?? "sistema"}
                  </span>
                }
                valore={
                  <span className="didascalia" style={{ fontWeight: 400 }}>
                    {e.createdAt.toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
