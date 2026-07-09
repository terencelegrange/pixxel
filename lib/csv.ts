// lib/csv.ts — small quote-aware CSV parser (no dependency; RFC 4180-ish subset)
//
// Handles: comma-delimited fields, double-quoted fields (may contain commas
// and newlines), escaped quotes via doubled `""`, and CRLF/LF line endings.
// The first row is treated as the header row; each subsequent row becomes a
// Record<string,string> keyed by header (missing trailing cells => "").

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const table: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Normalise CRLF -> LF so we don't have to special-case \r.
  const src = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      table.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  // Flush the final field/row (files may or may not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    table.push(row);
  }

  // Drop fully-empty trailing rows (e.g. a trailing blank line).
  while (table.length > 0 && table[table.length - 1].every((c) => c === "")) {
    table.pop();
  }

  if (table.length === 0) return { headers: [], rows: [] };

  const headers = table[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = cells[c] ?? "";
    }
    rows.push(record);
  }

  return { headers, rows };
}
