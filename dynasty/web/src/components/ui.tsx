import type { ReactNode } from "react";

import { formatMoney, type Money } from "@/lib/money";
import type { ValidationIssue } from "@/lib/rules/types";

/**
 * I mattoni dell'interfaccia.
 *
 * Regola che vale per tutti: un componente dice **una cosa**. Se una scheda ha
 * bisogno di sei numeri, non è una scheda — sono sei schede, o è un elenco.
 */

export type Tinta = "carta" | "lilla" | "pesca" | "azzurro" | "rosa" | "menta" | "inchiostro";

export function Card({
  title,
  subtitle,
  action,
  children,
  padded = true,
  tinta = "carta",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  tinta?: Tinta;
}) {
  return (
    <section className={tinta === "carta" ? "carta" : `carta-${tinta}`}>
      {(title || action) && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: padded ? "18px 18px 2px" : "16px 18px 10px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <p className="didascalia" style={{ margin: "3px 0 0" }}>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div style={padded ? { padding: 18 } : undefined}>{children}</div>
    </section>
  );
}

/**
 * Una cifra sola, grande, sopra un pastello. È il modo in cui l'applicazione
 * risponde alla domanda che uno si fa aprendola: quanto mi resta?
 */
export function Tessera({
  label,
  value,
  hint,
  tinta = "carta",
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tinta?: Tinta;
  children?: ReactNode;
}) {
  return (
    <div className={tinta === "carta" ? "carta imbottita" : `carta-${tinta} imbottita`}>
      <div className="occhiello">{label}</div>
      <div className="numeretto" style={{ marginTop: 8 }}>
        {value}
      </div>
      {hint && <div className="didascalia" style={{ marginTop: 3 }}>{hint}</div>}
      {children}
    </div>
  );
}

/** Come `Tessera`, ma per il numero principale della schermata. */
export function TesseraGrande({
  label,
  value,
  hint,
  tinta = "inchiostro",
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tinta?: Tinta;
  children?: ReactNode;
}) {
  return (
    <div className={tinta === "carta" ? "carta imbottita" : `carta-${tinta} imbottita`}>
      <div className="occhiello">{label}</div>
      <div className="numerone" style={{ marginTop: 10 }}>
        {value}
      </div>
      {hint && <div className="didascalia" style={{ marginTop: 5 }}>{hint}</div>}
      {children}
    </div>
  );
}

/** Riga di elenco: rimpiazza una riga di tabella, ma si può toccare. */
export function Riga({
  icona,
  titolo,
  nota,
  valore,
  sottovalore,
  href,
  onClickAction,
  coda,
}: {
  icona?: ReactNode;
  titolo: ReactNode;
  nota?: ReactNode;
  valore?: ReactNode;
  sottovalore?: ReactNode;
  href?: string;
  onClickAction?: () => void;
  coda?: ReactNode;
}) {
  const contenuto = (
    <>
      {icona}
      <div className="riga-corpo">
        <div className="riga-titolo">{titolo}</div>
        {nota && <div className="riga-nota">{nota}</div>}
      </div>
      {(valore || sottovalore) && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {valore && <div className="riga-valore">{valore}</div>}
          {sottovalore && <div className="riga-nota">{sottovalore}</div>}
        </div>
      )}
      {coda}
    </>
  );

  if (href) {
    return (
      <a className="riga" href={href}>
        {contenuto}
      </a>
    );
  }
  if (onClickAction) {
    return (
      <button type="button" className="riga" onClick={onClickAction}>
        {contenuto}
      </button>
    );
  }
  return <div className="riga">{contenuto}</div>;
}

/** Il ruolo come pastiglia colorata: sostituisce una colonna intera. */
export function RoleBadge({ role }: { role: string }) {
  return <span className={`ruolo ruolo-${role}`}>{role}</span>;
}

export function Money$({ value, sign }: { value: Money; sign?: boolean }) {
  return <span className="cifre">{formatMoney(value, { sign })}</span>;
}

export function Tag({
  children,
  tone = "neutro",
}: {
  children: ReactNode;
  tone?: "neutro" | "accento" | "positivo" | "allarme" | "avviso";
}) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

const TONO_CONTRATTO: Record<string, "neutro" | "accento" | "positivo" | "avviso"> = {
  ANNUALE: "neutro",
  STANDARD: "accento",
  ROOKIE: "positivo",
  VETERAN: "avviso",
  TAMPONE: "neutro",
};

export function ContractTag({ type, years }: { type: string; years?: number }) {
  const label = type.charAt(0) + type.slice(1).toLowerCase();
  return (
    <Tag tone={TONO_CONTRATTO[type] ?? "neutro"}>
      {label}
      {years && years > 1 ? ` ${years}a` : ""}
    </Tag>
  );
}

/** Barra del tetto salariale: ingaggi pieni, dead cap in rosso, spazio libero vuoto. */
export function CapBar({ committed, deadCap, cap }: { committed: Money; deadCap: Money; cap: Money }) {
  const pct = (v: Money) => `${Math.min(100, Math.max(0, (v / cap) * 100))}%`;
  return (
    <div
      className="barra"
      role="img"
      aria-label={`Monte ingaggi ${formatMoney(committed + deadCap)} su ${formatMoney(cap)}`}
    >
      <span className="quota-ingaggi" style={{ width: pct(committed) }} />
      {deadCap > 0 && <span className="quota-morta" style={{ width: pct(deadCap) }} />}
    </div>
  );
}

/** Errori e avvisi del motore regole, con l'articolo che li motiva. */
export function Issues({ errors = [], warnings = [] }: { errors?: ValidationIssue[]; warnings?: ValidationIssue[] }) {
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {errors.map((e, i) => (
        <div key={`e${i}`} className="avviso avviso-errore">
          <strong style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{e.article}</strong>
          <span>{e.message}</span>
        </div>
      ))}
      {warnings.map((w, i) => (
        <div key={`w${i}`} className="avviso avviso-attenzione">
          <strong style={{ flexShrink: 0 }}>{w.article}</strong>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "26px 18px",
        textAlign: "center",
        color: "var(--inchiostro-tenue)",
        fontSize: 13.5,
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}

/** Quante opzioni restano su quante ne spettano (art. 6). */
export function OptionCounter({
  label,
  used,
  total,
  article,
}: {
  label: string;
  used: number;
  total: number;
  article: string;
}) {
  const left = Math.max(0, total - used);
  return (
    <div className="riga" style={{ padding: "11px 0", minHeight: 48 }}>
      <div className="riga-corpo">
        <div className="riga-titolo" style={{ fontWeight: 550 }}>{label}</div>
        <div className="riga-nota">{article}</div>
      </div>
      <div className="riga-valore" style={{ color: left === 0 ? "var(--allarme)" : "var(--inchiostro)" }}>
        {left}/{total}
      </div>
    </div>
  );
}

/** Il dettaglio che prima stava sempre aperto e adesso si apre toccando. */
export function Piega({
  titolo,
  nota,
  children,
  aperta = false,
}: {
  titolo: ReactNode;
  nota?: ReactNode;
  children: ReactNode;
  aperta?: boolean;
}) {
  return (
    <details className="piega carta" open={aperta}>
      <summary>
        <span style={{ minWidth: 0 }}>
          {titolo}
          {nota && <div className="riga-nota" style={{ fontWeight: 400 }}>{nota}</div>}
        </span>
      </summary>
      <div style={{ padding: "0 18px 18px" }}>{children}</div>
    </details>
  );
}

export function Row({ children, gap = 10 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", alignItems: "center", gap, flexWrap: "wrap" }}>{children}</div>;
}

/** Titolo di sezione fuori dalle schede: separa senza costruire un contenitore. */
export function Titolo({ children, azione }: { children: ReactNode; azione?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 4px 0" }}>
      <h2>{children}</h2>
      {azione}
    </div>
  );
}

/** Compatibilità: qualche pagina chiama ancora `Stat`. Ora è una tessera. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutro",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutro" | "positivo" | "allarme" | "avviso";
}) {
  const colore: Record<string, string> = {
    neutro: "var(--inchiostro)",
    positivo: "var(--positivo)",
    allarme: "var(--allarme)",
    avviso: "var(--avviso)",
  };
  return (
    <div>
      <div className="occhiello">{label}</div>
      <div className="numeretto" style={{ marginTop: 6, color: colore[tone] }}>
        {value}
      </div>
      {hint && <div className="didascalia" style={{ marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
