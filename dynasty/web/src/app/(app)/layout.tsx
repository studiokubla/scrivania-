import Link from "next/link";

import { Nav, type Voce } from "./nav";
import { Logo } from "@/components/logo";
import { logout } from "@/app/actions/auth";
import { requireSession } from "@/lib/auth";
import { getLeagueContext } from "@/lib/league";

/**
 * Il guscio.
 *
 * Una testata sottile con il marchio e l'uscita, e la navigazione che galleggia
 * in basso. La testata non è appiccicata: durante un'asta ogni riga di schermo
 * conta, e il marchio non serve a nessuno mentre si rilancia.
 */

const FASE: Record<string, string> = {
  PRESEASON: "Precampionato",
  REGULAR: "Stagione regolare",
  POSTSEASON: "Fine stagione",
  ARCHIVED: "Archiviata",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { league, season } = await getLeagueContext();
  const commissioner = session.role === "COMMISSIONER";

  // Cinque voci al massimo: sotto ognuna ci sta un nome leggibile, sopra no.
  // Al commissioner il registro passa dentro il pannello, che è dove lo cerca.
  const voci: Voce[] = [
    { href: "/lega", label: "Lega", icona: "lega" },
    ...(session.teamId
      ? [{ href: `/squadra/${session.teamId}`, label: "Squadra", icona: "squadra" as const }]
      : []),
    { href: "/mercato", label: "Mercato", icona: "mercato" },
    { href: "/asta", label: "Asta", icona: "asta" },
    ...(commissioner
      ? [{ href: "/admin", label: "Gestione", icona: "admin" as const }]
      : [{ href: "/registro", label: "Registro", icona: "registro" as const }]),
  ];

  return (
    <div style={{ minHeight: "100dvh" }}>
      <header className="testata">
        <Link href="/lega" className="marchio" style={{ minWidth: 0 }}>
          <Logo size={26} title={league.name} />
          <b style={{ whiteSpace: "nowrap" }}>{league.name}</b>
        </Link>

        <form action={logout} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span className="didascalia" style={{ textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {season.label}
            <br />
            {FASE[season.phase] ?? season.phase}
          </span>
          <button className="bottone bottone-piccolo" title={`Esci — ${session.name}`}>
            Esci
          </button>
        </form>
      </header>

      <main className="pagina">{children}</main>

      <Nav voci={voci} />
    </div>
  );
}
