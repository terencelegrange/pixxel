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
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getSiteConfig, type DbDialect } from "@/lib/setup";

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

export function getDb(): Pool {
  return getPool();
}

export function resetPool(): void {
  g._dbPool = undefined;
  g._dbInitPromise = null;
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
  if (!g._dbInitPromise) {
    g._dbInitPromise = runSetup().catch((err) => {
      g._dbInitPromise = null; // allow retry on next invocation
      return Promise.reject(err);
    });
  }
  return g._dbInitPromise;
}

async function runSetup(): Promise<void> {
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

  await db.execute(`
    INSERT IGNORE INTO diagram_types (id, name, description, sort_order, created_by_id, created_by_name) VALUES
      ('dtype000-0000-0000-0000-000000000001', 'Domain',   'High-level domain architecture overview',        1, 'system', 'System'),
      ('dtype000-0000-0000-0000-000000000002', 'Program',  'Program-level architecture diagram',             2, 'system', 'System'),
      ('dtype000-0000-0000-0000-000000000003', 'Solution', 'Solution architecture diagram',                  3, 'system', 'System'),
      ('dtype000-0000-0000-0000-000000000004', 'Detailed', 'Detailed technical architecture diagram',        4, 'system', 'System')
  `);

  // Seed: Telecommunications industry sector
  await db.execute(`
    INSERT IGNORE INTO industry_sectors (id, name, description, created_by_id, created_by_name)
    VALUES ('00000001-ind-0000-0000-000000000001', 'Telecommunications',
      'Providers of voice, data, and broadband connectivity services.',
      'system', 'System')
  `);

  // Seed: Utilities (Energy) industry sector
  await db.execute(`
    INSERT IGNORE INTO industry_sectors (id, name, description, created_by_id, created_by_name)
    VALUES ('00000001-ind-0000-0000-000000000002', 'Utilities (Energy)',
      'Providers of electricity, gas, and water distribution services.',
      'system', 'System')
  `);

  // Seed: Telecommunications business capabilities
  const telecoCaps = [
    ['00000002-cap-0000-0000-000000000001', 'Network Management',              'Planning, provisioning, and operating the core and access network.',          1],
    ['00000002-cap-0000-0000-000000000002', 'Voice & Calling Services',         'Management of voice, conferencing, and unified communications products.',     2],
    ['00000002-cap-0000-0000-000000000003', 'Data & Connectivity Services',     'Broadband, mobile data, and enterprise connectivity offerings.',              3],
    ['00000002-cap-0000-0000-000000000004', 'Customer Management',              'Acquisition, onboarding, retention, and care of customers.',                  4],
    ['00000002-cap-0000-0000-000000000005', 'Billing & Revenue Management',     'Rating, billing, collections, and revenue assurance.',                        5],
    ['00000002-cap-0000-0000-000000000006', 'Product Management',               'Design, launch, and lifecycle management of products and services.',          6],
    ['00000002-cap-0000-0000-000000000007', 'Service Assurance',                'Monitoring, fault management, and SLA performance management.',               7],
    ['00000002-cap-0000-0000-000000000008', 'Network Planning & Engineering',   'Capacity planning, design, and technology evolution of the network.',         8],
    ['00000002-cap-0000-0000-000000000009', 'Field Operations',                 'Installation, maintenance, and repair of physical infrastructure.',           9],
    ['00000002-cap-0000-0000-000000000010', 'Digital Channels & Self-Service',  'Web, mobile, and API-driven customer interaction channels.',                 10],
    ['00000002-cap-0000-0000-000000000011', 'Wholesale & Interconnect',         'Carrier relations, roaming, and inter-operator settlement.',                 11],
    ['00000002-cap-0000-0000-000000000012', 'Regulatory & Compliance',          'Licence management, regulatory reporting, and legal compliance.',            12],
  ];
  for (const [id, name, description, sortOrder] of telecoCaps) {
    await db.execute(
      `INSERT IGNORE INTO business_capabilities
         (id, name, description, industry_sector_id, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, '00000001-ind-0000-0000-000000000001', ?, 'system', 'System')`,
      [id, name, description, sortOrder]
    );
  }

  // Seed: Utilities (Energy) business capabilities
  const utilityCaps = [
    ['00000003-cap-0000-0000-000000000001', 'Energy Generation',                  'Operation of power plants and renewable energy assets.',                     1],
    ['00000003-cap-0000-0000-000000000002', 'Energy Transmission',                'High-voltage bulk power transmission across the grid.',                      2],
    ['00000003-cap-0000-0000-000000000003', 'Energy Distribution',                'Low-voltage distribution of electricity to end consumers.',                  3],
    ['00000003-cap-0000-0000-000000000004', 'Metering & Smart Grid',              'Smart meter deployment, data collection, and grid intelligence.',            4],
    ['00000003-cap-0000-0000-000000000005', 'Customer Operations',                'Customer acquisition, service requests, and complaint management.',          5],
    ['00000003-cap-0000-0000-000000000006', 'Billing & Revenue Management',       'Energy usage billing, tariff management, and debt recovery.',                6],
    ['00000003-cap-0000-0000-000000000007', 'Asset Management',                   'Lifecycle management of physical grid and generation assets.',               7],
    ['00000003-cap-0000-0000-000000000008', 'Field Operations',                   'Inspection, maintenance, and emergency response for infrastructure.',        8],
    ['00000003-cap-0000-0000-000000000009', 'Energy Trading & Risk Management',   'Wholesale energy procurement, trading, and market risk management.',         9],
    ['00000003-cap-0000-0000-000000000010', 'Regulatory & Compliance',            'Licence obligations, safety reporting, and environmental compliance.',      10],
    ['00000003-cap-0000-0000-000000000011', 'Environmental Management',           'Emissions tracking, sustainability reporting, and carbon management.',      11],
    ['00000003-cap-0000-0000-000000000012', 'Network Planning & Investment',      'Grid investment planning, capacity modelling, and project delivery.',       12],
  ];
  for (const [id, name, description, sortOrder] of utilityCaps) {
    await db.execute(
      `INSERT IGNORE INTO business_capabilities
         (id, name, description, industry_sector_id, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, '00000001-ind-0000-0000-000000000002', ?, 'system', 'System')`,
      [id, name, description, sortOrder]
    );
  }

  await db.execute(`
    INSERT INTO investment_classifications (id, name, color, sort_order, created_by_id, created_by_name)
    SELECT * FROM (
      SELECT UUID() AS id, 'Invest' AS name, '#22c55e' AS color, 1 AS sort_order, 'system' AS created_by_id, 'System' AS created_by_name UNION ALL
      SELECT UUID(), 'Experiment',   '#3b82f6', 2, 'system', 'System' UNION ALL
      SELECT UUID(), 'Contain',      '#eab308', 3, 'system', 'System' UNION ALL
      SELECT UUID(), 'Decommission', '#ef4444', 4, 'system', 'System'
    ) AS seed
    WHERE NOT EXISTS (SELECT 1 FROM investment_classifications LIMIT 1)
  `);

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
  callback: (conn: mysql.Connection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
