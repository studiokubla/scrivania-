/**
 * Aritmetica degli importi della lega.
 *
 * Tutti gli importi si muovono a step di 0,25 M. In virgola mobile 0,1 + 0,2 non fa 0,3
 * e un tetto salariale sbagliato di un centesimo è un tetto salariale sbagliato, quindi
 * internamente si lavora su **interi in centesimi di milione**: 1 M = 100, 0,25 M = 25.
 *
 * La conversione avviene solo ai bordi: lettura dal database, scrittura, interfaccia.
 */

/** Importo in centesimi di milione. 250 = 2,5 M. */
export type Money = number;

/** Un quarto di milione, il passo minimo del regolamento. */
export const STEP: Money = 25;

export function fromMillions(value: number | string): Money {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) throw new Error(`Importo non valido: ${value}`);
  return Math.round(n * 100);
}

export function toMillions(value: Money): number {
  return value / 100;
}

/** Per scrivere su una colonna Decimal(10,2) di Postgres. */
export function toDecimalString(value: Money): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Per leggere una colonna Decimal, che il client Prisma restituisce come stringa o Decimal. */
export function fromDecimal(value: unknown): Money {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Math.round(value * 100);
  return fromMillions(String(value));
}

/**
 * Arrotonda al passo di 0,25 M. Il regolamento (art. 4.3) dice "per eccesso":
 * un escalator non deve mai far risparmiare per via di un arrotondamento.
 */
export function roundToStep(value: Money): Money {
  return Math.ceil(value / STEP) * STEP;
}

export function isOnStep(value: Money): boolean {
  return value % STEP === 0;
}

/** Applica una percentuale e riporta sul passo. `+10%` si scrive `applyRate(v, 1.1)`. */
export function applyRate(value: Money, rate: number): Money {
  return roundToStep(Math.round(value * rate));
}

/** Formattazione per l'interfaccia: 1250 → "12,5 M", 25 → "0,25 M". */
export function formatMoney(value: Money, opts: { sign?: boolean } = {}): string {
  const millions = toMillions(value);
  const formatted = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(millions));
  const sign = value < 0 ? "−" : opts.sign && value > 0 ? "+" : "";
  return `${sign}${formatted} M`;
}

export function sum(values: Money[]): Money {
  return values.reduce<Money>((acc, v) => acc + v, 0);
}
