/** Minimal RFC 4180 CSV reader/writer for library and blueprint import/export. */

export type CsvRow = Record<string, string>;

const needsQuoting = (value: string) => /[",\r\n]/.test(value);

export function toCsv(rows: CsvRow[], columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (value: string) => {
    const v = value ?? "";
    return needsQuoting(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [cols.join(",")];
  for (const row of rows) lines.push(cols.map((c) => cell(row[c] ?? "")).join(","));
  return lines.join("\r\n");
}

/** Splits a CSV document into rows of cells, honouring quoted fields and embedded newlines. */
function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Treat CRLF as one terminator and ignore blank lines.
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function fromCsv(text: string): CsvRow[] {
  const grid = splitCsv(text.replace(/^﻿/, ""));
  if (!grid.length) return [];
  const header = (grid[0] ?? []).map((h) => h.trim());
  return grid.slice(1).map((cells) => {
    const row: CsvRow = {};
    header.forEach((key, i) => {
      if (key) row[key] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

/** Hands the browser a file to save. */
export function downloadFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const downloadJson = (filename: string, value: unknown) =>
  downloadFile(filename, JSON.stringify(value, null, 2), "application/json");

export const downloadCsv = (filename: string, rows: CsvRow[], columns?: string[]) =>
  downloadFile(filename, toCsv(rows, columns), "text/csv");
