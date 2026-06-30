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

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------
function getDbCredentials(): { host: string; port: number; user: string; password: string; database: string } | null {
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

// ---------------------------------------------------------------------------
// MySQL + MariaDB compatible column migration helper.
// `ALTER TABLE … ADD COLUMN IF NOT EXISTS` is MariaDB-only; MySQL 8.0 does
// not support the IF NOT EXISTS clause on ALTER TABLE.
// We achieve the same result by querying information_schema first.
// ---------------------------------------------------------------------------
async function addColIfMissing(
  db: Pool,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows.length === 0) {
    try {
      await db.execute(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
      );
    } catch (e: unknown) {
      // Race condition: another concurrent request already added the column
      if ((e as NodeJS.ErrnoException & { code?: string }).code !== 'ER_DUP_FIELDNAME') throw e;
    }
  }
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id          CHAR(36)      NOT NULL,
      name        VARCHAR(255)  NOT NULL,
      email       VARCHAR(255)  NOT NULL,
      password    VARCHAR(255)  NOT NULL COMMENT 'bcrypt hash',
      role        VARCHAR(50)   NOT NULL DEFAULT 'Member',
      created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS departments (
      id                CHAR(36)                          NOT NULL,
      name              VARCHAR(255)                      NOT NULL,
      description       TEXT                              NULL,
      status            ENUM('Published','Unpublished')   NOT NULL DEFAULT 'Unpublished',
      created_by_id     CHAR(36)                          NOT NULL,
      created_by_name   VARCHAR(255)                      NOT NULL,
      created_at        DATETIME                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME                          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                          ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_departments_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id                CHAR(36)        NOT NULL,
      name              VARCHAR(255)    NOT NULL,
      short_code        VARCHAR(50)     NULL,
      description       TEXT            NULL,
      type              ENUM('SaaS','On-Premise','Hybrid','Cloud','Open Source','Other')
                                        NOT NULL DEFAULT 'Other',
      category          VARCHAR(100)    NOT NULL DEFAULT 'Application',
      icon              VARCHAR(100)    NULL DEFAULT 'Server',
      vendor_id         CHAR(36)        NULL,
      lifecycle_status  ENUM('Proposed','Approved','In Development','Production','Sunset','Retired')
                                        NOT NULL DEFAULT 'Proposed',
      business_owner    VARCHAR(255)    NULL,
      technical_owner   VARCHAR(255)    NULL,
      vendor            VARCHAR(255)    NULL,
      sla_availability  VARCHAR(50)     NULL COMMENT 'e.g. 99.9%',
      sla_rto           VARCHAR(100)    NULL COMMENT 'Recovery Time Objective',
      sla_rpo           VARCHAR(100)    NULL COMMENT 'Recovery Point Objective',
      go_live_date      DATE            NULL,
      retirement_date   DATE            NULL,
      app_url           VARCHAR(500)    NULL,
      notes             TEXT            NULL,
      created_by_id     CHAR(36)        NOT NULL,
      created_by_name   VARCHAR(255)    NOT NULL,
      created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_assets_lifecycle (lifecycle_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tiers (
      id               CHAR(36)     NOT NULL,
      name             VARCHAR(255) NOT NULL,
      description      TEXT         NULL,
      sla_availability VARCHAR(50)  NULL,
      support_hours    VARCHAR(100) NULL,
      response_time    VARCHAR(100) NULL,
      resolution_time  VARCHAR(100) NULL,
      created_by_id    CHAR(36)     NOT NULL,
      created_by_name  VARCHAR(255) NOT NULL,
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tiers_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_strategies (
      id              CHAR(36)      NOT NULL,
      name            VARCHAR(255)  NOT NULL,
      description     TEXT          NULL,
      sort_order      INT UNSIGNED  NULL,
      created_by_id   CHAR(36)      NOT NULL,
      created_by_name VARCHAR(255)  NOT NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_asset_strategies_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS domains (
      id              CHAR(36)     NOT NULL,
      name            VARCHAR(255) NOT NULL,
      description     TEXT         NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_domains_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS vendors (
      id                    CHAR(36)      NOT NULL,
      name                  VARCHAR(255)  NOT NULL,
      website               VARCHAR(500)  NULL,
      email                 VARCHAR(255)  NULL,
      phone                 VARCHAR(100)  NULL,
      address_line1         VARCHAR(255)  NULL,
      address_line2         VARCHAR(255)  NULL,
      city                  VARCHAR(100)  NULL,
      state_province        VARCHAR(100)  NULL,
      country               VARCHAR(100)  NULL,
      postal_code           VARCHAR(20)   NULL,
      primary_contact_name  VARCHAR(255)  NULL,
      primary_contact_role  VARCHAR(100)  NULL,
      primary_contact_email VARCHAR(255)  NULL,
      primary_contact_phone VARCHAR(100)  NULL,
      notes                 TEXT          NULL,
      created_by_id         CHAR(36)      NOT NULL,
      created_by_name       VARCHAR(255)  NOT NULL,
      created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_vendors_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_departments (
      asset_id      CHAR(36) NOT NULL,
      department_id CHAR(36) NOT NULL,
      PRIMARY KEY (asset_id, department_id),
      KEY idx_asset_departments_dept (department_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id                CHAR(36)                        NOT NULL,
      table_name        VARCHAR(100)                    NOT NULL,
      record_id         CHAR(36)                        NOT NULL,
      action            ENUM('CREATE','UPDATE','DELETE') NOT NULL,
      performed_by_id   CHAR(36)                        NOT NULL,
      performed_by_name VARCHAR(255)                    NOT NULL,
      performed_at      DATETIME                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      old_values        JSON                            NULL COMMENT 'row state before change',
      new_values        JSON                            NULL COMMENT 'row state after change',
      PRIMARY KEY (id),
      KEY idx_audit_table_record (table_name, record_id),
      KEY idx_audit_performed_at (performed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Live migrations — idempotent, safe to run on every boot
  // Uses information_schema checks instead of MariaDB-only
  // "ADD COLUMN IF NOT EXISTS" so this works on MySQL 8.0 too.
  await addColIfMissing(db, 'vendors',          'primary_contact_role', 'VARCHAR(100) NULL AFTER primary_contact_name');
  await addColIfMissing(db, 'assets',           'domain_id',            'CHAR(36) NULL AFTER vendor_id');
  await addColIfMissing(db, 'assets',           'tier_id',              'CHAR(36) NULL AFTER icon');
  await addColIfMissing(db, 'assets',           'strategy_id',          'CHAR(36) NULL AFTER domain_id');
  await addColIfMissing(db, 'asset_strategies', 'sort_order',           'INT UNSIGNED NULL AFTER description');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      id               CHAR(36)     NOT NULL,
      name             VARCHAR(255) NOT NULL,
      description      TEXT         NULL,
      permission_level ENUM('read-only','member','admin') NOT NULL DEFAULT 'member',
      created_by_id    CHAR(36)     NOT NULL,
      created_by_name  VARCHAR(255) NOT NULL,
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_roles_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS support_requests (
      id          CHAR(36)     NOT NULL,
      user_id     CHAR(36)     NOT NULL,
      user_name   VARCHAR(255) NOT NULL,
      type        ENUM('Feature Request','Report Request','Bug','Other') NOT NULL DEFAULT 'Feature Request',
      subject     VARCHAR(500) NOT NULL,
      description TEXT         NULL,
      status      ENUM('Open','In Progress','Resolved') NOT NULL DEFAULT 'Open',
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_support_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColIfMissing(db, 'users', 'role_id', 'CHAR(36) NULL AFTER role');

  // Migrate status column: widen to VARCHAR first so remapping works,
  // then apply the final ENUM definition
  await db.execute(`ALTER TABLE support_requests MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'New'`);
  await db.execute(`UPDATE support_requests SET status = 'New'          WHERE status = 'Open'`);
  await db.execute(`UPDATE support_requests SET status = 'Under Review' WHERE status = 'In Progress'`);
  await db.execute(`UPDATE support_requests SET status = 'Completed'    WHERE status = 'Resolved'`);
  await db.execute(`
    ALTER TABLE support_requests
      MODIFY COLUMN status ENUM('New','Acknowledged','Under Review','Will Fix','Will Not Implement','Completed')
        NOT NULL DEFAULT 'New'
  `);

  await addColIfMissing(db, 'assets', 'doc_url',           'VARCHAR(500) NULL AFTER app_url');
  await addColIfMissing(db, 'assets', 'contract_end_date', 'DATE NULL AFTER retirement_date');
  await addColIfMissing(db, 'assets', 'contract_amount',   'DECIMAL(15,2) NULL AFTER contract_end_date');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id               CHAR(36)     NOT NULL,
      name             VARCHAR(255) NOT NULL,
      description      TEXT         NULL,
      status           ENUM('Active','On Hold','Completed','Cancelled') NOT NULL DEFAULT 'Active',
      start_date       DATE         NULL,
      end_date         DATE         NULL,
      created_by_id    CHAR(36)     NOT NULL,
      created_by_name  VARCHAR(255) NOT NULL,
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_architects (
      asset_id   CHAR(36)     NOT NULL,
      user_id    CHAR(36)     NOT NULL,
      user_name  VARCHAR(255) NOT NULL,
      PRIMARY KEY (asset_id, user_id),
      KEY idx_asset_architects_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS project_assets (
      project_id       CHAR(36)                        NOT NULL,
      asset_id         CHAR(36)                        NOT NULL,
      dependency_type  ENUM('upstream','downstream')   NOT NULL DEFAULT 'downstream',
      notes            TEXT                            NULL,
      PRIMARY KEY (project_id, asset_id),
      KEY idx_project_assets_asset (asset_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS diagrams (
      id              CHAR(36)     NOT NULL,
      name            VARCHAR(255) NOT NULL,
      description     TEXT         NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS diagram_versions (
      id              CHAR(36)      NOT NULL,
      diagram_id      CHAR(36)      NOT NULL,
      version_number  INT UNSIGNED  NOT NULL,
      content         LONGTEXT      NOT NULL COMMENT 'Excalidraw JSON',
      created_by_id   CHAR(36)      NOT NULL,
      created_by_name VARCHAR(255)  NOT NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_diagram_version (diagram_id, version_number),
      KEY idx_diagram_versions_diagram (diagram_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS diagram_assets (
      diagram_id CHAR(36) NOT NULL,
      asset_id   CHAR(36) NOT NULL,
      PRIMARY KEY (diagram_id, asset_id),
      KEY idx_diagram_assets_asset (asset_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColIfMissing(db, 'diagrams', 'project_id', 'CHAR(36) NULL AFTER description');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS diagram_types (
      id              CHAR(36)     NOT NULL,
      name            VARCHAR(100) NOT NULL,
      description     TEXT         NULL,
      sort_order      INT UNSIGNED NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_diagram_type_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    INSERT IGNORE INTO diagram_types (id, name, description, sort_order, created_by_id, created_by_name) VALUES
      ('dtype000-0000-0000-0000-000000000001', 'Domain',   'High-level domain architecture overview',        1, 'system', 'System'),
      ('dtype000-0000-0000-0000-000000000002', 'Program',  'Program-level architecture diagram',             2, 'system', 'System'),
      ('dtype000-0000-0000-0000-000000000003', 'Solution', 'Solution architecture diagram',                  3, 'system', 'System'),
      ('dtype000-0000-0000-0000-000000000004', 'Detailed', 'Detailed technical architecture diagram',        4, 'system', 'System')
  `);

  await addColIfMissing(db, 'diagrams', 'diagram_type_id', 'CHAR(36) NULL AFTER project_id');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_complexities (
      id              CHAR(36)     NOT NULL,
      name            VARCHAR(255) NOT NULL,
      description     TEXT         NULL,
      sort_order      INT UNSIGNED NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_asset_complexities_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColIfMissing(db, 'assets', 'complexity_id', 'CHAR(36) NULL AFTER strategy_id');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_capabilities (
      asset_id              CHAR(36) NOT NULL,
      business_capability_id CHAR(36) NOT NULL,
      PRIMARY KEY (asset_id, business_capability_id),
      KEY idx_asset_capabilities_cap (business_capability_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS industry_sectors (
      id              CHAR(36)     NOT NULL,
      name            VARCHAR(255) NOT NULL,
      description     TEXT         NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_industry_sectors_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS business_capabilities (
      id                 CHAR(36)     NOT NULL,
      name               VARCHAR(255) NOT NULL,
      description        TEXT         NULL,
      industry_sector_id CHAR(36)     NOT NULL,
      sort_order         INT UNSIGNED NULL,
      created_by_id      CHAR(36)     NOT NULL,
      created_by_name    VARCHAR(255) NOT NULL,
      created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_business_capabilities_industry (industry_sector_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
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
    CREATE TABLE IF NOT EXISTS changelog (
      id              CHAR(36)                                               NOT NULL,
      version         VARCHAR(50)                                            NOT NULL,
      title           VARCHAR(500)                                           NOT NULL,
      description     TEXT                                                   NULL,
      type            ENUM('feature','fix','improvement','breaking')         NOT NULL DEFAULT 'feature',
      released_at     DATE                                                   NOT NULL,
      created_by_id   CHAR(36)                                              NOT NULL,
      created_by_name VARCHAR(255)                                           NOT NULL,
      created_at      DATETIME                                               NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME                                               NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                                             ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_changelog_released_at (released_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      \`key\`       VARCHAR(255)  NOT NULL,
      \`value\`     TEXT          NULL,
      updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS plantuml_diagrams (
      id              CHAR(36)     NOT NULL,
      name            VARCHAR(255) NOT NULL,
      description     TEXT         NULL,
      project_id      CHAR(36)     NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS plantuml_versions (
      id              CHAR(36)      NOT NULL,
      diagram_id      CHAR(36)      NOT NULL,
      version_number  INT UNSIGNED  NOT NULL,
      source          LONGTEXT      NOT NULL,
      created_by_id   CHAR(36)      NOT NULL,
      created_by_name VARCHAR(255)  NOT NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_plantuml_version (diagram_id, version_number),
      KEY idx_plantuml_versions_diagram (diagram_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS plantuml_diagram_assets (
      diagram_id  CHAR(36)     NOT NULL,
      asset_id    CHAR(36)     NOT NULL,
      matched_on  VARCHAR(255) NULL COMMENT 'which field matched: name or short_code',
      tagged_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (diagram_id, asset_id),
      KEY idx_pda_asset (asset_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS investment_classifications (
      id              CHAR(36)     NOT NULL,
      name            VARCHAR(100) NOT NULL,
      color           VARCHAR(20)  NOT NULL,
      sort_order      INT UNSIGNED NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_roadmap_phases (
      id                CHAR(36)     NOT NULL,
      asset_id          CHAR(36)     NOT NULL,
      classification_id CHAR(36)     NOT NULL,
      start_quarter     VARCHAR(7)   NOT NULL,
      end_quarter       VARCHAR(7)   NOT NULL,
      notes             TEXT         NULL,
      created_by_id     CHAR(36)     NOT NULL,
      created_by_name   VARCHAR(255) NOT NULL,
      created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_phases_asset_id (asset_id),
      KEY idx_phases_classification_id (classification_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColIfMissing(db, 'assets', 'hero_diagram_id', 'CHAR(36) NULL AFTER icon');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_dependencies (
      id              CHAR(36)     NOT NULL,
      source_asset_id CHAR(36)     NOT NULL,
      target_asset_id CHAR(36)     NOT NULL,
      type            ENUM('API','Database','File Transfer','Event / Message','UI Embed','Other')
                                   NOT NULL DEFAULT 'API',
      direction       ENUM('outbound','bidirectional')
                                   NOT NULL DEFAULT 'outbound',
      notes           TEXT         NULL,
      created_by_id   CHAR(36)     NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_dep_pair (source_asset_id, target_asset_id),
      KEY idx_dep_source (source_asset_id),
      KEY idx_dep_target (target_asset_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
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
