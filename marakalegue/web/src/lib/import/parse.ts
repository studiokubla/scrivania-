import "server-only";

import ExcelJS from "exceljs";

/**
 * Lettura di fogli di calcolo e CSV.
 *
 * I file ufficiali di Leghe Fantacalcio non iniziano dall'intestazione: le prime
 * righe portano il titolo del listone e una riga vuota. Quindi non si assume che
 * l'intestazione sia la prima riga — la si cerca.
 */

export type Row = Record<string, string>;

export interface Sheet {
  headers: string[];
  rows: Row[];
  /** Indice, a partire da 1, della riga di intestazione trovata */
  headerRow: number;
}

function normalizeHeader(value: string): string {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (typeof v.text === "string") return v.text;
    if (v.result !== undefined) return String(v.result);
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

/**
 * Trova la riga di intestazione: la prima che contiene almeno `minColumns`
 * celle non vuote e almeno una delle parole attese.
 */
function findHeaderRow(matrix: string[][], expected: string[], minColumns: number): number {
  for (let i = 0; i < Math.min(matrix.length, 15); i += 1) {
    const cells = matrix[i].map((c) => normalizeHeader(c)).filter(Boolean);
    if (cells.length < minColumns) continue;
    if (expected.length === 0 || expected.some((e) => cells.includes(e))) return i;
  }
  return 0;
}

function matrixToSheet(matrix: string[][], expected: string[], minColumns: number): Sheet {
  const headerIndex = findHeaderRow(matrix, expected, minColumns);
  const headers = matrix[headerIndex]?.map(normalizeHeader) ?? [];

  const rows: Row[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const cells = matrix[i];
    if (!cells || cells.every((c) => !c)) continue;
    const row: Row = {};
    headers.forEach((h, j) => {
      if (h) row[h] = (cells[j] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows, headerRow: headerIndex + 1 };
}

export async function readSpreadsheet(
  buffer: ArrayBuffer,
  options: { expectedHeaders?: string[]; minColumns?: number } = {},
): Promise<Sheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Il file non contiene fogli di lavoro.");

  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellText(cell.value);
    });
    matrix.push(cells.map((c) => c ?? ""));
  });

  return matrixToSheet(matrix, options.expectedHeaders ?? [], options.minColumns ?? 3);
}

/** Parser CSV che regge le virgolette e i separatori `,` `;` `\t`. */
export function readCsv(
  text: string,
  options: { expectedHeaders?: string[]; minColumns?: number } = {},
): Sheet {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const separator = [";", "\t", ","]
    .map((s) => ({ s, n: firstLine.split(s).length }))
    .sort((a, b) => b.n - a.n)[0].s;

  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      matrix.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || row.length) {
    row.push(field.trim());
    matrix.push(row);
  }

  return matrixToSheet(matrix, options.expectedHeaders ?? [], options.minColumns ?? 2);
}

/** Legge un file caricato scegliendo il parser dall'estensione. */
export async function readUpload(
  file: File,
  options: { expectedHeaders?: string[]; minColumns?: number } = {},
): Promise<Sheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return readCsv(await file.text(), options);
  }
  return readSpreadsheet(await file.arrayBuffer(), options);
}

/** Numero all'italiana o all'inglese: "1.234,5" e "1234.5" danno lo stesso valore. */
export function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "");
  const italian = /,\d{1,2}$/.test(cleaned);
  const normalized = italian ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Prende il primo valore presente tra più intestazioni possibili. */
export function pickColumn(row: Row, ...candidates: string[]): string | undefined {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") return row[c];
  }
  return undefined;
}
