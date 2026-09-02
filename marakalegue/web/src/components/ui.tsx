import type { ReactNode } from "react";

import { formatMoney, type Money } from "@/lib/money";
import type { ValidationIssue } from "@/lib/rules/types";

export function Card({
  title,
  subtitle,
  action,
  children,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="carta">
      {(title || action) && (
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderBottom: "1px solid var(--bordo)",
          }}
        >
          <div>
            <h2 style={{ fontSize: 15 }}>{title}</h2>
            {subtitle && (
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--inchiostro-tenue)" }}>{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div style={padded ? { padding: 14 } : undefined}>{children}</div>
    </section>
  );
}

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
  const colors: Record<string, string> = {
    neutro: "var(--inchiostro)",
    positivo: "var(--positivo)",
    allarme: "var(--allarme)",
    avviso: "var(--avviso)",
  };
  return (
    <div>
      <div className="occhiello">{label}</div>
      <div className="cifre" style={{ fontSize: 22, fontWeight: 650, color: colors[tone], letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: "var(--inchiostro-tenue)", marginTop: 1 }}>{hint}</div>}
    </div>
  );
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

const COLORE_RUOLO: Record<string, string> = {
  P: "#a16207",
  D: "#0f766e",
  C: "#1d4ed8",
  A: "#b91c1c",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className="cifre"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 700,
        color: "#fff",
        background: COLORE_RUOLO[role] ?? "var(--inchiostro-tenue)",
      }}
    >
      {role}
    </span>
  );
}

/** Barra del tetto salariale: ingaggi in blu, dead cap in rosso, spazio libero vuoto. */
export function CapBar({ committed, deadCap, cap }: { committed: Money; deadCap: Money; cap: Money }) {
  const pct = (v: Money) => `${Math.min(100, Math.max(0, (v / cap) * 100))}%`;
  return (
    <div className="barra" role="img" aria-label={`Monte ingaggi ${formatMoney(committed + deadCap)} su ${formatMoney(cap)}`}>
      <span className="quota-ingaggi" style={{ width: pct(committed) }} />
      {deadCap > 0 && <span className="quota-morta" style={{ width: pct(deadCap) }} />}
    </div>
  );
}

/** Elenco di errori e avvisi del motore regole, con l'articolo che li motiva. */
export function Issues({ errors = [], warnings = [] }: { errors?: ValidationIssue[]; warnings?: ValidationIssue[] }) {
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
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
    <p style={{ margin: 0, padding: "18px 4px", textAlign: "center", color: "var(--inchiostro-tenue)", fontSize: 13 }}>
      {children}
    </p>
  );
}

/** Contatore di un'opzione: quante ne restano su quante ne spettano (art. 6). */
export function OptionCounter({ label, used, total, article }: { label: string; used: number; total: number; article: string }) {
  const left = Math.max(0, total - used);
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "5px 0" }}>
      <span style={{ fontSize: 13 }}>
        {label} <span style={{ color: "var(--inchiostro-tenue)", fontSize: 11.5 }}>{article}</span>
      </span>
      <span className="cifre" style={{ fontWeight: 650, color: left === 0 ? "var(--allarme)" : "var(--inchiostro)" }}>
        {left}/{total}
      </span>
    </div>
  );
}

export function Row({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", alignItems: "center", gap }}>{children}</div>;
}
