/**
 * lib/db.ts  —  SERVER ONLY
 *
 * Creates a mysql2 connection pool (singleton) and exposes
 * a setupDatabase() helper that creates the schema on first run.
 * Both functions throw on connection failure so callers surface
 * a clear error instead of a cryptic undefined.
 *
 * Credentials are resolved in priority order:
 *   1. Environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 *   2. site.config.json  (written during the /setup wizard)
 */
import mysql, { Pool } from "mysql2/promise";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getSiteConfig, type DbDialect } from "@/lib/setup";
import {
  getSqliteDb, setupSqliteDatabase, withSqliteTransaction, resetSqlitePool,
  type DbClient,
} from "@/lib/db-sqlite";
import {
  SEED_DIAGRAM_TYPES, SEED_INDUSTRY_SECTORS, SEED_TELECOM_CAPABILITIES,
  SEED_UTILITY_CAPABILITIES, SEED_INVESTMENT_CLASSIFICATIONS,
} from "@/lib/db-seed-data";

// ---------------------------------------------------------------------------
// Dialect and SQLite path resolution
// ---------------------------------------------------------------------------
export function getDbDialect(): DbDialect {
  const config = getSiteConfig();
  if (config?.db) return config.db.dialect;
  if (process.env.DB_TYPE === "sqlite") return "sqlite";
  return "mysql";
}

export function getSqliteFilePath(): string {
  const config = getSiteConfig();
  if (config?.db?.dialect === "sqlite") return config.db.file;
  if (process.env.DB_FILE) return process.env.DB_FILE;
  return path.join(process.cwd(), "data", "pixxel.db");
}

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------
export function getDbCredentials(): { host: string; port: number; user: string; password: string; database: string } | null {
  // Prefer site.config.json when it has been written by the setup wizard.
  // This ensures credentials entered in the UI always take effect, even when
  // stale env vars from a previous config are still loaded in the process.
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "site.config.json"), "utf-8");
    const config = JSON.parse(raw);
    if (config?.db?.host) {
      return {
        host: config.db.host,
        port: Number(config.db.port ?? 3306),
        user: config.db.user ?? "root",
        password: config.db.password ?? "",
        database: config.db.name ?? "saas_app",
      };
    }
  } catch {
    // site.config.json not present — fall through to env vars
  }

  // Fall back to environment variables (useful for Docker / CI deployments
  // that don't use the setup wizard)
  if (process.env.DB_HOST !== undefined) {
    return {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "saas_app",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Singleton pool — stored on globalThis so Next.js HMR does not create a
// fresh pool (and leak connections) every time this module is re-evaluated.
// ---------------------------------------------------------------------------
const g = globalThis as typeof globalThis & {
  _dbPool?: Pool;
  _dbInitPromise?: Promise<void> | null;
};

function getPool(): Pool {
  if (!g._dbPool) {
    const creds = getDbCredentials();
    if (!creds) {
      throw new Error(
        "Database credentials not configured. Complete /setup first or set DB_* environment variables."
      );
    }
    g._dbPool = mysql.createPool({
      ...creds,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return g._dbPool;
}

export function getDb(): DbClient {
  if (getDbDialect() === "sqlite") {
    return getSqliteDb(getSqliteFilePath());
  }
  return getPool() as unknown as DbClient;
}

export function resetPool(): void {
  g._dbPool = undefined;
  g._dbInitPromise = null;
  resetSqlitePool();
}

// ---------------------------------------------------------------------------
// Schema bootstrap
// Called at the top of every API route so the table always exists,
// even on a fresh database. All statements are idempotent.
// Using a promise singleton so concurrent callers share one init run
// instead of each spawning their own bootstrap connection.
// On failure the promise is cleared so the next call can retry
// (e.g. after a transient connection error).
// ---------------------------------------------------------------------------
export function setupDatabase(): Promise<void> {
  if (getDbDialect() === "sqlite") {
    return setupSqliteDatabase(getSqliteFilePath());
  }
  if (!g._dbInitPromise) {
    g._dbInitPromise = runMysqlSetup().catch((err) => {
      g._dbInitPromise = null; // allow retry on next invocation
      return Promise.reject(err);
    });
  }
  return g._dbInitPromise;
}

async function runMysqlSetup(): Promise<void> {
  const creds = getDbCredentials();
  if (!creds) {
    throw new Error("Cannot run database setup: no credentials configured.");
  }

  // Ensure the database itself exists (connect without specifying db first)
  const bootstrap = await mysql.createConnection({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
  });

  const dbName = creds.database;
  await bootstrap.execute(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  // Now create tables inside the database via the pool
  const db = getPool();

  // Serialize setup across all parallel Next.js build workers / processes
  await db.execute<mysql.RowDataPacket[]>("SELECT GET_LOCK('pixxel_db_setup', 60) AS ok");
  try {

  // Schema is owned by drizzle/schema.ts and applied via versioned migration
  // files in drizzle/migrations/ (generate new ones with `npx drizzle-kit
  // generate` after editing the schema). This replaces the old approach of
  // hand-written CREATE TABLE / ADD COLUMN IF NOT EXISTS statements run
  // directly in this function.
  await migrate(drizzle(db), { migrationsFolder: path.join(process.cwd(), "drizzle", "migrations") });

  // Seed data below is reference/lookup data, not schema — it stays here as
  // idempotent inserts rather than migration files.

  for (const t of SEED_DIAGRAM_TYPES) {
    await db.execute(
      "INSERT IGNORE INTO diagram_types (id, name, description, sort_order, created_by_id, created_by_name) VALUES (?, ?, ?, ?, 'system', 'System')",
      [t.id, t.name, t.description, t.sortOrder]
    );
  }

  for (const s of SEED_INDUSTRY_SECTORS) {
    await db.execute(
      "INSERT IGNORE INTO industry_sectors (id, name, description, created_by_id, created_by_name) VALUES (?, ?, ?, 'system', 'System')",
      [s.id, s.name, s.description]
    );
  }

  for (const [id, name, description, sortOrder] of SEED_TELECOM_CAPABILITIES) {
    await db.execute(
      `INSERT IGNORE INTO business_capabilities
         (id, name, description, industry_sector_id, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, '00000001-ind-0000-0000-000000000001', ?, 'system', 'System')`,
      [id, name, description, sortOrder]
    );
  }

  for (const [id, name, description, sortOrder] of SEED_UTILITY_CAPABILITIES) {
    await db.execute(
      `INSERT IGNORE INTO business_capabilities
         (id, name, description, industry_sector_id, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, '00000001-ind-0000-0000-000000000002', ?, 'system', 'System')`,
      [id, name, description, sortOrder]
    );
  }

  const [[{ count }]] = [
    (await db.execute<mysql.RowDataPacket[]>("SELECT COUNT(*) AS count FROM investment_classifications"))[0],
  ];
  if (Number(count) === 0) {
    for (const c of SEED_INVESTMENT_CLASSIFICATIONS) {
      await db.execute(
        "INSERT INTO investment_classifications (id, name, color, sort_order, created_by_id, created_by_name) VALUES (?, ?, ?, ?, 'system', 'System')",
        [randomUUID(), c.name, c.color, c.sortOrder]
      );
    }
  }

  } finally {
    await db.execute("SELECT RELEASE_LOCK('pixxel_db_setup')");
  }
}

// ---------------------------------------------------------------------------
// Transaction helper
// Runs callback inside a BEGIN/COMMIT block. Rolls back automatically on throw.
// Usage:
//   await withTransaction(async (tx) => {
//     await tx.execute("INSERT INTO ...", [...]);
//     await tx.execute("INSERT INTO ...", [...]);
//   });
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  callback: (conn: DbClient) => Promise<T>
): Promise<T> {
  if (getDbDialect() === "sqlite") {
    return withSqliteTransaction(getSqliteFilePath(), callback);
  }
  const conn = await getPool().getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn as unknown as DbClient);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
