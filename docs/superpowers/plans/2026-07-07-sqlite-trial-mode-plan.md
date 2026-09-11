# SQLite Trial Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user choose SQLite (embedded, single-container, trial-only) or MySQL/MariaDB as the database backend during the `/setup` wizard, with no other route-level behavior change required for ~50 of the ~63 API route files.

**Architecture:** `lib/db.ts` becomes a dialect dispatcher exposing the same `execute(sql, params) → [rows, meta]` contract mysql2 already provides. A new `lib/db-sqlite.ts` implements that contract on top of Node's built-in `node:sqlite` (`DatabaseSync`) — no native dependency to compile. A parallel `drizzle/schema.sqlite.ts` + `drizzle/migrations-sqlite/` provide the SQLite schema (drizzle-kit used only as a DDL generator, same as the existing MySQL setup — migrations are applied by a small custom runner, not `drizzle-orm`'s `migrate()`, since the app was never using Drizzle as a runtime query layer). A handful of routes with MySQL-only SQL (`INSERT IGNORE`, `ON DUPLICATE KEY UPDATE`, `NOW()`, `GROUP_CONCAT(DISTINCT ... SEPARATOR ...)`) get an explicit dialect branch via shared helpers in `lib/sql-compat.ts`.

**Tech Stack:** Next.js 15 / TypeScript, `mysql2` (existing), Node's built-in `node:sqlite` (new — requires Node ≥ 22.5), `drizzle-orm`/`drizzle-kit` (existing, `sqlite-core` already present in the installed version), Jest 29 (existing test patterns).

## Global Constraints

- Trial-only scope: no requirement for SQLite production concurrency, backups, or permanent schema-parity guarantees — see design doc `docs/superpowers/specs/2026-07-07-sqlite-trial-mode-design.md`.
- No new native npm dependency — SQLite support must run on Node's built-in `node:sqlite`, not `better-sqlite3`.
- All ~50 route files with plain parameterized SQL (no MySQL-only syntax) must require **zero code changes** — the dialect swap happens entirely inside `lib/db.ts` and its dependencies.
- `Dockerfile` must be bumped to at least `node:22-alpine` (node:sqlite's minimum version) as part of this work.
- Follow existing patterns: routes call `getDb()`/`setupDatabase()`/`withTransaction()` from `@/lib/db`; unit tests mock `@/lib/db` per `__tests__/unit/api/settings/route.test.ts`; new Jest tests go under `__tests__/unit/**` (mocked) or `__tests__/integration/**` (real DB), matching `jest.config.ts`'s three-project setup.

---

### Task 1: Dialect-aware config types (`lib/setup.ts`)

**Files:**
- Modify: `lib/setup.ts`
- Test: `__tests__/unit/lib/setup.test.ts` (new)

**Interfaces:**
- Produces: `DbDialect = "mysql" | "sqlite"`, `MysqlDbConfig`, `SqliteDbConfig`, `DbConfig = MysqlDbConfig | SqliteDbConfig`, updated `SiteConfig.db: DbConfig`. `getSiteConfig()` normalizes any pre-existing `site.config.json` (written before this change, with a flat `{host,port,user,password,name}` `db` shape and no `dialect` key) to `{ dialect: "mysql", ...fields }` so old installs keep working.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/lib/setup.test.ts
import fs from 'fs'
import path from 'path'

jest.mock('fs')

import { getSiteConfig, writeSiteConfig, type SiteConfig } from '@/lib/setup'

const CONFIG_PATH = path.join(process.cwd(), 'site.config.json')

describe('lib/setup dialect handling', () => {
  beforeEach(() => jest.clearAllMocks())

  it('normalizes a pre-dialect site.config.json to mysql', () => {
    const legacy = {
      setupComplete: true,
      appName: 'Pixxel',
      orgName: 'Acme',
      db: { host: 'localhost', port: 3306, user: 'root', password: '', name: 'saas_app' },
    }
    ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(legacy))

    const config = getSiteConfig()

    expect(config?.db).toEqual({
      dialect: 'mysql',
      host: 'localhost', port: 3306, user: 'root', password: '', name: 'saas_app',
    })
  })

  it('round-trips a sqlite config unchanged', () => {
    const config: SiteConfig = {
      setupComplete: true,
      appName: 'Pixxel',
      orgName: 'Acme',
      db: { dialect: 'sqlite', file: 'data/pixxel.db' },
    }
    writeSiteConfig(config)
    const written = (fs.writeFileSync as jest.Mock).mock.calls[0]
    expect(written[0]).toBe(CONFIG_PATH)
    ;(fs.readFileSync as jest.Mock).mockReturnValue(written[1] as string)

    expect(getSiteConfig()).toEqual(config)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/lib/setup.test.ts`
Expected: FAIL — `getSiteConfig` doesn't normalize legacy shape yet (`config.db` won't have a `dialect` key), and `SiteConfig`/`DbConfig` types don't exist yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/setup.ts
/**
 * lib/setup.ts  —  SERVER ONLY
 *
 * Utilities for reading and writing site.config.json.
 * This file is the source of truth for whether the application
 * has been configured. It must never be imported by client components.
 */
import fs from "fs";
import path from "path";

export type DbDialect = "mysql" | "sqlite";

export interface MysqlDbConfig {
  dialect: "mysql";
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export interface SqliteDbConfig {
  dialect: "sqlite";
  file: string;
}

export type DbConfig = MysqlDbConfig | SqliteDbConfig;

// Shape written by setup wizards before this change — no `dialect` key.
interface LegacyDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export interface SiteConfig {
  setupComplete: boolean;
  appName: string;
  orgName: string;
  db: DbConfig;
}

const CONFIG_PATH = path.join(process.cwd(), "site.config.json");

function normalizeDbConfig(db: DbConfig | LegacyDbConfig): DbConfig {
  if ("dialect" in db) return db;
  return { dialect: "mysql", ...db };
}

export function isSetupComplete(): boolean {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw) as SiteConfig;
    return config.setupComplete === true;
  } catch {
    return false;
  }
}

export function getSiteConfig(): SiteConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as SiteConfig;
    return { ...parsed, db: normalizeDbConfig(parsed.db) };
  } catch {
    return null;
  }
}

export function writeSiteConfig(config: SiteConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/lib/setup.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/setup.ts __tests__/unit/lib/setup.test.ts
git commit -m "feat: add dialect-aware db config types to site.config.json"
```

---

### Task 2: Expose `getDbDialect()` / `getSqliteFilePath()` from `lib/db.ts`

**Files:**
- Modify: `lib/db.ts`
- Test: `__tests__/unit/lib/db-dialect.test.ts` (new)

**Interfaces:**
- Consumes: `getSiteConfig()` from Task 1.
- Produces: `getDbDialect(): DbDialect`, `getSqliteFilePath(): string`. Both are pure reads of config/env — no behavior change to `getDb()`/`setupDatabase()` yet (that's Task 10).

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/lib/db-dialect.test.ts
jest.mock('@/lib/setup', () => ({
  getSiteConfig: jest.fn(),
}))

import { getSiteConfig } from '@/lib/setup'
import { getDbDialect, getSqliteFilePath } from '@/lib/db'

describe('getDbDialect', () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...OLD_ENV }
    delete process.env.DB_TYPE
  })
  afterAll(() => { process.env = OLD_ENV })

  it('defaults to mysql when no config or env is set', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue(null)
    expect(getDbDialect()).toBe('mysql')
  })

  it('reads dialect from site.config.json when present', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue({
      db: { dialect: 'sqlite', file: 'data/pixxel.db' },
    })
    expect(getDbDialect()).toBe('sqlite')
  })

  it('falls back to DB_TYPE env var when no site.config.json', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue(null)
    process.env.DB_TYPE = 'sqlite'
    expect(getDbDialect()).toBe('sqlite')
  })
})

describe('getSqliteFilePath', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reads the file path from site.config.json', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue({
      db: { dialect: 'sqlite', file: 'data/custom.db' },
    })
    expect(getSqliteFilePath()).toBe('data/custom.db')
  })

  it('falls back to DB_FILE env var, then a default path', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue(null)
    process.env.DB_FILE = 'data/from-env.db'
    expect(getSqliteFilePath()).toBe('data/from-env.db')
    delete process.env.DB_FILE
    expect(getSqliteFilePath()).toContain('pixxel.db')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/lib/db-dialect.test.ts`
Expected: FAIL — `getDbDialect`/`getSqliteFilePath` are not exported yet.

- [ ] **Step 3: Write minimal implementation**

Add to `lib/db.ts` (near the top, after the existing imports and before `getDbCredentials`):

```typescript
import { getSiteConfig, type DbDialect } from "@/lib/setup";

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/lib/db-dialect.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts __tests__/unit/lib/db-dialect.test.ts
git commit -m "feat: expose getDbDialect()/getSqliteFilePath() from lib/db"
```

---

### Task 3: SQL dialect-compatibility helpers (`lib/sql-compat.ts`)

**Files:**
- Create: `lib/sql-compat.ts`
- Test: `__tests__/unit/lib/sql-compat.test.ts`

**Interfaces:**
- Consumes: `DbDialect` type from `lib/setup.ts`.
- Produces: `insertIgnoreSql(table: string, columns: string[], dialect: DbDialect): string`, `upsertSql(table: string, columns: string[], updateColumn: string, dialect: DbDialect): string`, `nowSql(dialect: DbDialect): string`. Pure string functions — no DB access — so later tasks (4, 5, 6) can call them directly with `getDbDialect()`'s result.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/lib/sql-compat.test.ts
import { insertIgnoreSql, upsertSql, nowSql } from '@/lib/sql-compat'

describe('insertIgnoreSql', () => {
  it('produces MySQL INSERT IGNORE syntax', () => {
    expect(insertIgnoreSql('asset_departments', ['asset_id', 'department_id'], 'mysql'))
      .toBe('INSERT IGNORE INTO asset_departments (asset_id, department_id) VALUES (?, ?)')
  })

  it('produces SQLite INSERT OR IGNORE syntax', () => {
    expect(insertIgnoreSql('asset_departments', ['asset_id', 'department_id'], 'sqlite'))
      .toBe('INSERT OR IGNORE INTO asset_departments (asset_id, department_id) VALUES (?, ?)')
  })
})

describe('upsertSql', () => {
  it('produces MySQL ON DUPLICATE KEY UPDATE syntax', () => {
    expect(upsertSql('app_settings', ['key', 'value'], 'value', 'mysql'))
      .toBe('INSERT INTO app_settings (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)')
  })

  it('produces SQLite ON CONFLICT DO UPDATE syntax, conflicting on the first column', () => {
    expect(upsertSql('app_settings', ['key', 'value'], 'value', 'sqlite'))
      .toBe('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  })

  it('supports a composite conflict target (all columns before the update column)', () => {
    expect(upsertSql('plantuml_diagram_assets', ['diagram_id', 'asset_id', 'matched_on'], 'matched_on', 'sqlite'))
      .toBe('INSERT INTO plantuml_diagram_assets (diagram_id, asset_id, matched_on) VALUES (?, ?, ?) ON CONFLICT(diagram_id, asset_id) DO UPDATE SET matched_on = excluded.matched_on')
  })
})

describe('nowSql', () => {
  it('returns NOW() for mysql', () => {
    expect(nowSql('mysql')).toBe('NOW()')
  })
  it('returns CURRENT_TIMESTAMP for sqlite', () => {
    expect(nowSql('sqlite')).toBe('CURRENT_TIMESTAMP')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/lib/sql-compat.test.ts`
Expected: FAIL — module `@/lib/sql-compat` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/sql-compat.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/lib/sql-compat.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/sql-compat.ts __tests__/unit/lib/sql-compat.test.ts
git commit -m "feat: add lib/sql-compat dialect helpers for INSERT IGNORE/upsert/NOW()"
```

---

### Task 4: Apply `insertIgnoreSql`/`nowSql` to assets + diagram-versions routes

**Files:**
- Modify: `app/api/assets/route.ts:180-204`
- Modify: `app/api/assets/[id]/route.ts:190-217`
- Modify: `app/api/diagrams/[id]/versions/route.ts:65-81`
- Test: `__tests__/unit/api/assets/route.test.ts` (extend if it exists, else create), `__tests__/unit/api/diagrams/versions.test.ts` (extend if it exists, else create)

**Interfaces:**
- Consumes: `insertIgnoreSql`, `nowSql` from Task 3; `getDbDialect` from Task 2.

Note: this task changes the literal SQL string passed to `db.execute`/`tx.execute` from a hardcoded `"INSERT IGNORE INTO ..."` to a call to `insertIgnoreSql(...)`. Since the generated MySQL string is byte-for-byte identical to the current hardcoded string, existing tests that assert on exact SQL text keep passing; new assertions below cover the dialect branch.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/api/assets/route.test.ts (add to existing file, or create with
// the same jest.mock setup as __tests__/unit/api/settings/route.test.ts, mocking
// @/lib/db's getDb, setupDatabase, withTransaction, getDbDialect, and
// @/lib/require-user, @/lib/audit)

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  withTransaction: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
}))

// ... existing mocks for require-user, audit, logger ...

it('uses INSERT OR IGNORE for junction rows when dialect is sqlite', async () => {
  ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
  const txExecute = jest.fn().mockResolvedValue([[]])
  ;(withTransaction as jest.Mock).mockImplementation(async (cb) => cb({ execute: txExecute }))

  const res = await POST(makeCreateRequest({ name: 'Test Asset', type: 'SaaS', lifecycleStatus: 'Proposed', departmentIds: ['dept-1'] }))

  expect(res.status).toBe(201)
  const junctionCall = txExecute.mock.calls.find(([sql]) => sql.includes('asset_departments'))
  expect(junctionCall[0]).toBe('INSERT OR IGNORE INTO asset_departments (asset_id, department_id) VALUES (?, ?)')
})
```

(Adapt `makeCreateRequest` to whatever request-building helper the existing `assets/route.ts` test file already uses — follow its established pattern rather than introducing a new one.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/api/assets`
Expected: FAIL — route still hardcodes `INSERT IGNORE`, ignoring dialect.

- [ ] **Step 3: Write minimal implementation**

In `app/api/assets/route.ts`, add the import and swap all three `INSERT IGNORE` call sites:

```typescript
import { getDb, setupDatabase, withTransaction, getDbDialect } from "@/lib/db";
import { insertIgnoreSql } from "@/lib/sql-compat";
```

```typescript
    await withTransaction(async (tx) => {
      const dialect = getDbDialect();
      await tx.execute(
        `INSERT INTO assets
           (id, name, short_code, description, type, category, icon, hero_diagram_id, tier_id, strategy_id, complexity_id, domain_id, vendor_id, lifecycle_status,
            business_owner, technical_owner, sla_availability, sla_rto, sla_rpo,
            go_live_date, retirement_date, app_url, doc_url, contract_end_date, contract_amount, notes, created_by_id, created_by_name)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, values.name, values.shortCode, values.description, values.type, values.category,
         values.icon, values.heroDiagramId, values.tierId, values.strategyId, values.complexityId, values.domainId, values.vendorId, values.lifecycleStatus, values.businessOwner,
         values.technicalOwner, values.slaAvailability, values.slaRto, values.slaRpo,
         values.goLiveDate, values.retirementDate, values.appUrl, values.docUrl, values.contractEndDate, values.contractAmount,
         values.notes, user.id, user.name]
      );

      // Insert junction rows
      for (const deptId of values.departmentIds) {
        await tx.execute(
          insertIgnoreSql("asset_departments", ["asset_id", "department_id"], dialect),
          [id, deptId]
        );
      }
      // Insert architect junction rows (fetch user names from users table)
      for (const uid of values.architectIds) {
        const [uRows] = await tx.execute<mysql.RowDataPacket[]>(
          "SELECT name FROM users WHERE id = ? LIMIT 1", [uid]
        );
        if (uRows[0]) {
          await tx.execute(
            insertIgnoreSql("asset_architects", ["asset_id", "user_id", "user_name"], dialect),
            [id, uid, uRows[0].name]
          );
        }
      }
      // Insert capability junction rows
      for (const capId of values.capabilityIds) {
        await tx.execute(
          insertIgnoreSql("asset_capabilities", ["asset_id", "business_capability_id"], dialect),
          [id, capId]
        );
      }
    });
```

Apply the same three-call-site swap to `app/api/assets/[id]/route.ts` (`PUT` handler, lines 190-217): add the same imports, capture `const dialect = getDbDialect();` at the top of the `withTransaction` callback, and replace each `"INSERT IGNORE INTO ..."` literal with the matching `insertIgnoreSql(...)` call (same table/column arguments as above).

In `app/api/diagrams/[id]/versions/route.ts`:

```typescript
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { insertIgnoreSql, nowSql } from "@/lib/sql-compat";
```

```typescript
    const versionId = randomUUID();
    await db.execute(
      "INSERT INTO diagram_versions (id, diagram_id, version_number, content, created_by_id, created_by_name) VALUES (?,?,?,?,?,?)",
      [versionId, params.id, nextVersion, content, user.id, user.name]
    );

    const dialect = getDbDialect();

    // Update diagram.updated_at
    await db.execute(`UPDATE diagrams SET updated_at = ${nowSql(dialect)} WHERE id = ?`, [params.id]);

    // Replace diagram_assets junction
    await db.execute("DELETE FROM diagram_assets WHERE diagram_id = ?", [params.id]);
    const ids = Array.isArray(assetIds) ? assetIds as string[] : [];
    for (const assetId of ids) {
      await db.execute(
        insertIgnoreSql("diagram_assets", ["diagram_id", "asset_id"], dialect),
        [params.id, assetId]
      );
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/api/assets __tests__/unit/api/diagrams`
Expected: PASS (all existing + new tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/assets/route.ts app/api/assets/[id]/route.ts app/api/diagrams/[id]/versions/route.ts __tests__/unit/api/assets/route.test.ts __tests__/unit/api/diagrams/versions.test.ts
git commit -m "feat: dialect-aware INSERT IGNORE/NOW() in assets and diagram-version routes"
```

---

### Task 5: Apply `upsertSql` to settings + plantuml auto-tag routes

**Files:**
- Modify: `app/api/settings/route.ts:32-35`
- Modify: `app/api/plantuml/[id]/assets/auto-tag/route.ts:42-47`
- Test: `__tests__/unit/api/settings/route.test.ts` (extend), `__tests__/unit/api/plantuml/auto-tag.test.ts` (extend if exists, else create)

**Interfaces:**
- Consumes: `upsertSql` from Task 3, `getDbDialect` from Task 2.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/api/settings/route.test.ts` (update the `@/lib/db` mock at the top of the file to include `getDbDialect: jest.fn().mockReturnValue('mysql')`):

```typescript
it('uses ON CONFLICT DO UPDATE for sqlite dialect', async () => {
  ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
  const res = await PUT(makeReq({ 'confluence.base_url': 'https://x.example' }))
  expect(res.status).toBe(200)
  expect(mockExecute).toHaveBeenCalledWith(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ['confluence.base_url', 'https://x.example']
  )
})
```

(Add `import { getDbDialect } from '@/lib/db'` alongside the existing `getDb` import in that test file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/api/settings`
Expected: FAIL — route still hardcodes the MySQL upsert string with backtick-quoted `` `key` ``/`` `value` `` identifiers.

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/settings/route.ts
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { upsertSql } from "@/lib/sql-compat";
```

```typescript
    await db.execute(
      upsertSql("app_settings", ["key", "value"], "value", getDbDialect()),
      [key, value]
    );
```

(Note: the original used backtick-quoted `` `key` ``/`` `value` `` because `key` is a reserved word in some SQL contexts; both MySQL and SQLite accept unquoted `key`/`value` as ordinary identifiers here since they aren't used as reserved keywords in this position — verified by the passing test in the next step. `upsertSql` does not add quoting.)

For `app/api/plantuml/[id]/assets/auto-tag/route.ts`:

```typescript
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { upsertSql } from "@/lib/sql-compat";
```

```typescript
    await db.execute(
      upsertSql("plantuml_diagram_assets", ["diagram_id", "asset_id", "matched_on"], "matched_on", getDbDialect()),
      [params.id, asset.id, matchedOn]
    );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/api/settings __tests__/unit/api/plantuml`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/settings/route.ts app/api/plantuml/[id]/assets/auto-tag/route.ts __tests__/unit/api/settings/route.test.ts
git commit -m "feat: dialect-aware upsert in settings and plantuml auto-tag routes"
```

---

### Task 6: Apply `nowSql` to users + projects create routes

**Files:**
- Modify: `app/api/users/route.ts:63-66`
- Modify: `app/api/projects/route.ts:69-74`
- Test: `__tests__/unit/api/users/route.test.ts` (extend if exists, else create), `__tests__/unit/api/projects/route.test.ts` (extend if exists, else create)

**Interfaces:**
- Consumes: `nowSql` from Task 3, `getDbDialect` from Task 2.

- [ ] **Step 1: Write the failing test**

```typescript
// add to __tests__/unit/api/users/route.test.ts (mock @/lib/db with
// getDbDialect: jest.fn().mockReturnValue('mysql') alongside existing mocks)

it('uses CURRENT_TIMESTAMP instead of NOW() for sqlite dialect', async () => {
  ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
  const res = await POST(makeCreateUserRequest({ name: 'Jane', email: 'jane@example.com', password: 'password123', role: 'Member' }))
  expect(res.status).toBe(201)
  const insertCall = mockExecute.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'))
  expect(insertCall[0]).toContain('CURRENT_TIMESTAMP, CURRENT_TIMESTAMP')
  expect(insertCall[0]).not.toContain('NOW()')
})
```

(Follow the existing request-building helper already present in that test file. Add the equivalent test to `projects/route.test.ts` asserting the `INSERT INTO projects` call's SQL string.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/api/users __tests__/unit/api/projects`
Expected: FAIL — both routes hardcode `NOW()`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/users/route.ts
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { nowSql } from "@/lib/sql-compat";
```

```typescript
    const now = nowSql(getDbDialect());
    await db.execute(
      `INSERT INTO users (id, name, email, password, role, created_at, updated_at) VALUES (?,?,?,?,?, ${now}, ${now})`,
      [id, name, email, hashed, role]
    );
```

```typescript
// app/api/projects/route.ts
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { nowSql } from "@/lib/sql-compat";
```

```typescript
    const now = nowSql(getDbDialect());
    const db = getDb();
    await db.execute(
      `INSERT INTO projects (id, name, description, status, start_date, end_date, created_by_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${now}, ${now})`,
      [id, trimmedName, description?.trim() || null, resolvedStatus, startDate || null, endDate || null, user.id, user.name]
    );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/api/users __tests__/unit/api/projects`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/users/route.ts app/api/projects/route.ts __tests__/unit/api/users/route.test.ts __tests__/unit/api/projects/route.test.ts
git commit -m "feat: dialect-aware NOW() in users and projects create routes"
```

---

### Task 7: SQLite-compatible `GROUP_CONCAT` rewrite for asset list/detail queries

**Files:**
- Modify: `app/api/assets/route.ts:73-102` (GET handler)
- Modify: `app/api/assets/[id]/route.ts:20-51` (GET handler)
- Modify: `app/api/assets/my-assets/route.ts:18-43` (GET handler)
- Test: `__tests__/unit/api/assets/route.test.ts`, `__tests__/unit/api/assets/[id]/route.test.ts`, `__tests__/unit/api/assets/my-assets/route.test.ts` (extend each if exists, else create)

**Interfaces:**
- Consumes: `getDbDialect` from Task 2.

MySQL's `GROUP_CONCAT(DISTINCT col ORDER BY x SEPARATOR sep)` has no direct SQLite equivalent (SQLite's `GROUP_CONCAT` takes no `DISTINCT`/`ORDER BY`). Since the aggregated junction tables (`asset_departments`, `asset_architects`, `asset_capabilities`) have composite primary keys, duplicate rows can't occur, so `DISTINCT` is dropped for the SQLite branch; order is preserved by moving each aggregate into a correlated subquery with its own `ORDER BY`.

- [ ] **Step 1: Write the failing test**

```typescript
// add to __tests__/unit/api/assets/route.test.ts
it('uses correlated-subquery GROUP_CONCAT (no DISTINCT/SEPARATOR) for sqlite dialect', async () => {
  ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
  mockExecute.mockResolvedValueOnce([[]])
  const res = await GET(new NextRequest('http://localhost/api/assets'))
  expect(res.status).toBe(200)
  const sql = mockExecute.mock.calls[0][0] as string
  expect(sql).not.toMatch(/SEPARATOR/)
  expect(sql).not.toMatch(/DISTINCT/)
  expect(sql).toMatch(/GROUP_CONCAT\(department_id, ','\)/)
})
```

Add the equivalent test (same assertions, adjusted for the single-asset query shape) to `__tests__/unit/api/assets/[id]/route.test.ts`, and one for `my-assets/route.test.ts` (which only aggregates departments and architects, not capabilities).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/api/assets`
Expected: FAIL — all three routes always emit the MySQL `GROUP_CONCAT(... SEPARATOR ...)` form regardless of dialect.

- [ ] **Step 3: Write minimal implementation**

In `app/api/assets/route.ts`, add the import and branch the GET query:

```typescript
import { getDb, setupDatabase, withTransaction, getDbDialect } from "@/lib/db";
```

```typescript
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const dialect = getDbDialect();
    const query = dialect === "sqlite" ? `
      SELECT
        a.*,
        (SELECT GROUP_CONCAT(department_id, ',') FROM (SELECT ad.department_id AS department_id FROM asset_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.asset_id = a.id ORDER BY d.name)) AS department_ids,
        (SELECT GROUP_CONCAT(name, '|') FROM (SELECT d.name AS name FROM asset_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.asset_id = a.id ORDER BY d.name)) AS department_names,
        (SELECT GROUP_CONCAT(user_id, ',') FROM (SELECT aa.user_id AS user_id FROM asset_architects aa WHERE aa.asset_id = a.id ORDER BY aa.user_name)) AS architect_ids,
        (SELECT GROUP_CONCAT(user_name, '|') FROM (SELECT aa.user_name AS user_name FROM asset_architects aa WHERE aa.asset_id = a.id ORDER BY aa.user_name)) AS architect_names,
        (SELECT GROUP_CONCAT(business_capability_id, ',') FROM (SELECT ac.business_capability_id AS business_capability_id FROM asset_capabilities ac JOIN business_capabilities bc ON bc.id = ac.business_capability_id WHERE ac.asset_id = a.id ORDER BY bc.name)) AS capability_ids,
        (SELECT GROUP_CONCAT(name, '|') FROM (SELECT bc.name AS name FROM asset_capabilities ac JOIN business_capabilities bc ON bc.id = ac.business_capability_id WHERE ac.asset_id = a.id ORDER BY bc.name)) AS capability_names,
        v.name AS vendor_name,
        dom.name AS domain_name,
        s.name AS strategy_name,
        c.name AS complexity_name,
        t.name AS tier_name,
        hd.name AS hero_diagram_name
      FROM assets a
      LEFT JOIN vendors v             ON v.id = a.vendor_id
      LEFT JOIN domains dom           ON dom.id = a.domain_id
      LEFT JOIN asset_strategies s    ON s.id = a.strategy_id
      LEFT JOIN asset_complexities c  ON c.id = a.complexity_id
      LEFT JOIN tiers t               ON t.id = a.tier_id
      LEFT JOIN diagrams hd           ON hd.id = a.hero_diagram_id
      ORDER BY a.name ASC
    ` : `
      SELECT
        a.*,
        GROUP_CONCAT(DISTINCT ad.department_id ORDER BY d.name SEPARATOR ',')  AS department_ids,
        GROUP_CONCAT(DISTINCT d.name           ORDER BY d.name SEPARATOR '|')  AS department_names,
        GROUP_CONCAT(DISTINCT aa.user_id       ORDER BY aa.user_name SEPARATOR ',') AS architect_ids,
        GROUP_CONCAT(DISTINCT aa.user_name     ORDER BY aa.user_name SEPARATOR '|') AS architect_names,
        GROUP_CONCAT(DISTINCT ac.business_capability_id ORDER BY bc.name SEPARATOR ',') AS capability_ids,
        GROUP_CONCAT(DISTINCT bc.name                   ORDER BY bc.name SEPARATOR '|') AS capability_names,
        v.name AS vendor_name,
        dom.name AS domain_name,
        s.name AS strategy_name,
        c.name AS complexity_name,
        t.name AS tier_name,
        hd.name AS hero_diagram_name
      FROM assets a
      LEFT JOIN asset_departments ad  ON ad.asset_id = a.id
      LEFT JOIN departments d         ON d.id = ad.department_id
      LEFT JOIN asset_architects aa   ON aa.asset_id = a.id
      LEFT JOIN asset_capabilities ac    ON ac.asset_id = a.id
      LEFT JOIN business_capabilities bc ON bc.id = ac.business_capability_id
      LEFT JOIN vendors v             ON v.id = a.vendor_id
      LEFT JOIN domains dom           ON dom.id = a.domain_id
      LEFT JOIN asset_strategies s    ON s.id = a.strategy_id
      LEFT JOIN asset_complexities c  ON c.id = a.complexity_id
      LEFT JOIN tiers t               ON t.id = a.tier_id
      LEFT JOIN diagrams hd           ON hd.id = a.hero_diagram_id
      GROUP BY a.id
      ORDER BY a.name ASC
    `;
    const [rows] = await db.execute<mysql.RowDataPacket[]>(query);
    return NextResponse.json({ assets: rows.map(rowToAsset) });
  } catch (err) {
    logger.error({ err, route: "GET /api/assets" }, "request failed");
    return NextResponse.json({ error: "Failed to load assets." }, { status: 500 });
  }
}
```

Apply the same pattern to `app/api/assets/[id]/route.ts`'s `GET` handler: same two query strings, with `WHERE a.id = ?` / correlated subqueries filtered by `a.id` unchanged, plus ` LIMIT 1` appended to both branches, and the existing `[params.id]` parameter array passed to `db.execute` either way.

Apply the same pattern to `app/api/assets/my-assets/route.ts`'s `GET` handler, keeping its `INNER JOIN asset_architects my_aa ON my_aa.asset_id = a.id AND my_aa.user_id = ?` in both branches' `FROM` clause (it's a row filter, not an aggregate, so it doesn't move into a subquery), and omitting the capability aggregates (this route never selected them):

```typescript
    const dialect = getDbDialect();
    const query = dialect === "sqlite" ? `
      SELECT
        a.*,
        (SELECT GROUP_CONCAT(department_id, ',') FROM (SELECT ad.department_id AS department_id FROM asset_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.asset_id = a.id ORDER BY d.name)) AS department_ids,
        (SELECT GROUP_CONCAT(name, '|') FROM (SELECT d.name AS name FROM asset_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.asset_id = a.id ORDER BY d.name)) AS department_names,
        (SELECT GROUP_CONCAT(user_id, ',') FROM (SELECT aa.user_id AS user_id FROM asset_architects aa WHERE aa.asset_id = a.id ORDER BY aa.user_name)) AS architect_ids,
        (SELECT GROUP_CONCAT(user_name, '|') FROM (SELECT aa.user_name AS user_name FROM asset_architects aa WHERE aa.asset_id = a.id ORDER BY aa.user_name)) AS architect_names,
        v.name AS vendor_name,
        dom.name AS domain_name,
        s.name AS strategy_name,
        c.name AS complexity_name,
        t.name AS tier_name
      FROM assets a
      INNER JOIN asset_architects my_aa ON my_aa.asset_id = a.id AND my_aa.user_id = ?
      LEFT JOIN vendors v               ON v.id = a.vendor_id
      LEFT JOIN domains dom             ON dom.id = a.domain_id
      LEFT JOIN asset_strategies s      ON s.id = a.strategy_id
      LEFT JOIN asset_complexities c    ON c.id = a.complexity_id
      LEFT JOIN tiers t                 ON t.id = a.tier_id
      ORDER BY a.name ASC
    ` : `
      SELECT
        a.*,
        GROUP_CONCAT(DISTINCT ad.department_id ORDER BY d.name SEPARATOR ',')  AS department_ids,
        GROUP_CONCAT(DISTINCT d.name           ORDER BY d.name SEPARATOR '|')  AS department_names,
        GROUP_CONCAT(DISTINCT aa.user_id       ORDER BY aa.user_name SEPARATOR ',') AS architect_ids,
        GROUP_CONCAT(DISTINCT aa.user_name     ORDER BY aa.user_name SEPARATOR '|') AS architect_names,
        v.name AS vendor_name,
        dom.name AS domain_name,
        s.name AS strategy_name,
        c.name AS complexity_name,
        t.name AS tier_name
      FROM assets a
      INNER JOIN asset_architects my_aa ON my_aa.asset_id = a.id AND my_aa.user_id = ?
      LEFT JOIN asset_departments ad    ON ad.asset_id = a.id
      LEFT JOIN departments d           ON d.id = ad.department_id
      LEFT JOIN asset_architects aa     ON aa.asset_id = a.id
      LEFT JOIN vendors v               ON v.id = a.vendor_id
      LEFT JOIN domains dom             ON dom.id = a.domain_id
      LEFT JOIN asset_strategies s      ON s.id = a.strategy_id
      LEFT JOIN asset_complexities c    ON c.id = a.complexity_id
      LEFT JOIN tiers t                 ON t.id = a.tier_id
      GROUP BY a.id
      ORDER BY a.name ASC
    `;
    const [rows] = await db.execute<mysql.RowDataPacket[]>(query, [userId]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/api/assets`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/assets/route.ts "app/api/assets/[id]/route.ts" app/api/assets/my-assets/route.ts __tests__/unit/api/assets
git commit -m "feat: SQLite-compatible GROUP_CONCAT rewrite for asset list/detail/my-assets"
```

---

### Task 8: SQLite schema, migration generation, and shared seed data

**Files:**
- Create: `drizzle/schema.sqlite.ts`
- Create: `drizzle.config.sqlite.ts`
- Create: `lib/db-seed-data.ts`
- Modify: `lib/db.ts:151-232` (seed block — switch to shared arrays, no behavior change)
- Modify: `package.json` (add `db:generate:sqlite` script)
- Generated: `drizzle/migrations-sqlite/0000_*.sql` (via drizzle-kit, not hand-written)
- Create: `drizzle/migrations-sqlite/0001_updated_at_triggers.sql` (hand-written)

**Interfaces:**
- Produces: `SEED_DIAGRAM_TYPES`, `SEED_INDUSTRY_SECTORS`, `SEED_TELECOM_CAPABILITIES`, `SEED_UTILITY_CAPABILITIES`, `SEED_INVESTMENT_CLASSIFICATIONS` (all plain data arrays) from `lib/db-seed-data.ts`, consumed by both `lib/db.ts` (Task 8, this task) and `lib/db-sqlite.ts` (Task 9).

This task has no "failing test first" step in the usual sense — it's schema/DDL work verified by inspecting generated SQL and by the migration-application test in Task 9. Steps below are ordered so each is independently checkable.

- [ ] **Step 1: Extract seed data into `lib/db-seed-data.ts`**

```typescript
// lib/db-seed-data.ts
/**
 * Reference/lookup seed data shared by both the MySQL (lib/db.ts) and
 * SQLite (lib/db-sqlite.ts) setup paths, so the two don't drift.
 */
export const SEED_DIAGRAM_TYPES = [
  { id: "dtype000-0000-0000-0000-000000000001", name: "Domain",   description: "High-level domain architecture overview",        sortOrder: 1 },
  { id: "dtype000-0000-0000-0000-000000000002", name: "Program",  description: "Program-level architecture diagram",             sortOrder: 2 },
  { id: "dtype000-0000-0000-0000-000000000003", name: "Solution", description: "Solution architecture diagram",                  sortOrder: 3 },
  { id: "dtype000-0000-0000-0000-000000000004", name: "Detailed", description: "Detailed technical architecture diagram",        sortOrder: 4 },
];

export const SEED_INDUSTRY_SECTORS = [
  { id: "00000001-ind-0000-0000-000000000001", name: "Telecommunications", description: "Providers of voice, data, and broadband connectivity services." },
  { id: "00000001-ind-0000-0000-000000000002", name: "Utilities (Energy)", description: "Providers of electricity, gas, and water distribution services." },
];

export const SEED_TELECOM_CAPABILITIES: [string, string, string, number][] = [
  ["00000002-cap-0000-0000-000000000001", "Network Management",              "Planning, provisioning, and operating the core and access network.",          1],
  ["00000002-cap-0000-0000-000000000002", "Voice & Calling Services",         "Management of voice, conferencing, and unified communications products.",     2],
  ["00000002-cap-0000-0000-000000000003", "Data & Connectivity Services",     "Broadband, mobile data, and enterprise connectivity offerings.",              3],
  ["00000002-cap-0000-0000-000000000004", "Customer Management",              "Acquisition, onboarding, retention, and care of customers.",                  4],
  ["00000002-cap-0000-0000-000000000005", "Billing & Revenue Management",     "Rating, billing, collections, and revenue assurance.",                        5],
  ["00000002-cap-0000-0000-000000000006", "Product Management",               "Design, launch, and lifecycle management of products and services.",          6],
  ["00000002-cap-0000-0000-000000000007", "Service Assurance",                "Monitoring, fault management, and SLA performance management.",               7],
  ["00000002-cap-0000-0000-000000000008", "Network Planning & Engineering",   "Capacity planning, design, and technology evolution of the network.",         8],
  ["00000002-cap-0000-0000-000000000009", "Field Operations",                 "Installation, maintenance, and repair of physical infrastructure.",           9],
  ["00000002-cap-0000-0000-000000000010", "Digital Channels & Self-Service",  "Web, mobile, and API-driven customer interaction channels.",                 10],
  ["00000002-cap-0000-0000-000000000011", "Wholesale & Interconnect",         "Carrier relations, roaming, and inter-operator settlement.",                 11],
  ["00000002-cap-0000-0000-000000000012", "Regulatory & Compliance",          "Licence management, regulatory reporting, and legal compliance.",            12],
];

export const SEED_UTILITY_CAPABILITIES: [string, string, string, number][] = [
  ["00000003-cap-0000-0000-000000000001", "Energy Generation",                  "Operation of power plants and renewable energy assets.",                     1],
  ["00000003-cap-0000-0000-000000000002", "Energy Transmission",                "High-voltage bulk power transmission across the grid.",                      2],
  ["00000003-cap-0000-0000-000000000003", "Energy Distribution",                "Low-voltage distribution of electricity to end consumers.",                  3],
  ["00000003-cap-0000-0000-000000000004", "Metering & Smart Grid",              "Smart meter deployment, data collection, and grid intelligence.",            4],
  ["00000003-cap-0000-0000-000000000005", "Customer Operations",                "Customer acquisition, service requests, and complaint management.",          5],
  ["00000003-cap-0000-0000-000000000006", "Billing & Revenue Management",       "Energy usage billing, tariff management, and debt recovery.",                6],
  ["00000003-cap-0000-0000-000000000007", "Asset Management",                   "Lifecycle management of physical grid and generation assets.",               7],
  ["00000003-cap-0000-0000-000000000008", "Field Operations",                   "Inspection, maintenance, and emergency response for infrastructure.",        8],
  ["00000003-cap-0000-0000-000000000009", "Energy Trading & Risk Management",   "Wholesale energy procurement, trading, and market risk management.",         9],
  ["00000003-cap-0000-0000-000000000010", "Regulatory & Compliance",            "Licence obligations, safety reporting, and environmental compliance.",      10],
  ["00000003-cap-0000-0000-000000000011", "Environmental Management",           "Emissions tracking, sustainability reporting, and carbon management.",      11],
  ["00000003-cap-0000-0000-000000000012", "Network Planning & Investment",      "Grid investment planning, capacity modelling, and project delivery.",       12],
];

export const SEED_INVESTMENT_CLASSIFICATIONS = [
  { name: "Invest",       color: "#22c55e", sortOrder: 1 },
  { name: "Experiment",   color: "#3b82f6", sortOrder: 2 },
  { name: "Contain",      color: "#eab308", sortOrder: 3 },
  { name: "Decommission", color: "#ef4444", sortOrder: 4 },
];
```

- [ ] **Step 2: Update `lib/db.ts`'s MySQL seed block to consume the shared data**

Replace the body of `runSetup()` from the `INSERT IGNORE INTO diagram_types` line through the `investment_classifications` block (`lib/db.ts:151-232`) with:

```typescript
  import { randomUUID } from "crypto"; // add to top-of-file imports if not already present
  import {
    SEED_DIAGRAM_TYPES, SEED_INDUSTRY_SECTORS, SEED_TELECOM_CAPABILITIES,
    SEED_UTILITY_CAPABILITIES, SEED_INVESTMENT_CLASSIFICATIONS,
  } from "@/lib/db-seed-data";
```

```typescript
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
```

This drops the old `SELECT UUID()` SQL-side ID generation for `investment_classifications` in favor of app-level `randomUUID()`, matching every other insert in this codebase (and removing the last MySQL-only `UUID()` call site) — behaviorally identical (still one row per classification, inserted only if the table is empty).

- [ ] **Step 3: Verify the MySQL seed refactor**

Run: `npm run test:integration -- -t "setupDatabase"` (or, if no test targets `setupDatabase` by name, run the full integration suite: `npm run test:integration`)
Expected: PASS — existing integration tests that boot against a real MariaDB and assert seeded reference data (diagram types, industry sectors, business capabilities, investment classifications) still pass unchanged.

- [ ] **Step 4: Write `drizzle/schema.sqlite.ts`**

```typescript
// drizzle/schema.sqlite.ts
/**
 * SQLite mirror of drizzle/schema.ts, used only to generate migration SQL
 * for SQLite trial mode via `npm run db:generate:sqlite`. Applied by a
 * custom runner in lib/db-sqlite.ts (not drizzle-orm's migrate()), so this
 * file's only job is producing correct CREATE TABLE statements.
 *
 * Enum columns use sqlite-core's `text(col, { enum: [...] })` for
 * TypeScript-level literal typing; SQLite has no ENUM/CHECK constraint
 * generated for these (app-level validation, already present in every
 * route before a write, is the enforcement layer for this trial-only path).
 */
import {
  sqliteTable, text, integer, real, primaryKey, index, uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const createdAt = () => text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull();
const updatedAt = () => text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull();
const createdBy = () => ({
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique("uq_users_email"),
  password: text("password").notNull(),
  role: text("role").notNull().default("Member"),
  roleId: text("role_id"),
  tokenVersion: integer("token_version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_departments_name"),
  description: text("description"),
  status: text("status", { enum: ["Published", "Unpublished"] }).notNull().default("Unpublished"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortCode: text("short_code"),
  description: text("description"),
  type: text("type", { enum: ["SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other"] }).notNull().default("Other"),
  category: text("category").notNull().default("Application"),
  icon: text("icon").default("Server"),
  heroDiagramId: text("hero_diagram_id"),
  vendorId: text("vendor_id"),
  lifecycleStatus: text("lifecycle_status", { enum: ["Proposed", "Approved", "In Development", "Production", "Sunset", "Retired"] }).notNull().default("Proposed"),
  businessOwner: text("business_owner"),
  technicalOwner: text("technical_owner"),
  vendor: text("vendor"),
  slaAvailability: text("sla_availability"),
  slaRto: text("sla_rto"),
  slaRpo: text("sla_rpo"),
  goLiveDate: text("go_live_date"),
  retirementDate: text("retirement_date"),
  appUrl: text("app_url"),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  domainId: text("domain_id"),
  tierId: text("tier_id"),
  strategyId: text("strategy_id"),
  docUrl: text("doc_url"),
  contractEndDate: text("contract_end_date"),
  contractAmount: real("contract_amount"),
  complexityId: text("complexity_id"),
}, (t) => [
  index("idx_assets_lifecycle").on(t.lifecycleStatus),
]);

export const tiers = sqliteTable("tiers", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_tiers_name"),
  description: text("description"),
  slaAvailability: text("sla_availability"),
  supportHours: text("support_hours"),
  responseTime: text("response_time"),
  resolutionTime: text("resolution_time"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetStrategies = sqliteTable("asset_strategies", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_asset_strategies_name"),
  description: text("description"),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_domains_name"),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const vendors = sqliteTable("vendors", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_vendors_name"),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  stateProvince: text("state_province"),
  country: text("country"),
  postalCode: text("postal_code"),
  primaryContactName: text("primary_contact_name"),
  primaryContactRole: text("primary_contact_role"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetDepartments = sqliteTable("asset_departments", {
  assetId: text("asset_id").notNull(),
  departmentId: text("department_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.departmentId] }),
  index("idx_asset_departments_dept").on(t.departmentId),
]);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action", { enum: ["CREATE", "UPDATE", "DELETE"] }).notNull(),
  performedById: text("performed_by_id").notNull(),
  performedByName: text("performed_by_name").notNull(),
  performedAt: text("performed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  oldValues: text("old_values"),
  newValues: text("new_values"),
}, (t) => [
  index("idx_audit_table_record").on(t.tableName, t.recordId),
  index("idx_audit_performed_at").on(t.performedAt),
]);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_roles_name"),
  description: text("description"),
  permissionLevel: text("permission_level", { enum: ["read-only", "member", "admin"] }).notNull().default("member"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const supportRequests = sqliteTable("support_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  type: text("type", { enum: ["Feature Request", "Report Request", "Bug", "Other"] }).notNull().default("Feature Request"),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status", { enum: ["New", "Acknowledged", "Under Review", "Will Fix", "Will Not Implement", "Completed"] }).notNull().default("New"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  index("idx_support_user").on(t.userId),
]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["Active", "On Hold", "Completed", "Cancelled"] }).notNull().default("Active"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetArchitects = sqliteTable("asset_architects", {
  assetId: text("asset_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.userId] }),
  index("idx_asset_architects_user").on(t.userId),
]);

export const projectAssets = sqliteTable("project_assets", {
  projectId: text("project_id").notNull(),
  assetId: text("asset_id").notNull(),
  dependencyType: text("dependency_type", { enum: ["upstream", "downstream"] }).notNull().default("downstream"),
  notes: text("notes"),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.assetId] }),
  index("idx_project_assets_asset").on(t.assetId),
]);

export const diagrams = sqliteTable("diagrams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  projectId: text("project_id"),
  diagramTypeId: text("diagram_type_id"),
});

export const diagramVersions = sqliteTable("diagram_versions", {
  id: text("id").primaryKey(),
  diagramId: text("diagram_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull(),
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  uniqueIndex("uq_diagram_version").on(t.diagramId, t.versionNumber),
  index("idx_diagram_versions_diagram").on(t.diagramId),
]);

export const diagramAssets = sqliteTable("diagram_assets", {
  diagramId: text("diagram_id").notNull(),
  assetId: text("asset_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.diagramId, t.assetId] }),
  index("idx_diagram_assets_asset").on(t.assetId),
]);

export const diagramTypes = sqliteTable("diagram_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_diagram_type_name"),
  description: text("description"),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetComplexities = sqliteTable("asset_complexities", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_asset_complexities_name"),
  description: text("description"),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetCapabilities = sqliteTable("asset_capabilities", {
  assetId: text("asset_id").notNull(),
  businessCapabilityId: text("business_capability_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.businessCapabilityId] }),
  index("idx_asset_capabilities_cap").on(t.businessCapabilityId),
]);

export const industrySectors = sqliteTable("industry_sectors", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_industry_sectors_name"),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const businessCapabilities = sqliteTable("business_capabilities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  industrySectorId: text("industry_sector_id").notNull(),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_business_capabilities_industry").on(t.industrySectorId),
]);

export const changelog = sqliteTable("changelog", {
  id: text("id").primaryKey(),
  version: text("version").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["feature", "fix", "improvement", "breaking"] }).notNull().default("feature"),
  releasedAt: text("released_at").notNull(),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_changelog_released_at").on(t.releasedAt),
]);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: updatedAt(),
});

export const plantumlDiagrams = sqliteTable("plantuml_diagrams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  projectId: text("project_id"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const plantumlVersions = sqliteTable("plantuml_versions", {
  id: text("id").primaryKey(),
  diagramId: text("diagram_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  source: text("source").notNull(),
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  uniqueIndex("uq_plantuml_version").on(t.diagramId, t.versionNumber),
  index("idx_plantuml_versions_diagram").on(t.diagramId),
]);

export const plantumlDiagramAssets = sqliteTable("plantuml_diagram_assets", {
  diagramId: text("diagram_id").notNull(),
  assetId: text("asset_id").notNull(),
  matchedOn: text("matched_on"),
  taggedAt: text("tagged_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  primaryKey({ columns: [t.diagramId, t.assetId] }),
  index("idx_pda_asset").on(t.assetId),
]);

export const investmentClassifications = sqliteTable("investment_classifications", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetRoadmapPhases = sqliteTable("asset_roadmap_phases", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  classificationId: text("classification_id").notNull(),
  startQuarter: text("start_quarter").notNull(),
  endQuarter: text("end_quarter").notNull(),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_phases_asset_id").on(t.assetId),
  index("idx_phases_classification_id").on(t.classificationId),
]);

export const assetDependencies = sqliteTable("asset_dependencies", {
  id: text("id").primaryKey(),
  sourceAssetId: text("source_asset_id").notNull(),
  targetAssetId: text("target_asset_id").notNull(),
  type: text("type", { enum: ["API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other"] }).notNull().default("API"),
  direction: text("direction", { enum: ["outbound", "bidirectional"] }).notNull().default("outbound"),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("uq_dep_pair").on(t.sourceAssetId, t.targetAssetId),
  index("idx_dep_source").on(t.sourceAssetId),
  index("idx_dep_target").on(t.targetAssetId),
]);
```

- [ ] **Step 5: Write `drizzle.config.sqlite.ts`**

```typescript
// drizzle.config.sqlite.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./drizzle/schema.sqlite.ts",
  out: "./drizzle/migrations-sqlite",
  dialect: "sqlite",
} satisfies Config;
```

- [ ] **Step 6: Add the generate script and run it**

Add to `package.json`'s `"scripts"`:

```json
    "db:generate:sqlite": "drizzle-kit generate --config drizzle.config.sqlite.ts",
```

Run: `npm run db:generate:sqlite`
Expected: creates `drizzle/migrations-sqlite/0000_<generated-name>.sql` containing `CREATE TABLE` statements for all 30 tables above, plus a `drizzle/migrations-sqlite/meta/` snapshot directory (same pattern as the existing `drizzle/migrations/meta/`).

- [ ] **Step 7: Write the hand-authored `updated_at` trigger migration**

MySQL's `updated_at ... ON UPDATE CURRENT_TIMESTAMP` has no SQLite column-level equivalent — every table with an `updated_at` column (all except the version/junction/audit/support tables, which don't have one) gets an `AFTER UPDATE` trigger instead. Create `drizzle/migrations-sqlite/0001_updated_at_triggers.sql`:

```sql
CREATE TRIGGER trg_users_updated_at AFTER UPDATE ON users BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_departments_updated_at AFTER UPDATE ON departments BEGIN
  UPDATE departments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_assets_updated_at AFTER UPDATE ON assets BEGIN
  UPDATE assets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_tiers_updated_at AFTER UPDATE ON tiers BEGIN
  UPDATE tiers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_asset_strategies_updated_at AFTER UPDATE ON asset_strategies BEGIN
  UPDATE asset_strategies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_domains_updated_at AFTER UPDATE ON domains BEGIN
  UPDATE domains SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_vendors_updated_at AFTER UPDATE ON vendors BEGIN
  UPDATE vendors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_roles_updated_at AFTER UPDATE ON roles BEGIN
  UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_projects_updated_at AFTER UPDATE ON projects BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_diagrams_updated_at AFTER UPDATE ON diagrams BEGIN
  UPDATE diagrams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_diagram_types_updated_at AFTER UPDATE ON diagram_types BEGIN
  UPDATE diagram_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_asset_complexities_updated_at AFTER UPDATE ON asset_complexities BEGIN
  UPDATE asset_complexities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_industry_sectors_updated_at AFTER UPDATE ON industry_sectors BEGIN
  UPDATE industry_sectors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_business_capabilities_updated_at AFTER UPDATE ON business_capabilities BEGIN
  UPDATE business_capabilities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_changelog_updated_at AFTER UPDATE ON changelog BEGIN
  UPDATE changelog SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_plantuml_diagrams_updated_at AFTER UPDATE ON plantuml_diagrams BEGIN
  UPDATE plantuml_diagrams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_investment_classifications_updated_at AFTER UPDATE ON investment_classifications BEGIN
  UPDATE investment_classifications SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_asset_roadmap_phases_updated_at AFTER UPDATE ON asset_roadmap_phases BEGIN
  UPDATE asset_roadmap_phases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_asset_dependencies_updated_at AFTER UPDATE ON asset_dependencies BEGIN
  UPDATE asset_dependencies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_app_settings_updated_at AFTER UPDATE ON app_settings BEGIN
  UPDATE app_settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;
```

- [ ] **Step 8: Verify generated + hand-written SQL is syntactically valid**

Run:
```bash
node -e "
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const db = new DatabaseSync(':memory:');
for (const f of fs.readdirSync('drizzle/migrations-sqlite').filter(f => f.endsWith('.sql')).sort()) {
  db.exec(fs.readFileSync('drizzle/migrations-sqlite/' + f, 'utf-8'));
  console.log('applied', f);
}
console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().length, 'tables created');
"
```
Expected: prints `applied 0000_<name>.sql`, `applied 0001_updated_at_triggers.sql`, then `31 tables created` (30 schema tables — `sqlite_master` doesn't count triggers as tables, so this confirms all `CREATE TABLE`/`CREATE TRIGGER` statements parsed and ran without error).

- [ ] **Step 9: Commit**

```bash
git add drizzle/schema.sqlite.ts drizzle.config.sqlite.ts drizzle/migrations-sqlite lib/db-seed-data.ts lib/db.ts package.json
git commit -m "feat: add SQLite schema, migrations, and shared seed data"
```

---

### Task 9: SQLite runtime driver (`lib/db-sqlite.ts`)

**Files:**
- Create: `lib/db-sqlite.ts`
- Modify: `.gitignore` (add `data/`)
- Test: `__tests__/unit/lib/db-sqlite.test.ts`

**Interfaces:**
- Consumes: `DbClient` interface (defined in this task, re-exported from `lib/db.ts` in Task 10), seed arrays from `lib/db-seed-data.ts` (Task 8), migration files from `drizzle/migrations-sqlite/` (Task 8).
- Produces: `getSqliteDb(filePath: string): DbClient`, `setupSqliteDatabase(filePath: string): Promise<void>`, `withSqliteTransaction<T>(filePath: string, callback: (tx: DbClient) => Promise<T>): Promise<T>`, `resetSqlitePool(): void`.

This test uses a real `node:sqlite` `:memory:`-equivalent (a temp file, since `getSqliteDb`/`setupSqliteDatabase` take a path, not `:memory:` — using a temp file per test is fast and exercises the real code path end-to-end rather than mocking `node:sqlite`).

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/lib/db-sqlite.test.ts
import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import {
  getSqliteDb, setupSqliteDatabase, withSqliteTransaction, resetSqlitePool,
} from '@/lib/db-sqlite'

describe('lib/db-sqlite', () => {
  let dbFile: string

  beforeEach(() => {
    dbFile = path.join(os.tmpdir(), `pixxel-test-${randomUUID()}.db`)
  })

  afterEach(() => {
    resetSqlitePool()
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile)
  })

  it('applies migrations and seeds reference data on first setup', async () => {
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const [types] = await db.execute<{ name: string }[]>('SELECT name FROM diagram_types ORDER BY sort_order')
    expect(types.map((t) => t.name)).toEqual(['Domain', 'Program', 'Solution', 'Detailed'])

    const [classifications] = await db.execute<{ name: string }[]>('SELECT name FROM investment_classifications ORDER BY sort_order')
    expect(classifications.map((c) => c.name)).toEqual(['Invest', 'Experiment', 'Contain', 'Decommission'])
  })

  it('is idempotent — running setup twice does not duplicate seed rows or re-run migrations', async () => {
    await setupSqliteDatabase(dbFile)
    resetSqlitePool()
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const [rows] = await db.execute<{ n: number }[]>('SELECT COUNT(*) AS n FROM diagram_types')
    expect(rows[0].n).toBe(4)
  })

  it('inserts and reads rows via execute()', async () => {
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const id = randomUUID()
    await db.execute('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [id, 'Jane', 'jane@example.com', 'hashed'])
    const [rows] = await db.execute<{ name: string }[]>('SELECT name FROM users WHERE id = ?', [id])
    expect(rows[0].name).toBe('Jane')
  })

  it('fires the updated_at trigger on UPDATE', async () => {
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const id = randomUUID()
    await db.execute('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [id, 'Jane', 'jane@example.com', 'hashed'])
    const [[before]] = [(await db.execute<{ updated_at: string }[]>('SELECT updated_at FROM users WHERE id = ?', [id]))[0]]
    await new Promise((r) => setTimeout(r, 1100))
    await db.execute('UPDATE users SET name = ? WHERE id = ?', ['Jane Doe', id])
    const [[after]] = [(await db.execute<{ updated_at: string }[]>('SELECT updated_at FROM users WHERE id = ?', [id]))[0]]
    expect(after.updated_at).not.toBe(before.updated_at)
  })

  it('commits a successful transaction and rolls back a failed one', async () => {
    await setupSqliteDatabase(dbFile)
    const okId = randomUUID()
    await withSqliteTransaction(dbFile, async (tx) => {
      await tx.execute('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [okId, 'A', 'a@example.com', 'x'])
    })

    const failId = randomUUID()
    await expect(withSqliteTransaction(dbFile, async (tx) => {
      await tx.execute('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [failId, 'B', 'b@example.com', 'x'])
      throw new Error('boom')
    })).rejects.toThrow('boom')

    const db = getSqliteDb(dbFile)
    const [okRows] = await db.execute<unknown[]>('SELECT id FROM users WHERE id = ?', [okId])
    const [failRows] = await db.execute<unknown[]>('SELECT id FROM users WHERE id = ?', [failId])
    expect(okRows).toHaveLength(1)
    expect(failRows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/lib/db-sqlite.test.ts`
Expected: FAIL — `@/lib/db-sqlite` module does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/db-sqlite.ts
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
        return [stmt.all(...params) as T, undefined];
      }
      stmt.run(...params);
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
    conn.prepare(sqlText).run(...params);
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
```

Add `data/` to `.gitignore` (the default SQLite file location):

```
data/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/lib/db-sqlite.test.ts`
Expected: PASS (5 tests). Note: requires Node ≥ 22.5 locally to run (the project's dev environment is on Node v25.8.1 per `CLAUDE.md`, so this is already satisfied).

- [ ] **Step 5: Commit**

```bash
git add lib/db-sqlite.ts .gitignore __tests__/unit/lib/db-sqlite.test.ts
git commit -m "feat: add node:sqlite-backed database driver for trial mode"
```

---

### Task 10: Wire `lib/db.ts` to dispatch on dialect

**Files:**
- Modify: `lib/db.ts` (all of it — restructures `getDb`, `setupDatabase`, `withTransaction`, `resetPool`)
- Test: `__tests__/unit/lib/db-dispatch.test.ts`

**Interfaces:**
- Consumes: `getSqliteDb`, `setupSqliteDatabase`, `withSqliteTransaction`, `resetSqlitePool`, `DbClient` from `lib/db-sqlite.ts` (Task 9); `getDbDialect`, `getSqliteFilePath` from Task 2.
- Produces: `getDb(): DbClient` (return type changes from mysql2's `Pool` to the shared `DbClient` interface — structurally compatible, no route file changes needed since every call site only ever calls `.execute()`), `withTransaction<T>(callback: (conn: DbClient) => Promise<T>): Promise<T>` (parameter type changes from `mysql.Connection` to `DbClient`, same compatibility note).

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/lib/db-dispatch.test.ts
jest.mock('@/lib/setup', () => ({ getSiteConfig: jest.fn() }))
jest.mock('@/lib/db-sqlite', () => ({
  getSqliteDb: jest.fn().mockReturnValue({ execute: jest.fn() }),
  setupSqliteDatabase: jest.fn().mockResolvedValue(undefined),
  withSqliteTransaction: jest.fn(),
  resetSqlitePool: jest.fn(),
}))
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn().mockReturnValue({ execute: jest.fn(), getConnection: jest.fn() }),
  createConnection: jest.fn(),
}))

import { getSiteConfig } from '@/lib/setup'
import { getSqliteDb, setupSqliteDatabase, resetSqlitePool } from '@/lib/db-sqlite'
import { getDb, setupDatabase, resetPool } from '@/lib/db'

describe('lib/db dialect dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetPool()
  })

  it('delegates getDb() to the sqlite driver when dialect is sqlite', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue({ db: { dialect: 'sqlite', file: 'data/pixxel.db' } })
    getDb()
    expect(getSqliteDb).toHaveBeenCalledWith('data/pixxel.db')
  })

  it('delegates setupDatabase() to the sqlite driver when dialect is sqlite', async () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue({ db: { dialect: 'sqlite', file: 'data/pixxel.db' } })
    await setupDatabase()
    expect(setupSqliteDatabase).toHaveBeenCalledWith('data/pixxel.db')
  })

  it('resetPool() also resets the sqlite pool', () => {
    resetPool()
    expect(resetSqlitePool).toHaveBeenCalled()
  })

  it('uses the mysql2 pool when dialect is mysql (default)', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue(null)
    process.env.DB_HOST = 'localhost'
    const db = getDb()
    expect(getSqliteDb).not.toHaveBeenCalled()
    expect(db).toBeDefined()
    delete process.env.DB_HOST
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/lib/db-dispatch.test.ts`
Expected: FAIL — `getDb`/`setupDatabase`/`resetPool` don't yet consult `getDbDialect()`.

- [ ] **Step 3: Write minimal implementation**

Rewrite `lib/db.ts` in full:

```typescript
/**
 * lib/db.ts  —  SERVER ONLY
 *
 * Dispatches to a MySQL (mysql2) or SQLite (node:sqlite, lib/db-sqlite.ts)
 * backend depending on the configured dialect. Both expose the same
 * execute(sql, params) -> [rows, meta] contract (DbClient), so route files
 * never need to know which one is active.
 *
 * Credentials/config are resolved in priority order:
 *   1. site.config.json  (written during the /setup wizard)
 *   2. Environment variables (DB_TYPE + DB_HOST/... or DB_FILE)
 */
import mysql, { Pool } from "mysql2/promise";
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { randomUUID } from "crypto";
import { getSiteConfig, type DbDialect } from "@/lib/setup";
import {
  getSqliteDb, setupSqliteDatabase, withSqliteTransaction, resetSqlitePool,
  type DbClient,
} from "@/lib/db-sqlite";
import {
  SEED_DIAGRAM_TYPES, SEED_INDUSTRY_SECTORS, SEED_TELECOM_CAPABILITIES,
  SEED_UTILITY_CAPABILITIES, SEED_INVESTMENT_CLASSIFICATIONS,
} from "@/lib/db-seed-data";

export type { DbClient } from "@/lib/db-sqlite";

// ---------------------------------------------------------------------------
// Dialect resolution
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
// MySQL credential resolution (unchanged from before this feature)
// ---------------------------------------------------------------------------
export function getDbCredentials(): { host: string; port: number; user: string; password: string; database: string } | null {
  const config = getSiteConfig();
  if (config?.db?.dialect === "mysql") {
    return {
      host: config.db.host,
      port: Number(config.db.port ?? 3306),
      user: config.db.user ?? "root",
      password: config.db.password ?? "",
      database: config.db.name ?? "saas_app",
    };
  }

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
// MySQL pool singleton
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

// ---------------------------------------------------------------------------
// Public dispatchers
// ---------------------------------------------------------------------------
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

export function setupDatabase(): Promise<void> {
  if (getDbDialect() === "sqlite") {
    return setupSqliteDatabase(getSqliteFilePath());
  }
  if (!g._dbInitPromise) {
    g._dbInitPromise = runMysqlSetup().catch((err) => {
      g._dbInitPromise = null;
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

  const bootstrap = await mysql.createConnection({
    host: creds.host, port: creds.port, user: creds.user, password: creds.password,
  });
  const dbName = creds.database;
  await bootstrap.execute(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  const db = getPool();
  await db.execute<mysql.RowDataPacket[]>("SELECT GET_LOCK('pixxel_db_setup', 60) AS ok");
  try {
    await migrate(drizzle(db), { migrationsFolder: path.join(process.cwd(), "drizzle", "migrations") });

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

    const [countRows] = await db.execute<mysql.RowDataPacket[]>("SELECT COUNT(*) AS count FROM investment_classifications");
    if (Number(countRows[0].count) === 0) {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/lib/db-dispatch.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full unit + ui suite to confirm no regressions**

Run: `npm test`
Expected: PASS — every route file's `import mysql from "mysql2/promise"` and `db.execute<mysql.RowDataPacket[]>(...)` calls still typecheck and behave identically for the (default) mysql dialect, since `getDb()`'s runtime behavior for mysql is unchanged (still returns the same `Pool` object, just typed as `DbClient`).

- [ ] **Step 6: Commit**

```bash
git add lib/db.ts __tests__/unit/lib/db-dispatch.test.ts
git commit -m "feat: dispatch lib/db.ts between mysql2 and sqlite backends by dialect"
```

---

### Task 11: Setup wizard — database type selector

**Files:**
- Modify: `app/(setup)/setup/page.tsx`
- Test: manual verification (client-side form component with no existing unit test coverage for this page — following the existing pattern where `(setup)/setup/page.tsx` has no `__tests__/ui` counterpart today; not introducing new test infrastructure for a page that has none)

**Interfaces:**
- Produces: `DbForm` gains a `dialect: "mysql" | "sqlite"` field and a `sqliteFile: string` field; the payload POSTed to `/api/setup/test-db` and `/api/setup/complete` gains a `dialect` (and, when sqlite, `file`) field, consumed by Task 12.

- [ ] **Step 1: Extend `DbForm` and add the dialect toggle**

In `app/(setup)/setup/page.tsx`, update the `DbForm` interface and its default state:

```typescript
interface DbForm {
  dialect: "mysql" | "sqlite";
  host: string;
  port: string;
  user: string;
  password: string;
  name: string;
  sqliteFile: string;
}
```

```typescript
  const [db, setDb] = useState<DbForm>({
    dialect: "mysql",
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    name: "saas_app",
    sqliteFile: "data/pixxel.db",
  });
```

- [ ] **Step 2: Add the toggle and conditional fields to `StepDatabase`**

Replace the top of `StepDatabase`'s JSX (right after the `<h2>`/description paragraph, before the `grid grid-cols-1 gap-4 sm:grid-cols-3` block) with a dialect toggle, and wrap the MySQL fields so they only render for that dialect:

```tsx
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { onChange({ dialect: "mysql" }); setTestState("idle"); }}
          className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
            form.dialect === "mysql" ? "border-brand-600 bg-brand-50 text-brand-900" : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
        >
          MySQL / MariaDB
          <span className="mt-1 block text-xs font-normal text-slate-400">Connect to an existing database server.</span>
        </button>
        <button
          type="button"
          onClick={() => { onChange({ dialect: "sqlite" }); setTestState("idle"); }}
          className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
            form.dialect === "sqlite" ? "border-brand-600 bg-brand-50 text-brand-900" : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
        >
          SQLite (Trial Mode)
          <span className="mt-1 block text-xs font-normal text-slate-400">Single file, no separate database container needed.</span>
        </button>
      </div>

      {form.dialect === "sqlite" ? (
        <Field
          label="Database File Path"
          id="sqlite-file"
          value={form.sqliteFile}
          onChange={(v) => { onChange({ sqliteFile: v }); setTestState("idle"); }}
          placeholder="data/pixxel.db"
          hint="Stored inside the container. Mount a volume at this path to persist data across restarts."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field
                label="Host" id="db-host" value={form.host}
                onChange={(v) => { onChange({ host: v }); setTestState("idle"); }}
                placeholder="localhost" error={errors.host}
              />
            </div>
            <Field
              label="Port" id="db-port" value={form.port}
              onChange={(v) => { onChange({ port: v }); setTestState("idle"); }}
              placeholder="3306" error={errors.port}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Username" id="db-user" value={form.user}
              onChange={(v) => { onChange({ user: v }); setTestState("idle"); }}
              placeholder="root" error={errors.user}
            />
            <Field
              label="Password" id="db-password" type={showPassword ? "text" : "password"} value={form.password}
              onChange={(v) => { onChange({ password: v }); setTestState("idle"); }}
              placeholder="Leave blank if none" showToggle onToggle={() => setShowPassword((s) => !s)}
            />
          </div>
          <div className="mt-4">
            <Field
              label="Database Name" id="db-name" value={form.name}
              onChange={(v) => { onChange({ name: v }); setTestState("idle"); }}
              placeholder="saas_app" hint="Will be created if it does not exist." error={errors.name}
            />
          </div>
        </>
      )}
```

Update `validate()` to only require the MySQL fields when `form.dialect === "mysql"`, and skip them (no validation errors) for sqlite:

```typescript
  function validate() {
    const e: typeof errors = {};
    if (form.dialect === "mysql") {
      if (!form.host.trim()) e.host = "Host is required.";
      if (!form.user.trim()) e.user = "Username is required.";
      if (!form.name.trim()) e.name = "Database name is required.";
      const port = Number(form.port);
      if (form.port && (isNaN(port) || port < 1 || port > 65535))
        e.port = "Port must be between 1 and 65535.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }
```

Update `handleTest`'s request body to include `dialect` and `sqliteFile`:

```typescript
        body: JSON.stringify({
          dialect: form.dialect,
          host: form.host.trim(),
          port: Number(form.port) || 3306,
          user: form.user.trim(),
          password: form.password,
          name: form.name.trim(),
          file: form.sqliteFile.trim(),
        }),
```

- [ ] **Step 3: Update `StepReview` and the final submit payload**

In `StepReview`'s database section, branch the displayed rows:

```tsx
      <div className="mb-4 rounded-lg border border-slate-200 px-4 py-1">
        <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Database</p>
        <div className="divide-y divide-slate-100">
          {db.dialect === "sqlite" ? (
            <>
              <Row label="Type" value="SQLite (Trial Mode)" />
              <Row label="File" value={db.sqliteFile} />
            </>
          ) : (
            <>
              <Row label="Type" value="MySQL / MariaDB" />
              <Row label="Host" value={`${db.host}:${db.port || 3306}`} />
              <Row label="Username" value={db.user} />
              <Row label="Password" value="••••••••" />
              <Row label="Database" value={db.name} />
            </>
          )}
        </div>
      </div>
```

And update `handleComplete`'s POST body:

```typescript
        body: JSON.stringify({
          db: {
            dialect: db.dialect,
            host: db.host.trim(),
            port: Number(db.port) || 3306,
            user: db.user.trim(),
            password: db.password,
            name: db.name.trim(),
            file: db.sqliteFile.trim(),
          },
          appName: app.appName.trim(),
          orgName: app.orgName.trim(),
          admin: { name: admin.name.trim(), email: admin.email.trim(), password: admin.password },
        }),
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, navigate to `http://localhost:3000/setup` (with no `site.config.json` present or `setupComplete: false`), click "SQLite (Trial Mode)", confirm the MySQL fields disappear and the file-path field appears, and that "Test Connection" is replaced by working through to the next step (full end-to-end wiring happens in Task 12 — this step only confirms the UI toggle renders and the form state updates correctly).

- [ ] **Step 5: Commit**

```bash
git add "app/(setup)/setup/page.tsx"
git commit -m "feat: add SQLite trial-mode toggle to the setup wizard UI"
```

---

### Task 12: Dialect-aware `/api/setup/test-db` and `/api/setup/complete`

**Files:**
- Modify: `app/api/setup/test-db/route.ts`
- Modify: `app/api/setup/complete/route.ts`
- Test: `__tests__/unit/api/setup/test-db.test.ts` (new), `__tests__/unit/api/setup/complete.test.ts` (extend if exists, else create)

**Interfaces:**
- Consumes: `dialect`/`file` fields added to the request bodies in Task 11; `DbConfig` union from Task 1.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/unit/api/setup/test-db.test.ts
import { NextRequest } from 'next/server'
import fs from 'fs'

jest.mock('fs')
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(),
}))

import mysql from 'mysql2/promise'
import { POST } from '@/app/api/setup/test-db/route'

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/setup/test-db', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/setup/test-db', () => {
  beforeEach(() => jest.clearAllMocks())

  it('checks the directory is writable for sqlite, without opening a mysql connection', async () => {
    ;(fs.accessSync as jest.Mock) = jest.fn()
    ;(fs.mkdirSync as jest.Mock) = jest.fn()
    const res = await POST(makeReq({ dialect: 'sqlite', file: 'data/pixxel.db' }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mysql.createConnection).not.toHaveBeenCalled()
  })

  it('reports failure when the sqlite directory cannot be created', async () => {
    ;(fs.mkdirSync as jest.Mock) = jest.fn(() => { throw new Error('EACCES: permission denied'); })
    const res = await POST(makeReq({ dialect: 'sqlite', file: '/root/no-access/pixxel.db' }))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('permission denied')
  })

  it('still opens a mysql connection for the mysql dialect', async () => {
    const mockEnd = jest.fn().mockResolvedValue(undefined);
    (mysql.createConnection as jest.Mock).mockResolvedValue({
      execute: jest.fn().mockResolvedValue([[]]),
      end: mockEnd,
    })
    const res = await POST(makeReq({ dialect: 'mysql', host: 'localhost', port: 3306, user: 'root', password: '', name: 'saas_app' }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mysql.createConnection).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/api/setup/test-db.test.ts`
Expected: FAIL — route always assumes mysql and requires `host`/`user`/`name`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/setup/test-db/route.ts
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  const body = await req.json();
  const { dialect } = body;

  if (dialect === "sqlite") {
    const file = (body.file as string)?.trim();
    if (!file) {
      return NextResponse.json({ success: false, error: "A file path is required." }, { status: 400 });
    }
    try {
      const dir = path.dirname(path.join(process.cwd(), file));
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Path is not writable.";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
  }

  const { host, port, user, password, name } = body;
  if (!host || !user || !name) {
    return NextResponse.json(
      { success: false, error: "Host, user, and database name are required." },
      { status: 400 }
    );
  }

  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection({
      host, port: Number(port) || 3306, user, password: password ?? "", connectTimeout: 8000,
    });
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
}
```

Update `app/api/setup/complete/route.ts` to branch the `dbConfig` construction and `.env.local` contents:

```typescript
  const body = await req.json();
  const { db, appName, orgName, admin } = body;

  if (!db?.dialect) {
    return NextResponse.json({ error: "Missing database configuration." }, { status: 400 });
  }
  if (db.dialect === "mysql" && (!db.host || !db.user || !db.name)) {
    return NextResponse.json({ error: "Missing database configuration." }, { status: 400 });
  }
  if (db.dialect === "sqlite" && !db.file?.trim()) {
    return NextResponse.json({ error: "A SQLite file path is required." }, { status: 400 });
  }
  if (!appName?.trim() || !orgName?.trim()) {
    return NextResponse.json({ error: "Application name and organisation name are required." }, { status: 400 });
  }
  if (!admin?.name?.trim() || !admin?.email?.trim() || !admin?.password) {
    return NextResponse.json({ error: "Admin name, email, and password are required." }, { status: 400 });
  }

  const dbConfig: DbConfig = db.dialect === "sqlite"
    ? { dialect: "sqlite", file: db.file.trim() }
    : {
        dialect: "mysql",
        host: db.host.trim(), port: Number(db.port) || 3306,
        user: db.user.trim(), password: db.password ?? "", name: db.name.trim(),
      };

  writeSiteConfig({ setupComplete: false, appName: appName.trim(), orgName: orgName.trim(), db: dbConfig });

  const envContent = (dbConfig.dialect === "sqlite"
    ? [`DB_TYPE=sqlite`, `DB_FILE=${dbConfig.file}`]
    : [`DB_TYPE=mysql`, `DB_HOST=${dbConfig.host}`, `DB_PORT=${dbConfig.port}`, `DB_USER=${dbConfig.user}`, `DB_PASSWORD=${dbConfig.password}`, `DB_NAME=${dbConfig.name}`]
  ).concat("").join("\n");

  fs.writeFileSync(path.join(process.cwd(), ".env.local"), envContent, "utf-8");
```

(Add `import type { DbConfig } from "@/lib/setup";` to the top of the file. The rest of the handler — bootstrapping via `setupDatabase()`, creating the admin user, marking setup complete, and the error-rollback path — is unchanged, since it already goes through the now-dialect-aware `setupDatabase()`/`getDb()` from Task 10.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/api/setup`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/setup/test-db/route.ts app/api/setup/complete/route.ts __tests__/unit/api/setup
git commit -m "feat: dialect-aware setup wizard API routes"
```

---

### Task 13: Docker base image bump + data volume documentation

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml` if one exists in the repo root (check with `ls docker-compose*.yml`); if none exists, skip creating one — out of scope for this plan (no design requirement for a compose file, only for the Dockerfile itself to work standalone with a mounted volume).

**Interfaces:** none (infrastructure-only change).

- [ ] **Step 1: Bump the base image in all three build stages**

In `Dockerfile`, change all three `FROM node:20-alpine AS <stage>` lines to `FROM node:22-alpine AS <stage>` (deps, builder, runner stages).

- [ ] **Step 2: Document the SQLite data volume and DB_TYPE env var**

Replace the `Dockerfile`'s trailing comment block (`# Database connection — override these at runtime via -e or docker-compose env_file` through the `# ENV DB_NAME=` lines) with:

```dockerfile
# Database connection — override these at runtime via -e or docker-compose env_file.
#
# MySQL / MariaDB:
#   ENV DB_TYPE=mysql
#   ENV DB_HOST=
#   ENV DB_PORT=3306
#   ENV DB_USER=
#   ENV DB_PASSWORD=
#   ENV DB_NAME=
#
# SQLite (trial mode) — single file, no separate database container needed.
# Mount a volume at /app/data to persist it across container restarts:
#   docker run -v pixxel-data:/app/data -e DB_TYPE=sqlite -e DB_FILE=data/pixxel.db ...
#   ENV DB_TYPE=sqlite
#   ENV DB_FILE=data/pixxel.db
```

- [ ] **Step 3: Verify the image builds**

Run: `docker build -t pixxel:sqlite-test .`
Expected: build succeeds through all three stages on `node:22-alpine`.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "chore: bump Docker base image to node:22-alpine for node:sqlite support"
```

---

### Task 14: SQLite end-to-end smoke test

**Files:**
- Create: `__tests__/integration/sqlite-smoke.test.ts`

**Interfaces:**
- Consumes: `setupDatabase`, `getDb`, `resetPool` from `lib/db.ts` (Task 10); real route handlers from `app/api/assets/route.ts`, `app/api/settings/route.ts`.

This is the design doc's "lightweight smoke test" — not a duplicate of the full MySQL integration suite, just enough to exercise the two riskiest rewritten paths (the `GROUP_CONCAT` correlated-subquery rewrite, and the `ON CONFLICT` upsert) against a real `node:sqlite` file, end to end through the actual route handlers.

- [ ] **Step 1: Write the test**

```typescript
// __tests__/integration/sqlite-smoke.test.ts
import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/setup', () => {
  const actual = jest.requireActual('@/lib/setup')
  return { ...actual, getSiteConfig: jest.fn() }
})
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Admin User', email: 'admin@example.com', role: 'Admin' } }),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/observability/config', () => ({ refreshObservabilityConfig: jest.fn() }))

import { getSiteConfig } from '@/lib/setup'
import { resetPool } from '@/lib/db'
import { GET as getAssets, POST as createAsset } from '@/app/api/assets/route'
import { PUT as putSettings } from '@/app/api/settings/route'

describe('SQLite trial mode smoke test', () => {
  let dbFile: string

  beforeAll(() => {
    dbFile = path.join(os.tmpdir(), `pixxel-smoke-${randomUUID()}.db`)
    ;(getSiteConfig as jest.Mock).mockReturnValue({
      setupComplete: true, appName: 'Pixxel', orgName: 'Acme',
      db: { dialect: 'sqlite', file: dbFile },
    })
  })

  afterAll(() => {
    resetPool()
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile)
  })

  it('creates an asset and lists it back with aggregated department/architect/capability fields', async () => {
    // Seed a department directly so the created asset can reference it.
    const { getDb, setupDatabase } = await import('@/lib/db')
    await setupDatabase()
    const db = getDb()
    const deptId = randomUUID()
    await db.execute('INSERT INTO departments (id, name, status, created_by_id, created_by_name) VALUES (?, ?, ?, ?, ?)', [deptId, 'Engineering', 'Published', 'u1', 'Admin User'])

    const createReq = new NextRequest('http://localhost/api/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Asset', type: 'SaaS', lifecycleStatus: 'Proposed', departmentIds: [deptId] }),
    })
    const createRes = await createAsset(createReq)
    expect(createRes.status).toBe(201)

    const listRes = await getAssets(new NextRequest('http://localhost/api/assets'))
    expect(listRes.status).toBe(200)
    const { assets } = await listRes.json()
    const created = assets.find((a: { name: string }) => a.name === 'Test Asset')
    expect(created).toBeDefined()
    expect(created.departmentNames).toEqual(['Engineering'])
  })

  it('upserts a setting twice via ON CONFLICT without erroring', async () => {
    const first = await putSettings(new NextRequest('http://localhost/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { 'confluence.base_url': 'https://one.example' } }),
    }))
    expect(first.status).toBe(200)

    const second = await putSettings(new NextRequest('http://localhost/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { 'confluence.base_url': 'https://two.example' } }),
    }))
    expect(second.status).toBe(200)

    const { getDb } = await import('@/lib/db')
    const [rows] = await getDb().execute<{ value: string }[]>("SELECT value FROM app_settings WHERE key = 'confluence.base_url'")
    expect(rows[0].value).toBe('https://two.example')
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npm run test:integration -- sqlite-smoke`
Expected: PASS (2 tests). This exercises, against a real `node:sqlite` file: migrations + trigger application, seed data, the `GROUP_CONCAT` correlated-subquery rewrite (Task 7), and the `ON CONFLICT` upsert (Task 5) — the two riskiest rewrites in this plan — through real route handlers rather than mocks.

- [ ] **Step 3: Commit**

```bash
git add __tests__/integration/sqlite-smoke.test.ts
git commit -m "test: add SQLite trial-mode end-to-end smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** dialect abstraction (Tasks 2, 10), schema/migrations (Task 8), query compatibility for `INSERT IGNORE`/`ON DUPLICATE KEY`/`NOW()`/`GROUP_CONCAT` (Tasks 4–7), setup bootstrap changes — skip `CREATE DATABASE`/`GET_LOCK`, app-level UUIDs (Tasks 8–9), setup wizard UX (Task 11), `/api/setup/*` branching (Task 12), Docker bump (Task 13), smoke test (Task 14) — every design doc section maps to at least one task.
- **Placeholder scan:** no TBD/TODO markers; every step has complete code or an exact command with expected output.
- **Type consistency:** `DbClient.execute<T>(sql, params?): Promise<[T, unknown]>` is defined once in Task 9 and reused identically by Tasks 10 (`lib/db.ts` re-exports it), and referenced by name (not redefined) everywhere else. `DbDialect`/`DbConfig`/`MysqlDbConfig`/`SqliteDbConfig` are defined once in Task 1 and imported everywhere else they're used (Tasks 2, 3, 10, 11, 12) — no divergent redefinitions.
- **Non-goals reaffirmed:** no PostgreSQL support, no DB-level CHECK constraints for SQLite enum columns (app-level validation only, consistent with existing pre-write validation in every route), no full integration-test duplication per dialect (Task 14 is a smoke test, not a parallel suite).
