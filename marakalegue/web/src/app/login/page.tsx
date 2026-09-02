import { redirect } from "next/navigation";

import { LoginForm } from "./form";
import { getSession } from "@/lib/auth";

export default async function LoginPage() {
  if (await getSession()) redirect("/lega");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 22 }}>
          <div className="occhiello">Fantacalcio gestionale</div>
          <h1 style={{ fontSize: 30, letterSpacing: "-0.03em", marginTop: 2 }}>Marakalegue</h1>
          <p style={{ margin: "6px 0 0", color: "var(--inchiostro-medio)", fontSize: 13.5 }}>
            Rose, contratti, tetto salariale, mercato e capitale. Le formazioni restano su
            Leghe Fantacalcio.
          </p>
        </div>

        <div className="carta" style={{ padding: 18 }}>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
