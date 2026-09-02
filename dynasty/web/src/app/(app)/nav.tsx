"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * La navigazione.
 *
 * Galleggia in fondo allo schermo perché lì arriva il pollice, e perché è dove
 * la cerca chiunque abbia in mano un telefono. Su schermo largo la stessa barra
 * si appiccica in cima: là il pollice non c'entra niente.
 *
 * Cinque voci al massimo, con l'icona sopra il nome. Il commissioner ne ha una
 * in più, e per non arrivare a sei il registro gli passa dentro il pannello.
 */

const ICONE: Record<string, React.ReactNode> = {
  lega: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  squadra: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3.4" />
      <path d="M21 20v-2a4 4 0 0 0-3-3.8" />
    </svg>
  ),
  mercato: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3l4 4-4 4" />
      <path d="M21 7H8a4 4 0 0 0-4 4" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M3 17h13a4 4 0 0 0 4-4" />
    </svg>
  ),
  asta: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3l7 7-3 3-7-7z" />
      <path d="M12.5 8.5L4 17l3 3 8.5-8.5" />
      <path d="M3 21h8" />
    </svg>
  ),
  listone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h10M4 12h10M4 18h6" />
      <path d="M18 5v8" />
      <circle cx="18" cy="17.5" r="2.2" />
    </svg>
  ),
  rosa: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M8 3v3M16 3v3M7.5 11h9M7.5 15.5h5.5" />
    </svg>
  ),
  registro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h11l4 4v14H5z" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.33-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  ),
};

export interface Voce {
  href: string;
  label: string;
  icona: keyof typeof ICONE;
}

export function Nav({ voci }: { voci: Voce[] }) {
  const percorso = usePathname();

  return (
    <nav className="barra-basso" aria-label="Sezioni">
      {voci.map((v) => {
        // `/squadra/xyz` deve restare acceso anche guardando un'altra squadra.
        const attiva = percorso === v.href || percorso.startsWith(`${v.href.split("/").slice(0, 2).join("/")}/`);
        return (
          <Link key={v.href} href={v.href} className="voce-barra" data-attiva={attiva ? "si" : "no"}>
            {ICONE[v.icona]}
            <span>{v.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
