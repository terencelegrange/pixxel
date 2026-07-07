/**
 * lib/sql-compat.ts  —  SERVER ONLY
 *
 * String-building helpers for the small set of MySQL-only SQL constructs
 * used in this codebase, so the handful of call sites that need them can
 * branch on dialect without hand-writing both variants inline.
 */
import type { DbDialect } from "@/lib/setup";

const placeholders = (n: number) => Array(n).fill("?").join(", ");

export function insertIgnoreSql(table: string, columns: string[], dialect: DbDialect): string {
  const verb = dialect === "sqlite" ? "INSERT OR IGNORE" : "INSERT IGNORE";
  return `${verb} INTO ${table} (${columns.join(", ")}) VALUES (${placeholders(columns.length)})`;
}

/**
 * Builds an upsert statement where every column except `updateColumn` is
 * part of the conflict target (matches how this codebase's existing
 * `ON DUPLICATE KEY UPDATE` call sites are shaped: all-but-last-column is
 * the unique/primary key, last column is the one being refreshed).
 */
export function upsertSql(table: string, columns: string[], updateColumn: string, dialect: DbDialect): string {
  const conflictColumns = columns.filter((c) => c !== updateColumn);
  const insert = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders(columns.length)})`;
  if (dialect === "sqlite") {
    return `${insert} ON CONFLICT(${conflictColumns.join(", ")}) DO UPDATE SET ${updateColumn} = excluded.${updateColumn}`;
  }
  return `${insert} ON DUPLICATE KEY UPDATE ${updateColumn} = VALUES(${updateColumn})`;
}

export function nowSql(dialect: DbDialect): string {
  return dialect === "sqlite" ? "CURRENT_TIMESTAMP" : "NOW()";
}
