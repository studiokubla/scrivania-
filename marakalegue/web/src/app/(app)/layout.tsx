import Link from "next/link";

import { logout } from "@/app/actions/auth";
import { requireSession } from "@/lib/auth";
import { getLeagueContext } from "@/lib/league";

const FASE: Record<string, string> = {
  PRESEASON: "Precampionato",
  REGULAR: "Stagione regolare",
  POSTSEASON: "Fine stagione",
  ARCHIVED: "Archiviata",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { league, season } = await getLeagueContext();

  const voci = [
    { href: "/lega", label: "Lega" },
    ...(session.teamId ? [{ href: `/squadra/${session.teamId}`, label: "La mia squadra" }] : []),
    { href: "/mercato", label: "Mercato" },
    { href: "/asta", label: "Asta" },
    { href: "/registro", label: "Registro" },
    ...(session.role === "COMMISSIONER" ? [{ href: "/admin", label: "Amministrazione" }] : []),
  ];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--bordo)",
          background: "var(--carta)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link href="/lega" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <strong style={{ fontSize: 16, letterSpacing: "-0.02em" }}>{league.name}</strong>
            <span className="occhiello">
              {season.label} · {FASE[season.phase] ?? season.phase}
            </span>
          </Link>

          <nav style={{ display: "flex", gap: 2, marginLeft: "auto", flexWrap: "wrap" }}>
            {voci.map((v) => (
              <Link
                key={v.href}
                href={v.href}
                style={{
                  padding: "6px 10px",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 550,
                  color: "var(--inchiostro-medio)",
                }}
              >
                {v.label}
              </Link>
            ))}
          </nav>

          <form action={logout} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>
              {session.name}
              {session.role === "COMMISSIONER" && " · commissioner"}
            </span>
            <button
              className="bottone"
              style={{ padding: "5px 10px", fontSize: 12 }}
              title="Esci dalla sessione"
            >
              Esci
            </button>
          </form>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 60px", width: "100%", flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
