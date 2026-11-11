/** Convert an array of plain objects to CSV and trigger a browser download. */
export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: Array<{ key: keyof T; label: string }>,
): void {
  if (typeof window === "undefined") return;

  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // RFC 4180 — wrap in quotes if contains comma / quote / newline; double up inner quotes.
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(","))
    .join("\r\n");
  const csv = `${header}\r\n${body}`;

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
