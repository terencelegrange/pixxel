/**
 * lib/sql-compat.ts  —  SERVER ONLY
 *
 * String-building helpers for the small set of MySQL-only SQL constructs
 * used in this codebase, so the handful of call sites that need them can
 * branch on dialect without hand-writing both variants inline.
 */
import type { DbDialect } from "@/lib/setup";

const placeholders = (n: number) => Array(n).fill("?").join(", ");

// Backtick-quote every column identifier — several call sites use reserved
// words (e.g. `key` on app_settings), which break unquoted on MySQL/MariaDB.
// SQLite also accepts backtick quoting (its MySQL-compatibility quirk), so
// this is safe across both dialects.
const quote = (col: string) => `\`${col}\``;

export function insertIgnoreSql(table: string, columns: string[], dialect: DbDialect): string {
  const verb = dialect === "sqlite" ? "INSERT OR IGNORE" : "INSERT IGNORE";
  return `${verb} INTO ${table} (${columns.map(quote).join(", ")}) VALUES (${placeholders(columns.length)})`;
}

/**
 * Builds an upsert statement where every column except `updateColumn` is
 * part of the conflict target (matches how this codebase's existing
 * `ON DUPLICATE KEY UPDATE` call sites are shaped: all-but-last-column is
 * the unique/primary key, last column is the one being refreshed).
 */
export function upsertSql(table: string, columns: string[], updateColumn: string, dialect: DbDialect): string {
  const conflictColumns = columns.filter((c) => c !== updateColumn);
  const insert = `INSERT INTO ${table} (${columns.map(quote).join(", ")}) VALUES (${placeholders(columns.length)})`;
  if (dialect === "sqlite") {
    return `${insert} ON CONFLICT(${conflictColumns.map(quote).join(", ")}) DO UPDATE SET ${quote(updateColumn)} = excluded.${quote(updateColumn)}`;
  }
  return `${insert} ON DUPLICATE KEY UPDATE ${quote(updateColumn)} = VALUES(${quote(updateColumn)})`;
}

export function nowSql(dialect: DbDialect): string {
  return dialect === "sqlite" ? "CURRENT_TIMESTAMP" : "NOW()";
}
