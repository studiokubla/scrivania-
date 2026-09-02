import { redirect } from "next/navigation";

import { LoginForm } from "./form";
import { Logo } from "@/components/logo";
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
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
