/**
 * lib/db-sqlite.ts  —  SERVER ONLY
 *
 * SQLite trial-mode backend, built on Node's built-in `node:sqlite`
 * (DatabaseSync) — no native dependency to compile. Exposes the same
 * execute(sql, params) -> [rows, meta] contract as mysql2's Pool so route
 * files don't need to know which dialect is active.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  SEED_DIAGRAM_TYPES, SEED_INDUSTRY_SECTORS, SEED_TELECOM_CAPABILITIES,
  SEED_UTILITY_CAPABILITIES, SEED_INVESTMENT_CLASSIFICATIONS,
} from "@/lib/db-seed-data";

export interface DbClient {
  execute<T = unknown>(sql: string, params?: unknown[]): Promise<[T, unknown]>;
}

const g = globalThis as typeof globalThis & {
  _sqliteConn?: DatabaseSync;
  _sqliteInitPromise?: Promise<void> | null;
};

function isSelectLike(sqlText: string): boolean {
  return /^\s*(SELECT|PRAGMA|WITH)/i.test(sqlText);
}

/**
 * Returns the cached single DatabaseSync connection for this process.
 * Trial mode uses a single shared connection by design (no pooling, no locking).
 * Acceptable for expected single-admin, low-traffic usage; not suitable for
 * concurrent production workloads.
 */
function getConnection(filePath: string): DatabaseSync {
  if (!g._sqliteConn) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    g._sqliteConn = new DatabaseSync(filePath);
    g._sqliteConn.exec("PRAGMA foreign_keys = ON");
  }
  return g._sqliteConn;
}

function makeClient(conn: DatabaseSync): DbClient {
  return {
    async execute<T = unknown>(sqlText: string, params: unknown[] = []): Promise<[T, unknown]> {
      const stmt = conn.prepare(sqlText);
      if (isSelectLike(sqlText)) {
        return [stmt.all(...(params as any[])) as T, undefined];
      }
      stmt.run(...(params as any[]));
      return [[] as unknown as T, undefined];
    },
  };
}

export function getSqliteDb(filePath: string): DbClient {
  return makeClient(getConnection(filePath));
}

export function resetSqlitePool(): void {
  if (g._sqliteConn) g._sqliteConn.close();
  g._sqliteConn = undefined;
  g._sqliteInitPromise = null;
}

/**
 * Execute a callback within a SQLite transaction. Reuses the global shared connection
 * with no concurrency control. Concurrent calls to this function are not safe: if two
 * callers invoke withSqliteTransaction simultaneously, the second caller's BEGIN will
 * run against an already-open transaction on the same connection, which SQLite will
 * reject. This is an acceptable limitation for trial mode's single-admin use case; a
 * production backend would require a write queue or connection pool.
 */
export async function withSqliteTransaction<T>(
  filePath: string,
  callback: (tx: DbClient) => Promise<T>
): Promise<T> {
  const conn = getConnection(filePath);
  const client = makeClient(conn);
  conn.exec("BEGIN");
  try {
    const result = await callback(client);
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

export function setupSqliteDatabase(filePath: string): Promise<void> {
  if (!g._sqliteInitPromise) {
    g._sqliteInitPromise = runSqliteSetup(filePath).catch((err) => {
      g._sqliteInitPromise = null;
      return Promise.reject(err);
    });
  }
  return g._sqliteInitPromise;
}

async function runSqliteSetup(filePath: string): Promise<void> {
  const conn = getConnection(filePath);

  conn.exec(`
    CREATE TABLE IF NOT EXISTS __pixxel_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(process.cwd(), "drizzle", "migrations-sqlite");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const appliedRows = conn.prepare("SELECT filename FROM __pixxel_migrations").all() as { filename: string }[];
  const applied = new Set(appliedRows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) continue;
    conn.exec(fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
    conn.prepare("INSERT INTO __pixxel_migrations (filename) VALUES (?)").run(file);
  }

  const insertIgnore = (sqlText: string, params: unknown[]) => {
    conn.prepare(sqlText).run(...(params as any[]));
  };

  for (const t of SEED_DIAGRAM_TYPES) {
    insertIgnore(
      "INSERT OR IGNORE INTO diagram_types (id, name, description, sort_order, created_by_id, created_by_name) VALUES (?, ?, ?, ?, 'system', 'System')",
      [t.id, t.name, t.description, t.sortOrder]
    );
  }

  for (const s of SEED_INDUSTRY_SECTORS) {
    insertIgnore(
      "INSERT OR IGNORE INTO industry_sectors (id, name, description, created_by_id, created_by_name) VALUES (?, ?, ?, 'system', 'System')",
      [s.id, s.name, s.description]
    );
  }

  for (const [id, name, description, sortOrder] of SEED_TELECOM_CAPABILITIES) {
    insertIgnore(
      `INSERT OR IGNORE INTO business_capabilities
         (id, name, description, industry_sector_id, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, '00000001-ind-0000-0000-000000000001', ?, 'system', 'System')`,
      [id, name, description, sortOrder]
    );
  }

  for (const [id, name, description, sortOrder] of SEED_UTILITY_CAPABILITIES) {
    insertIgnore(
      `INSERT OR IGNORE INTO business_capabilities
         (id, name, description, industry_sector_id, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, '00000001-ind-0000-0000-000000000002', ?, 'system', 'System')`,
      [id, name, description, sortOrder]
    );
  }

  const countRow = conn.prepare("SELECT COUNT(*) AS count FROM investment_classifications").get() as { count: number };
  if (Number(countRow.count) === 0) {
    for (const c of SEED_INVESTMENT_CLASSIFICATIONS) {
      conn.prepare(
        "INSERT INTO investment_classifications (id, name, color, sort_order, created_by_id, created_by_name) VALUES (?, ?, ?, ?, 'system', 'System')"
      ).run(randomUUID(), c.name, c.color, c.sortOrder);
    }
  }
}
