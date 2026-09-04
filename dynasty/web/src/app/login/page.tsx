import { redirect } from "next/navigation";

import { LoginForm } from "./form";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/auth";
import { databaseRaggiungibile } from "@/lib/salute";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Prima il database, poi la sessione: senza `AUTH_SECRET` la chiave di
  // firma sta nel database, quindi leggere la sessione per prima farebbe
  // esplodere la pagina proprio nel caso che questa pagina deve spiegare.
  const database = await databaseRaggiungibile();
  if (database.ok && (await getSession())) redirect("/lega");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="carta-menta imbottita" style={{ marginBottom: 12, paddingTop: 26, paddingBottom: 26 }}>
          <Logo size={46} title="Dynasty League" />
          <h1 style={{ fontSize: 38, marginTop: 16 }}>Dynasty League</h1>
          <p className="didascalia" style={{ margin: "10px 0 0", fontSize: 14 }}>
            Rose, contratti, tetto salariale, mercato e capitale.
            <br />
            Le formazioni restano su Leghe Fantacalcio.
          </p>
        </div>

        <div className="carta" style={{ padding: 20 }}>
          {database.ok ? (
            <LoginForm />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="avviso avviso-errore" role="alert">
                La lega non è raggiungibile: il database non risponde.
              </div>
              <p className="didascalia" style={{ margin: 0 }}>
                Non è la tua password. L&apos;applicazione è online, ma non trova i suoi dati:
                succede quando la connessione al database cambia o scade. Va rimessa la variabile{" "}
                <code>DATABASE_URL</code> nelle impostazioni del progetto, poi ripubblicato.
              </p>
              <details className="piega">
                <summary>
                  <span>Dettaglio tecnico</span>
                </summary>
                <p className="didascalia" style={{ margin: "8px 0 0", wordBreak: "break-word" }}>
                  {database.dettaglio}
                </p>
              </details>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
