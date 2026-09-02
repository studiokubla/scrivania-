import { Card, Empty } from "@/components/ui";
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
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="occhiello">Art. 22</div>
        <h1 style={{ fontSize: 26 }}>Registro pubblico</h1>
        <p style={{ margin: "6px 0 0", color: "var(--inchiostro-medio)", fontSize: 13.5, maxWidth: 620 }}>
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
          <Empty>Nessuna operazione in questa stagione. Il registro si riempie appena il mercato si muove.</Empty>
        ) : (
          <div className="scorre">
            <table className="griglia">
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Quando</th>
                  <th>Tipo</th>
                  <th>Squadra</th>
                  <th>Operazione</th>
                  <th>Da</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="cifre" style={{ whiteSpace: "nowrap", color: "var(--inchiostro-tenue)", fontSize: 12.5 }}>
                      {e.createdAt.toLocaleString("it-IT", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <span className="tag tag-neutro">{ETICHETTA[e.action] ?? e.action}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {e.team ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 3, height: 13, borderRadius: 2, background: e.team.color }} />
                          {e.team.name}
                        </span>
                      ) : (
                        <span style={{ color: "var(--inchiostro-tenue)" }}>lega</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{e.summary}</td>
                    <td style={{ color: "var(--inchiostro-tenue)", fontSize: 12.5, whiteSpace: "nowrap" }}>
                      {e.user?.name ?? "sistema"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
