# Contract Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give vendor contracts a first-class `contracts` table (value, dates, renewal terms, notice period, owner, status), replacing the single `contract_amount`/`contract_end_date` pair on `assets`, with a `/contracts` list, vendor/asset-scoped views, and expiry alerts surfaced through the existing header notification bell and a new dashboard card.

**Architecture:** Additive-then-subtractive. Build the full new `contracts` system (schema, backfill, API, UI) first while the old `assets.contract_amount`/`contract_end_date` fields keep working untouched, then swap all app-code references over to the new system, and only then drop the old columns in a final migration — so the app is never in a broken intermediate state between commits.

**Tech Stack:** Next.js 14 App Router, TypeScript, mysql2 + Drizzle migrations (MySQL) / node:sqlite (SQLite trial mode), Tailwind, Jest.

**Spec:** `docs/superpowers/specs/2026-07-10-contract-management-design.md` — read this first for full rationale; this plan implements it task-by-task.

## Global Constraints

- Every new/modified API route is dialect-agnostic: use `getDb()`/`getDbDialect()`; this feature needs no `INSERT IGNORE`/`GROUP_CONCAT`-style divergence, so `lib/sql-compat.ts` helpers are not needed here — confirm this holds as each route is written (if a genuine MySQL/SQLite syntax difference appears, branch on `getDbDialect()` at that one call site, do not hand-roll a parallel implementation).
- Every route calls `requireUser(req)` (reads) or `requireUser(req, ["Admin","Member"])` (writes), and returns `auth.response` unchanged on failure.
- All schema changes go through `drizzle/schema.ts` **and** `drizzle/schema.sqlite.ts`, generated via `npx drizzle-kit generate` / `npm run db:generate:sqlite` — never hand-written `CREATE TABLE`/`ALTER TABLE` in `lib/db.ts` or `lib/db-sqlite.ts`.
- No FK constraint builders (`references()`) anywhere in this schema — new FK-shaped columns are plain `char(36)` (mysql) / `text` (sqlite), integrity enforced app-side.
- UUIDs are always generated app-side via `randomUUID()` from `crypto` — never DB-side.
- Every mutating route on `contracts` writes to `audit_log` via `writeAudit()`.
- Contract "expiring soon" / urgency status is **computed at read time**, never stored — no cron/scheduled job infrastructure exists in this app.
- Contract value is **USD only** — no currency field (see spec Non-goals).
- Never combine the backfill migration and the column-drop migration — verified separately, per the spec's "Migration risk" section. This plan enforces that by ordering: schema add (Task 1) → backfill (Task 2) → full new system built and working (Tasks 3–7) → app code stops referencing old columns (Task 8) → old columns dropped (Task 9).
- New unit tests follow the exact `jest.mock('@/lib/db', ...)` / `jest.mock('@/lib/audit', ...)` / `jest.mock('@/lib/require-user', ...)` conventions already used in `__tests__/unit/api/vendors/*.test.ts`.
- Verify with `npx tsc --noEmit` after each task, and `npm test` before considering the plan done.

---

## Task 1: Schema — `contracts` table

**Files:**
- Modify: `drizzle/schema.ts`
- Modify: `drizzle/schema.sqlite.ts`
- Generate: `drizzle/migrations/000X_*.sql` (via `npx drizzle-kit generate`)
- Generate: `drizzle/migrations-sqlite/000X_*.sql` (via `npm run db:generate:sqlite`)

**Interfaces:**
- Produces: `contracts` table (id, vendor_id nullable, asset_id nullable, title, value, start_date, end_date, notice_period_days, auto_renews, owner, status, doc_url, notes, created_by, timestamps) — consumed by every task from Task 2 onward.

- [ ] **Step 1: Add `boolean` to the mysql-core import in `drizzle/schema.ts`**

Change:
```ts
import {
  mysqlTable, char, varchar, text, longtext, int, datetime, date, decimal,
  mysqlEnum, primaryKey, index, uniqueIndex,
} from "drizzle-orm/mysql-core";
```
to:
```ts
import {
  mysqlTable, char, varchar, text, longtext, int, datetime, date, decimal,
  mysqlEnum, primaryKey, index, uniqueIndex, boolean,
} from "drizzle-orm/mysql-core";
```

- [ ] **Step 2: Add the `contracts` table to `drizzle/schema.ts`**, immediately after the `vendors` table definition (after its closing `});` around line 136):

```ts
export const contracts = mysqlTable("contracts", {
  id: char("id", { length: 36 }).primaryKey(),
  vendorId: char("vendor_id", { length: 36 }),
  assetId: char("asset_id", { length: 36 }),
  title: varchar("title", { length: 255 }).notNull(),
  value: decimal("value", { precision: 15, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  noticePeriodDays: int("notice_period_days", { unsigned: true }),
  autoRenews: boolean("auto_renews").notNull().default(false),
  owner: varchar("owner", { length: 255 }),
  status: mysqlEnum("status", ["Active", "Terminated"]).notNull().default("Active"),
  docUrl: varchar("doc_url", { length: 500 }),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_contracts_vendor").on(t.vendorId),
  index("idx_contracts_asset").on(t.assetId),
]);
```

- [ ] **Step 3: Add the sqlite mirror to `drizzle/schema.sqlite.ts`**, immediately after the `vendors` table definition (after its closing `});` around line 133), using `integer(col, { mode: "boolean" })` for the boolean column (this file's established convention — `integer` is already imported at the top of the file) and `text(col, { enum: [...] })` for the status enum (see `departments.status` in this same file for the exact pattern):

```ts
export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  vendorId: text("vendor_id"),
  assetId: text("asset_id"),
  title: text("title").notNull(),
  value: real("value"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  noticePeriodDays: integer("notice_period_days"),
  autoRenews: integer("auto_renews", { mode: "boolean" }).notNull().default(false),
  owner: text("owner"),
  status: text("status", { enum: ["Active", "Terminated"] }).notNull().default("Active"),
  docUrl: text("doc_url"),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_contracts_vendor").on(t.vendorId),
  index("idx_contracts_asset").on(t.assetId),
]);
```

- [ ] **Step 4: Generate migrations**

Run: `DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=x DB_NAME=pixxel_generate npx drizzle-kit generate --config drizzle.config.ts`
(This does not need a reachable database — `generate` diffs `drizzle/schema.ts` against the existing snapshots in `drizzle/migrations/` purely offline; the dummy env vars only satisfy `drizzle.config.ts`'s `getDbCredentials()` check. If a real `.env.local`/`site.config.json` is already configured in this environment, the dummy vars are unnecessary — try without them first.)
Expected: a new numbered file appears under `drizzle/migrations/` containing `CREATE TABLE contracts (...)`.

Run: `npm run db:generate:sqlite`
Expected: a new numbered file appears under `drizzle/migrations-sqlite/`.

- [ ] **Step 5: Review the generated SQL**

Read both generated files. Confirm: `id` PK, `vendor_id`/`asset_id` nullable with no FK constraint, `status` enum defaults to `'Active'`, `auto_renews` defaults to false/0, indexes on `vendor_id` and `asset_id` present.

- [ ] **Step 6: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add drizzle/schema.ts drizzle/schema.sqlite.ts drizzle/migrations drizzle/migrations-sqlite
git commit -m "feat: add contracts table via drizzle migrations"
```

---

## Task 2: Backfill migration from `assets.contract_amount`/`contract_end_date`

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/db-sqlite.ts`

**Interfaces:**
- Consumes: `contracts` table from Task 1.
- Produces: one `contracts` row per existing asset that has a non-null `contract_amount` or `contract_end_date`, run automatically on every `setupDatabase()` call (idempotent via `INSERT IGNORE`/`INSERT OR IGNORE` keyed on a deterministic id — see below).

**Design note:** the backfilled contract's `id` is set to the **same value as the source asset's `id`** (not a fresh `randomUUID()`). This is deliberate: it makes the backfill statement idempotent forever using the exact same `INSERT IGNORE` pattern already used by every other seed statement in this function (a retry silently no-ops because the id already exists as a primary key), with no separate "have I already run this" marker needed. `contracts.id` has no foreign-key relationship to `assets.id` — reusing the value is safe, just a provenance convenience.

- [ ] **Step 1: Add the backfill statement to `runMysqlSetup()` in `lib/db.ts`**

Add this immediately after the `await migrate(...)` line (around line 180), before the `SEED_DIAGRAM_TYPES` loop:

```ts
  // One-time backfill: every asset that still has legacy contract_amount/
  // contract_end_date data gets a corresponding contracts row, so that data
  // survives once those two asset columns are dropped in a later migration
  // (see docs/superpowers/specs/2026-07-10-contract-management-design.md).
  // Idempotent forever via INSERT IGNORE keyed on id = the source asset's id
  // — a second run on an already-migrated install silently no-ops.
  await db.execute(
    `INSERT IGNORE INTO contracts
       (id, vendor_id, asset_id, title, value, end_date, status, created_by_id, created_by_name)
     SELECT id, vendor_id, id, CONCAT(name, ' contract'), contract_amount, contract_end_date,
            'Active', 'system', 'System'
     FROM assets
     WHERE contract_amount IS NOT NULL OR contract_end_date IS NOT NULL`
  );
```

- [ ] **Step 2: Add the sqlite equivalent to `runSqliteSetup()` in `lib/db-sqlite.ts`**

Add this immediately after the migration-applying `for (const file of files)` loop (around line 123), before the `insertIgnore` helper's first use for `SEED_DIAGRAM_TYPES`:

```ts
  // One-time backfill — see the matching comment in lib/db.ts's
  // runMysqlSetup() for full rationale. SQLite equivalent: INSERT OR IGNORE,
  // string concatenation via ||.
  conn.exec(
    `INSERT OR IGNORE INTO contracts
       (id, vendor_id, asset_id, title, value, end_date, status, created_by_id, created_by_name)
     SELECT id, vendor_id, id, name || ' contract', contract_amount, contract_end_date,
            'Active', 'system', 'System'
     FROM assets
     WHERE contract_amount IS NOT NULL OR contract_end_date IS NOT NULL`
  );
```

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification (no automated test — matches this function's existing seed-loop code, which also has no dedicated unit test; verified by exercising `setupDatabase()`, same as every other statement in this function)**

If a local MySQL or SQLite dev database is available in this environment: boot the app once (`npm run dev`, hit any route), then run
`SELECT COUNT(*) FROM contracts` and compare against
`SELECT COUNT(*) FROM assets WHERE contract_amount IS NOT NULL OR contract_end_date IS NOT NULL` — the counts must match. If no database is available in this environment, document that this check is outstanding and must be run by a human before Task 9 (the column-drop migration) is approved.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts lib/db-sqlite.ts
git commit -m "feat: backfill contracts from legacy asset contract fields"
```

---

## Task 3: `types/index.ts` additions + `lib/contracts.ts` urgency helper

**Files:**
- Modify: `types/index.ts`
- Create: `lib/contracts.ts`
- Test: `__tests__/unit/lib/contracts.test.ts`

**Interfaces:**
- Produces: `ContractStatus`, `Contract` types; `getEffectiveDeadline(contract): Date | null` and `getContractUrgency(contract): ContractUrgency` functions — consumed by every task from Task 4 onward (API routes for filtering/counting, UI for badges).

- [ ] **Step 1: Add types to `types/index.ts`**, immediately after the `Vendor` interface (after its closing `}` around line 119), following the exact camelCase/`Id`+`Name`-pair convention used by `Vendor`/`ProjectAsset`:

```ts
export type ContractStatus = "Active" | "Terminated";

export interface Contract {
  id: string;
  vendorId: string | null;
  vendorName: string | null;
  assetId: string | null;
  assetName: string | null;
  title: string;
  value: number | null;
  startDate: string | null;
  endDate: string | null;
  noticePeriodDays: number | null;
  autoRenews: boolean;
  owner: string | null;
  status: ContractStatus;
  docUrl: string | null;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Write the failing test for `lib/contracts.ts`**

Create `__tests__/unit/lib/contracts.test.ts`:

```ts
import { getEffectiveDeadline, getContractUrgency } from '@/lib/contracts'

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('getEffectiveDeadline', () => {
  it('returns null when endDate is null', () => {
    expect(getEffectiveDeadline({ endDate: null, noticePeriodDays: 30, autoRenews: true })).toBeNull()
  })

  it('returns endDate directly when autoRenews is false', () => {
    const endDate = daysFromNow(60)
    const result = getEffectiveDeadline({ endDate, noticePeriodDays: 30, autoRenews: false })
    expect(result?.toISOString().slice(0, 10)).toBe(endDate)
  })

  it('returns endDate directly when autoRenews is true but noticePeriodDays is null', () => {
    const endDate = daysFromNow(60)
    const result = getEffectiveDeadline({ endDate, noticePeriodDays: null, autoRenews: true })
    expect(result?.toISOString().slice(0, 10)).toBe(endDate)
  })

  it('subtracts noticePeriodDays from endDate when autoRenews is true', () => {
    const endDate = daysFromNow(60)
    const result = getEffectiveDeadline({ endDate, noticePeriodDays: 30, autoRenews: true })
    expect(result?.toISOString().slice(0, 10)).toBe(daysFromNow(30))
  })
})

describe('getContractUrgency', () => {
  it('returns "terminated" when status is Terminated, regardless of dates', () => {
    const urgency = getContractUrgency({
      status: 'Terminated', endDate: daysFromNow(-100), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('terminated')
  })

  it('returns "active" when endDate is null', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: null, noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('active')
  })

  it('returns "overdue" when the effective deadline is in the past', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(-5), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('overdue')
  })

  it('returns "critical" when the effective deadline is within 30 days', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(15), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('critical')
  })

  it('returns "warning" when the effective deadline is within 90 days but beyond 30', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(60), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('warning')
  })

  it('returns "active" when the effective deadline is beyond 90 days', () => {
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(200), noticePeriodDays: null, autoRenews: false,
    })
    expect(urgency).toBe('active')
  })

  it('uses the notice-adjusted deadline for an auto-renewing contract, not the raw end date', () => {
    // endDate is 200 days out (would be "active" on its own), but notice
    // period pulls the effective deadline to 20 days out ("critical").
    const urgency = getContractUrgency({
      status: 'Active', endDate: daysFromNow(200), noticePeriodDays: 180, autoRenews: true,
    })
    expect(urgency).toBe('critical')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- lib/contracts`
Expected: FAIL — `Cannot find module '@/lib/contracts'`

- [ ] **Step 4: Implement `lib/contracts.ts`**

```ts
/**
 * lib/contracts.ts
 *
 * Shared "how urgent is this contract" computation, used by both the API
 * (filtering/counting expiring contracts) and the UI (urgency badges) so
 * the two never disagree. Nothing here is stored — status/urgency is
 * always computed at read time from the contract's own dates.
 */
export interface ContractDeadlineInput {
  endDate: string | null;
  noticePeriodDays: number | null;
  autoRenews: boolean;
}

/**
 * The date by which action is actually needed: for an auto-renewing
 * contract with a notice period, that's endDate minus noticePeriodDays
 * (miss it and it silently renews) — otherwise it's just endDate.
 */
export function getEffectiveDeadline(contract: ContractDeadlineInput): Date | null {
  if (!contract.endDate) return null;
  const end = new Date(contract.endDate);
  if (contract.autoRenews && contract.noticePeriodDays != null) {
    const deadline = new Date(end);
    deadline.setDate(deadline.getDate() - contract.noticePeriodDays);
    return deadline;
  }
  return end;
}

export type ContractUrgency = "terminated" | "overdue" | "critical" | "warning" | "active";

export interface ContractUrgencyInput extends ContractDeadlineInput {
  status: string;
}

export function getContractUrgency(contract: ContractUrgencyInput): ContractUrgency {
  if (contract.status === "Terminated") return "terminated";
  const deadline = getEffectiveDeadline(contract);
  if (!deadline) return "active";
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "critical";
  if (diffDays <= 90) return "warning";
  return "active";
}

/** True when a contract counts toward an "expiring within N days" alert/count. */
export function isExpiringWithin(contract: ContractUrgencyInput, days: number): boolean {
  if (contract.status !== "Active") return false;
  const deadline = getEffectiveDeadline(contract);
  if (!deadline) return false;
  const now = new Date();
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= days;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- lib/contracts`
Expected: PASS, 8/8 tests.

- [ ] **Step 6: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add types/index.ts lib/contracts.ts __tests__/unit/lib/contracts.test.ts
git commit -m "feat: add Contract type and shared urgency computation helper"
```

---

## Task 4: `POST /api/contracts` + `GET /api/contracts`

**Files:**
- Create: `app/api/contracts/route.ts`
- Test: `__tests__/unit/api/contracts/route.test.ts`

**Interfaces:**
- Consumes: `Contract`/`ContractStatus` (Task 3), `isExpiringWithin` (Task 3), `writeAudit` (`lib/audit.ts`), `requireUser` (`lib/require-user.ts`), `getDb`/`setupDatabase` (`lib/db.ts`).
- Produces: `GET /api/contracts` → `{ contracts: Contract[] }`, supports `?vendor=<id>`, `?asset=<id>`, `?expiring=<days>` query params. `POST /api/contracts` → `{ id: string }` (201) or `{ error: string }` (400/500) — consumed by Task 7's list page.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/api/contracts/route.test.ts`:

```ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/contracts/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const ROW = {
  id: 'c1', vendor_id: 'v1', vendor_name: 'Acme', asset_id: null, asset_name: null,
  title: 'Acme SaaS', value: '1000.00', start_date: '2026-01-01', end_date: daysFromNow(200),
  notice_period_days: null, auto_renews: 0, owner: 'Jane', status: 'Active',
  doc_url: null, notes: null,
  created_by_id: 'u1', created_by_name: 'Test User',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
}

describe('GET /api/contracts', () => {
  it('returns the contract list', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    const res = await GET(new NextRequest('http://localhost/api/contracts'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contracts).toHaveLength(1)
    expect(body.contracts[0].id).toBe('c1')
    expect(body.contracts[0].value).toBe(1000)
  })

  it('filters by vendor query param', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    await GET(new NextRequest('http://localhost/api/contracts?vendor=v1'))
    const [sql, params] = mockExecute.mock.calls[0]
    expect(sql).toMatch(/vendor_id\s*=\s*\?/)
    expect(params).toContain('v1')
  })

  it('filters by asset query param', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    await GET(new NextRequest('http://localhost/api/contracts?asset=a1'))
    const [sql, params] = mockExecute.mock.calls[0]
    expect(sql).toMatch(/asset_id\s*=\s*\?/)
    expect(params).toContain('a1')
  })

  it('filters out non-expiring contracts when ?expiring=N is set', async () => {
    const soon = { ...ROW, id: 'c2', end_date: daysFromNow(10) }
    mockExecute.mockResolvedValueOnce([[ROW, soon]])
    const res = await GET(new NextRequest('http://localhost/api/contracts?expiring=30'))
    const body = await res.json()
    expect(body.contracts).toHaveLength(1)
    expect(body.contracts[0].id).toBe('c2')
  })
})

describe('POST /api/contracts', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/contracts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when title is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid status', async () => {
    const res = await POST(makeReq({ title: 'Test', status: 'Bogus' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success and writes an audit entry', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ title: 'Acme SaaS', vendorId: 'v1' }))
    expect(res.status).toBe(201)
    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit).toHaveBeenCalledTimes(1)
    expect(writeAudit.mock.calls[0][0]).toMatchObject({ tableName: 'contracts', action: 'CREATE' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- api/contracts`
Expected: FAIL — `Cannot find module '@/app/api/contracts/route'`

- [ ] **Step 3: Implement `app/api/contracts/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Contract, ContractStatus } from "@/types";
import { requireUser } from "@/lib/require-user";
import { isExpiringWithin } from "@/lib/contracts";

const VALID_STATUSES: ContractStatus[] = ["Active", "Terminated"];

function rowToContract(row: mysql.RowDataPacket): Contract {
  const toISO = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
  return {
    id: row.id,
    vendorId: row.vendor_id ?? null,
    vendorName: row.vendor_name ?? null,
    assetId: row.asset_id ?? null,
    assetName: row.asset_name ?? null,
    title: row.title,
    value: row.value != null ? Number(row.value) : null,
    startDate: toISO(row.start_date),
    endDate: toISO(row.end_date),
    noticePeriodDays: row.notice_period_days != null ? Number(row.notice_period_days) : null,
    autoRenews: !!row.auto_renews,
    owner: row.owner ?? null,
    status: row.status,
    docUrl: row.doc_url ?? null,
    notes: row.notes ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: toISO(row.created_at)!,
    updatedAt: toISO(row.updated_at)!,
  };
}

// GET /api/contracts
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    const vendorId = req.nextUrl.searchParams.get("vendor");
    const assetId = req.nextUrl.searchParams.get("asset");
    const expiringParam = req.nextUrl.searchParams.get("expiring");

    const where: string[] = [];
    const params: string[] = [];
    if (vendorId) { where.push("c.vendor_id = ?"); params.push(vendorId); }
    if (assetId) { where.push("c.asset_id = ?"); params.push(assetId); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT c.*, v.name AS vendor_name, a.name AS asset_name
       FROM contracts c
       LEFT JOIN vendors v ON v.id = c.vendor_id
       LEFT JOIN assets a ON a.id = c.asset_id
       ${whereSql}
       ORDER BY c.end_date IS NULL, c.end_date ASC, c.title ASC`,
      params
    );

    let contracts = rows.map(rowToContract);
    if (expiringParam) {
      const days = Number(expiringParam);
      contracts = contracts.filter((c) => isExpiringWithin(c, days));
    }

    return NextResponse.json({ contracts });
  } catch (err) {
    logger.error({ err, route: "GET /api/contracts" }, "request failed");
    return NextResponse.json({ error: "Failed to load contracts." }, { status: 500 });
  }
}

// POST /api/contracts
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      vendorId, assetId, title, value, startDate, endDate,
      noticePeriodDays, autoRenews, owner, status, docUrl, notes,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Contract title is required." }, { status: 400 });

    const resolvedStatus: ContractStatus = status ?? "Active";
    if (!VALID_STATUSES.includes(resolvedStatus)) {
      return NextResponse.json({ error: "Invalid contract status." }, { status: 400 });
    }

    const db = getDb();
    const id = randomUUID();

    const values = {
      vendorId: vendorId || null,
      assetId: assetId || null,
      title: title.trim(),
      value: value != null && value !== "" ? Number(value) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      noticePeriodDays: noticePeriodDays != null && noticePeriodDays !== "" ? Number(noticePeriodDays) : null,
      autoRenews: !!autoRenews,
      owner: owner?.trim() || null,
      status: resolvedStatus,
      docUrl: docUrl?.trim() || null,
      notes: notes?.trim() || null,
    };

    await db.execute(
      `INSERT INTO contracts
         (id, vendor_id, asset_id, title, value, start_date, end_date,
          notice_period_days, auto_renews, owner, status, doc_url, notes,
          created_by_id, created_by_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, values.vendorId, values.assetId, values.title, values.value,
       values.startDate, values.endDate, values.noticePeriodDays, values.autoRenews,
       values.owner, values.status, values.docUrl, values.notes, user.id, user.name]
    );

    await writeAudit({
      tableName: "contracts", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/contracts" }, "request failed");
    return NextResponse.json({ error: "Failed to create contract." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- api/contracts`
Expected: PASS, 8/8 tests.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/contracts/route.ts __tests__/unit/api/contracts/route.test.ts
git commit -m "feat: add GET/POST /api/contracts"
```

---

## Task 5: `GET/PUT/DELETE /api/contracts/[id]`

**Files:**
- Create: `app/api/contracts/[id]/route.ts`
- Test: `__tests__/unit/api/contracts/id.test.ts`

**Interfaces:**
- Consumes: same as Task 4.
- Produces: `GET /api/contracts/[id]` → `Contract` (200) or 404. `PUT` → `{ success: true }` or 400/404. `DELETE` → `{ success: true }` or 404 — consumed by Task 7's edit/delete modal.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/api/contracts/id.test.ts`:

```ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { GET, PUT, DELETE } from '@/app/api/contracts/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = Promise.resolve({ id: 'c1' })

const ROW = {
  id: 'c1', vendor_id: 'v1', vendor_name: 'Acme', asset_id: null, asset_name: null,
  title: 'Acme SaaS', value: '1000.00', start_date: '2026-01-01', end_date: '2026-12-31',
  notice_period_days: null, auto_renews: 0, owner: 'Jane', status: 'Active',
  doc_url: null, notes: null,
  created_by_id: 'u1', created_by_name: 'Test User',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
}

describe('GET /api/contracts/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(404)
  })

  it('returns the contract when found', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    const res = await GET(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('c1')
  })
})

describe('PUT /api/contracts/[id]', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/contracts/c1', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when title is missing', async () => {
    const res = await PUT(makeReq({}), { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the contract does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq({ title: 'Updated' }), { params })
    expect(res.status).toBe(404)
  })

  it('returns success and writes an audit entry on update', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]]).mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ title: 'Updated title' }), { params })
    expect(res.status).toBe(200)
    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit.mock.calls[0][0]).toMatchObject({ tableName: 'contracts', action: 'UPDATE' })
  })
})

describe('DELETE /api/contracts/[id]', () => {
  it('returns 404 when the contract does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(404)
  })

  it('returns success and writes an audit entry on delete', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]]).mockResolvedValueOnce([{}])
    const res = await DELETE(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(200)
    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit.mock.calls[0][0]).toMatchObject({ tableName: 'contracts', action: 'DELETE', newValues: null })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- api/contracts`
Expected: FAIL — `Cannot find module '@/app/api/contracts/[id]/route'`

- [ ] **Step 3: Implement `app/api/contracts/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Contract, ContractStatus } from "@/types";
import { requireUser } from "@/lib/require-user";

const VALID_STATUSES: ContractStatus[] = ["Active", "Terminated"];

function rowToContract(row: mysql.RowDataPacket): Contract {
  const toISO = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
  return {
    id: row.id,
    vendorId: row.vendor_id ?? null,
    vendorName: row.vendor_name ?? null,
    assetId: row.asset_id ?? null,
    assetName: row.asset_name ?? null,
    title: row.title,
    value: row.value != null ? Number(row.value) : null,
    startDate: toISO(row.start_date),
    endDate: toISO(row.end_date),
    noticePeriodDays: row.notice_period_days != null ? Number(row.notice_period_days) : null,
    autoRenews: !!row.auto_renews,
    owner: row.owner ?? null,
    status: row.status,
    docUrl: row.doc_url ?? null,
    notes: row.notes ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: toISO(row.created_at)!,
    updatedAt: toISO(row.updated_at)!,
  };
}

// GET /api/contracts/[id]
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT c.*, v.name AS vendor_name, a.name AS asset_name
       FROM contracts c
       LEFT JOIN vendors v ON v.id = c.vendor_id
       LEFT JOIN assets a ON a.id = c.asset_id
       WHERE c.id = ? LIMIT 1`,
      [params.id]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    return NextResponse.json(rowToContract(row));
  } catch (err) {
    logger.error({ err, route: "GET /api/contracts/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to load contract." }, { status: 500 });
  }
}

// PUT /api/contracts/[id]
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      vendorId, assetId, title, value, startDate, endDate,
      noticePeriodDays, autoRenews, owner, status, docUrl, notes,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Contract title is required." }, { status: 400 });

    const resolvedStatus: ContractStatus = status ?? "Active";
    if (!VALID_STATUSES.includes(resolvedStatus)) {
      return NextResponse.json({ error: "Invalid contract status." }, { status: 400 });
    }

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM contracts WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

    const values = {
      vendorId: vendorId || null,
      assetId: assetId || null,
      title: title.trim(),
      value: value != null && value !== "" ? Number(value) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      noticePeriodDays: noticePeriodDays != null && noticePeriodDays !== "" ? Number(noticePeriodDays) : null,
      autoRenews: !!autoRenews,
      owner: owner?.trim() || null,
      status: resolvedStatus,
      docUrl: docUrl?.trim() || null,
      notes: notes?.trim() || null,
    };

    await db.execute(
      `UPDATE contracts SET
         vendor_id=?, asset_id=?, title=?, value=?, start_date=?, end_date=?,
         notice_period_days=?, auto_renews=?, owner=?, status=?, doc_url=?, notes=?
       WHERE id=?`,
      [values.vendorId, values.assetId, values.title, values.value,
       values.startDate, values.endDate, values.noticePeriodDays, values.autoRenews,
       values.owner, values.status, values.docUrl, values.notes, params.id]
    );

    await writeAudit({
      tableName: "contracts", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        vendorId: current.vendor_id, assetId: current.asset_id, title: current.title,
        value: current.value, startDate: current.start_date, endDate: current.end_date,
        noticePeriodDays: current.notice_period_days, autoRenews: !!current.auto_renews,
        owner: current.owner, status: current.status, docUrl: current.doc_url, notes: current.notes,
      },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/contracts/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update contract." }, { status: 500 });
  }
}

// DELETE /api/contracts/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM contracts WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

    await db.execute("DELETE FROM contracts WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "contracts", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { title: current.title, vendorId: current.vendor_id, assetId: current.asset_id },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/contracts/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete contract." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- api/contracts`
Expected: PASS — this task's 7 new tests plus Task 4's 8 tests, 15/15 total.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/contracts/[id]/route.ts __tests__/unit/api/contracts/id.test.ts
git commit -m "feat: add GET/PUT/DELETE /api/contracts/[id]"
```

---

## Task 6: `GET /api/contracts/expiring-count`

**Files:**
- Create: `app/api/contracts/expiring-count/route.ts`
- Test: `__tests__/unit/api/contracts/expiring-count.test.ts`

**Interfaces:**
- Consumes: `isExpiringWithin` (Task 3).
- Produces: `GET /api/contracts/expiring-count?days=<N>` (default 90) → `{ count: number }` — consumed by Task 11 (dashboard card) and Task 12 (header bell poll).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/api/contracts/expiring-count.test.ts`:

```ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { GET } from '@/app/api/contracts/expiring-count/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function row(id: string, endDateOffset: number, status = 'Active') {
  return {
    id, status, end_date: daysFromNow(endDateOffset),
    notice_period_days: null, auto_renews: 0,
  };
}

describe('GET /api/contracts/expiring-count', () => {
  it('defaults to a 90-day window', async () => {
    mockExecute.mockResolvedValueOnce([[row('c1', 10), row('c2', 200)]])
    const res = await GET(new NextRequest('http://localhost/api/contracts/expiring-count'))
    const body = await res.json()
    expect(body.count).toBe(1)
  })

  it('respects an explicit ?days= param', async () => {
    mockExecute.mockResolvedValueOnce([[row('c1', 10), row('c2', 60)]])
    const res = await GET(new NextRequest('http://localhost/api/contracts/expiring-count?days=30'))
    const body = await res.json()
    expect(body.count).toBe(1)
  })

  it('excludes Terminated contracts', async () => {
    mockExecute.mockResolvedValueOnce([[row('c1', 10, 'Terminated')]])
    const res = await GET(new NextRequest('http://localhost/api/contracts/expiring-count'))
    const body = await res.json()
    expect(body.count).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- api/contracts/expiring-count`
Expected: FAIL — `Cannot find module '@/app/api/contracts/expiring-count/route'`

- [ ] **Step 3: Implement `app/api/contracts/expiring-count/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { isExpiringWithin } from "@/lib/contracts";

// GET /api/contracts/expiring-count?days=90
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const days = Number(req.nextUrl.searchParams.get("days") ?? "90");

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT status, end_date, notice_period_days, auto_renews FROM contracts WHERE status = 'Active' AND end_date IS NOT NULL"
    );

    const count = rows.filter((r) =>
      isExpiringWithin(
        { status: r.status, endDate: r.end_date, noticePeriodDays: r.notice_period_days, autoRenews: !!r.auto_renews },
        days
      )
    ).length;

    return NextResponse.json({ count });
  } catch (err) {
    logger.error({ err, route: "GET /api/contracts/expiring-count" }, "request failed");
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
```

Note: `end_date` from the mocked test rows is a plain `"YYYY-MM-DD"` string, matching what `isExpiringWithin`'s `endDate: string | null` expects — no `toISO`/`Date` conversion needed here since this route only feeds dates into date math, never returns them to the client.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- api/contracts`
Expected: PASS — all contracts tests, 18/18 total (8 + 7 + 3).

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/contracts/expiring-count/route.ts __tests__/unit/api/contracts/expiring-count.test.ts
git commit -m "feat: add GET /api/contracts/expiring-count"
```

---

## Task 7: `/contracts` list page + modal + nav entry

**Files:**
- Create: `app/(dashboard)/contracts/page.tsx`
- Modify: `config/navigation.ts`

**Interfaces:**
- Consumes: `Contract`/`ContractStatus` (Task 3), `getContractUrgency`/`ContractUrgency` (Task 3), the API routes from Tasks 4–5, `Vendor`/`Asset` types (existing), `useAuth()` (existing, for `canWrite`).
- Produces: the `/contracts` page other tasks link to (Task 8's asset detail mini-list reuses this page's fetch logic conceptually, not a shared component — see Task 8 for why).

- [ ] **Step 1: Add the "Contracts" nav item to `config/navigation.ts`**, in the existing `"Assets"` group, after `"Projects"`:

```ts
      {
        label: "Projects",
        href: "/projects",
        icon: "FolderKanban",
      },
      {
        label: "Contracts",
        href: "/contracts",
        icon: "FileText",
      },
```

- [ ] **Step 2: Create `app/(dashboard)/contracts/page.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, AlertTriangle, FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Contract, ContractStatus, Vendor } from "@/types";
import { getContractUrgency, ContractUrgency } from "@/lib/contracts";

interface AssetOption { id: string; name: string; }

const STATUSES: ContractStatus[] = ["Active", "Terminated"];

const URGENCY_STYLES: Record<ContractUrgency, { label: string; className: string }> = {
  terminated: { label: "Terminated", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  overdue:    { label: "Overdue",    className: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" },
  critical:   { label: "Expiring soon", className: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" },
  warning:    { label: "Renewal upcoming", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  active:     { label: "Active", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
};

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface ContractForm {
  vendorId: string;
  assetId: string;
  title: string;
  value: string;
  startDate: string;
  endDate: string;
  noticePeriodDays: string;
  autoRenews: boolean;
  owner: string;
  status: ContractStatus;
  docUrl: string;
  notes: string;
}

const EMPTY: ContractForm = {
  vendorId: "", assetId: "", title: "", value: "", startDate: "", endDate: "",
  noticePeriodDays: "", autoRenews: false, owner: "", status: "Active", docUrl: "", notes: "",
};

function contractToForm(c: Contract): ContractForm {
  return {
    vendorId: c.vendorId ?? "",
    assetId: c.assetId ?? "",
    title: c.title,
    value: c.value != null ? String(c.value) : "",
    startDate: c.startDate ?? "",
    endDate: c.endDate ?? "",
    noticePeriodDays: c.noticePeriodDays != null ? String(c.noticePeriodDays) : "",
    autoRenews: c.autoRenews,
    owner: c.owner ?? "",
    status: c.status,
    docUrl: c.docUrl ?? "",
    notes: c.notes ?? "",
  };
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</p>
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract modal
// ---------------------------------------------------------------------------
function ContractModal({
  isOpen, onClose, editing, vendors, assets, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: Contract | null;
  vendors: Vendor[];
  assets: AssetOption[];
  onSave: (form: ContractForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ContractForm>(EMPTY);
  const [titleError, setTitleError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? contractToForm(editing) : EMPTY);
      setTitleError(""); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof ContractForm>(key: K, value: ContractForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setTitleError("Contract title is required."); return; }
    setTitleError(""); setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit — ${editing.title}` : "Add Contract"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">

          <SectionHeading>Identity</SectionHeading>

          <div className="col-span-2">
            <Input label="Contract title" type="text" placeholder="e.g. Salesforce Enterprise License"
              value={form.title} onChange={(e) => set("title", e.target.value)}
              error={titleError} autoFocus required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vendor</label>
            <select
              value={form.vendorId}
              onChange={(e) => set("vendorId", e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="">— no vendor —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Linked asset</label>
            <select
              value={form.assetId}
              onChange={(e) => set("assetId", e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="">— no asset —</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <SectionHeading>Value &amp; Dates</SectionHeading>

          <Input label="Annual value (USD)" type="number" placeholder="e.g. 50000"
            value={form.value} onChange={(e) => set("value", e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as ContractStatus)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <Input label="Start date" type="date"
            value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />

          <Input label="End date" type="date"
            value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />

          <Input label="Notice period (days)" type="number" placeholder="e.g. 30"
            value={form.noticePeriodDays} onChange={(e) => set("noticePeriodDays", e.target.value)}
            hint="Days before end date that cancellation notice is due" />

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="autoRenews"
              checked={form.autoRenews}
              onChange={(e) => set("autoRenews", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="autoRenews" className="text-sm text-slate-700 dark:text-slate-300">
              Auto-renews unless cancelled
            </label>
          </div>

          <SectionHeading>Ownership &amp; Links</SectionHeading>

          <Input label="Owner" type="text" placeholder="Full name"
            value={form.owner} onChange={(e) => set("owner", e.target.value)} />

          <Input label="Document URL" type="url" placeholder="https://..."
            value={form.docUrl} onChange={(e) => set("docUrl", e.target.value)} />

          <SectionHeading>Notes</SectionHeading>

          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
            <textarea rows={3} value={form.notes} placeholder="Renewal terms, negotiation history, additional context…"
              onChange={(e) => set("notes", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>
            {editing ? "Save changes" : "Add Contract"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ContractsPage() {
  const { user, canWrite } = useAuth();
  const searchParams = useSearchParams();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [vendorFilter, setVendorFilter] = useState(searchParams.get("vendor") ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const expiringFilter = searchParams.get("expiring");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const qs = new URLSearchParams();
      if (vendorFilter) qs.set("vendor", vendorFilter);
      if (expiringFilter) qs.set("expiring", expiringFilter);
      const [contractsRes, vendorsRes, assetsRes] = await Promise.all([
        fetch(`/api/contracts?${qs.toString()}`),
        fetch("/api/vendors"),
        fetch("/api/assets"),
      ]);
      const contractsData = await contractsRes.json();
      if (!contractsRes.ok) throw new Error(contractsData.error ?? "Failed to load contracts.");
      const vendorsData = await vendorsRes.json();
      const assetsData = await assetsRes.json();
      setContracts(contractsData.contracts);
      setVendors(vendorsData.vendors ?? []);
      setAssets((assetsData.assets ?? []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, [vendorFilter, expiringFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = contracts.filter((c) => !statusFilter || c.status === statusFilter);

  async function handleSave(form: ContractForm) {
    if (!user) return;
    const url = editing ? `/api/contracts/${editing.id}` : "/api/contracts";
    const method = editing ? "PUT" : "POST";
    const payload = {
      ...form,
      vendorId: form.vendorId || null,
      assetId: form.assetId || null,
    };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchData();
    setModalOpen(false); setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/contracts/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      await fetchData();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsDeleting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Contracts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vendor contracts, renewal terms, and upcoming expirations.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Contract
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          <option value="">All vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
            <AlertTriangle className="h-6 w-6" />
            <p className="text-sm">{fetchError}</p>
            <Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">
              {contracts.length === 0 ? "No contracts added yet" : "No contracts match your filters"}
            </p>
            {contracts.length === 0 && canWrite && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Contract
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Vendor</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Asset</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {filtered.map((contract) => {
                  const urgency = getContractUrgency(contract);
                  const style = URGENCY_STYLES[urgency];
                  return (
                    <tr key={contract.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{contract.title}</p>
                          {contract.docUrl && (
                            <a href={contract.docUrl} target="_blank" rel="noopener noreferrer"
                              className="text-slate-400 hover:text-brand-600" aria-label="Open document">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 sm:table-cell">
                        {contract.vendorName ?? <span className="italic text-slate-300">—</span>}
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 md:table-cell">
                        {contract.assetName ?? <span className="italic text-slate-300">—</span>}
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 lg:table-cell">
                        {formatCurrency(contract.value)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(contract.endDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canWrite && (
                            <>
                              <button
                                onClick={() => { setEditing(contract); setModalOpen(true); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                                aria-label={`Edit ${contract.title}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setDeleteTarget(contract); setDeleteError(null); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                                aria-label={`Delete ${contract.title}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && !fetchError && contracts.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} of {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
        </p>
      )}

      <ContractModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        vendors={vendors}
        assets={assets}
        onSave={handleSave}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Contract" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.title}</span>?
              </p>
              {deleteError && <p className="mt-2 text-sm text-red-500">{deleteError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" isLoading={isDeleting} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

Note: `useSearchParams()` requires this page to be wrapped appropriately for static generation — check whether other pages under `app/(dashboard)/` that already use `useSearchParams()` (e.g. inspect for any existing usage via `grep -rn "useSearchParams" app/`) need a `<Suspense>` boundary in this Next.js version; if none currently do (likely, since this whole route group renders client-side under `DashboardLayout`), no extra wrapping is needed here either — verify by running `npm run build` at the end of this task and confirming no static-generation error is thrown for `/contracts`.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Start the dev server (`npm run dev`), sign in, navigate to Contracts in the sidebar, create a contract with a vendor and an end date 20 days out, confirm it shows a red "Expiring soon" badge; edit it to add `autoRenews` + a 60-day notice period with the same end date and confirm the badge logic still reflects the closer effective deadline; delete it.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/contracts/page.tsx" config/navigation.ts
git commit -m "feat: add Contracts list page, modal, and navigation entry"
```

---

## Task 8: Remove legacy contract fields from asset app code

**Files:**
- Modify: `types/index.ts`
- Modify: `app/api/assets/route.ts`
- Modify: `app/api/assets/[id]/route.ts`
- Modify: `components/assets/AssetModal.tsx`
- Modify: `app/(dashboard)/assets/[id]/page.tsx`
- Create: `components/contracts/AssetContractsList.tsx`

**Interfaces:**
- Consumes: `GET /api/contracts?asset=<id>` (Task 4).
- Produces: the asset detail page no longer reads/writes `contractAmount`/`contractEndDate` anywhere in app code (the DB columns still physically exist until Task 9 — this task only stops the app from touching them, so the app keeps working at every commit boundary in this plan).

- [ ] **Step 1: Remove `contractEndDate`/`contractAmount` from the `Asset` interface in `types/index.ts`**

Delete these two lines (around line 158-159):
```ts
  contractEndDate: string | null;
  contractAmount: number | null;
```

- [ ] **Step 2: Remove contract field handling from `app/api/assets/route.ts`**

Remove line 57-58 (`rowToAsset`'s contract fields):
```ts
    contractEndDate: toDate(row.contract_end_date),
    contractAmount: row.contract_amount != null ? Number(row.contract_amount) : null,
```

In the `POST` handler's destructure (around line 148), remove `contractEndDate, contractAmount,` from the list of destructured body fields.

Remove the values-object lines (around line 186-187):
```ts
      contractEndDate: contractEndDate || null,
      contractAmount: contractAmount != null && contractAmount !== "" ? Number(contractAmount) : null,
```

In the `INSERT INTO assets (...)` column list (around line 197) and its matching `VALUES` binding list (around line 202), remove `contract_end_date, contract_amount` from the column list and `values.contractEndDate, values.contractAmount,` from the bindings — keep every other column/binding in the same relative order, just close the gap.

- [ ] **Step 3: Remove contract field handling from `app/api/assets/[id]/route.ts`**

Apply the identical removals as Step 2, at the equivalent locations in this file: `rowToAsset`-equivalent mapping (~line 114-115), `PUT` handler's destructure (~line 141), values object (~line 194-195), `UPDATE assets SET ...` column list (~line 206) and bindings (~line 212), and the audit `oldValues` construction (~line 265) — remove `contractEndDate: toDate(current.contract_end_date), contractAmount: current.contract_amount,` from that object.

- [ ] **Step 4: Remove contract fields from `components/assets/AssetModal.tsx`**

Remove from the form-state interface (~line 73-74):
```ts
  contractEndDate: string;
  contractAmount: string;
```

Remove from the `EMPTY` form default (~line 87) the `contractEndDate: "", contractAmount: "",` portion (keep `appUrl: "", docUrl: "",` and anything else on that line).

Remove from the asset-to-form mapping (~line 118-119):
```ts
    contractEndDate: asset.contractEndDate ?? "",
    contractAmount: asset.contractAmount != null ? String(asset.contractAmount) : "",
```

Remove the two `<Input>` elements for contract end date and contract amount (~lines 572-586, the full `Input` block for "Contract end date" and the full `Input` block for "Contract amount" including its `hint` prop).

- [ ] **Step 5: Create `components/contracts/AssetContractsList.tsx`**

A small, self-contained component the asset detail page renders in place of the old contract fields:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import { Contract } from "@/types";

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function AssetContractsList({ assetId }: { assetId: string }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contracts?asset=${assetId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setContracts(d.contracts ?? []); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [assetId]);

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />;
  }

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-6 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500">
        <FileText className="h-6 w-6 text-slate-300 dark:text-slate-600" />
        <p className="text-sm">No contracts linked to this asset</p>
        <Link href="/contracts" className="text-xs text-brand-600 hover:underline">
          Add one on the Contracts page
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contracts.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.title}</p>
            {c.docUrl && (
              <a href={c.docUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand-600">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>{formatCurrency(c.value)}</span>
            <span>Ends {formatDate(c.endDate)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

(This is deliberately its own small component rather than a shared list extracted from Task 7's page — the list page has filters/CRUD/urgency badges the asset-scoped view doesn't need; a shared component would need enough conditional branching to not be worth the coupling, per the "don't force reuse where interfaces would diverge" principle.)

- [ ] **Step 6: Wire `AssetContractsList` into `app/(dashboard)/assets/[id]/page.tsx`**

Add the import near the top of the file:
```tsx
import { AssetContractsList } from "@/components/contracts/AssetContractsList";
```

Replace the two `<Field label="Contract end date" .../>` and `<Field label="Contract amount" .../>` elements (~lines 647-653) with:
```tsx
        </Section>

        {/* Contracts */}
        <Section title="Contracts">
          <div className="col-span-2">
            <AssetContractsList assetId={asset.id} />
          </div>
        </Section>
```

(This closes the existing "SLA & Dates" `<Section>` right where the contract fields used to be, then opens a new sibling `<Section title="Contracts">` — check the surrounding JSX structure in the actual file first to confirm the exact closing-tag placement matches this file's real `<Section>` component boundaries, since line numbers may have shifted slightly from Step 1-4's edits in other files not affecting this one, but line numbers *within this file* are as read.)

Also remove the two now-dead entries from whatever field-label mapping object exists near the top of this file (~line 103):
```ts
  contractEndDate: "Contract End Date", contractAmount: "Contract Amount",
```
(Only remove this if nothing else in the file still reads that mapping for these two keys — confirm via a search within the file before deleting.)

- [ ] **Step 7: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors. This step will surface any remaining `contractAmount`/`contractEndDate` reference left behind by Steps 1-6 as a type error — fix any that appear.

- [ ] **Step 8: Update existing asset unit tests**

Run: `npm test -- api/assets`
Expected: some existing tests in `__tests__/unit/api/assets/*.test.ts` likely assert on `contractAmount`/`contractEndDate` in request/response fixtures (they predate this change). Read the failures, remove/update the now-invalid assertions and mock row fields the same way Steps 1-3 removed them from the route files — do not weaken unrelated assertions.

Run: `npm test -- api/assets`
Expected: PASS after fixes.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions elsewhere.

- [ ] **Step 10: Manual verification**

Start the dev server, open an asset that was auto-backfilled a contract in Task 2 (or create a new asset, then add a contract for it via `/contracts`), open the asset detail page, confirm the new "Contracts" section shows it instead of the old two fields, and confirm creating/editing an asset via `AssetModal` no longer shows contract inputs.

- [ ] **Step 11: Commit**

```bash
git add types/index.ts app/api/assets/route.ts "app/api/assets/[id]/route.ts" \
  components/assets/AssetModal.tsx "app/(dashboard)/assets/[id]/page.tsx" \
  components/contracts/AssetContractsList.tsx __tests__/unit/api/assets
git commit -m "feat: replace legacy asset contract fields with linked Contracts list"
```

---

## Task 9: Drop legacy asset columns

**Files:**
- Modify: `drizzle/schema.ts`
- Modify: `drizzle/schema.sqlite.ts`
- Modify: `lib/db.ts`
- Modify: `lib/db-sqlite.ts`
- Generate: `drizzle/migrations/000X_*.sql`
- Generate: `drizzle/migrations-sqlite/000X_*.sql`

**Interfaces:**
- Consumes: nothing new — this is the final cleanup step once Task 8 has confirmed the app no longer reads/writes `assets.contract_amount`/`assets.contract_end_date`.
- Produces: `assets` no longer has `contract_amount`/`contract_end_date` columns; `lib/db.ts`/`lib/db-sqlite.ts` no longer contain the Task 2 backfill statement (which would otherwise reference now-nonexistent columns and error on every boot).

**⚠️ Before starting this task:** confirm Task 2's Step 4 manual verification was actually completed (backfill row count matched the pre-migration asset count) — either from that task's own record, or by running the verification query fresh against a real database now, one last time, immediately before this task's Step 3. This is the "verification step" the spec's Migration risk section requires between backfill and column drop. Do not proceed to Step 3 without it.

- [ ] **Step 1: Remove `contractEndDate`/`contractAmount` from the `assets` table in `drizzle/schema.ts`**

Delete these two lines from the `assets` table definition:
```ts
  contractEndDate: date("contract_end_date"),
  contractAmount: decimal("contract_amount", { precision: 15, scale: 2 }),
```

- [ ] **Step 2: Remove the sqlite mirror's equivalent lines in `drizzle/schema.sqlite.ts`**

Delete:
```ts
  contractEndDate: text("contract_end_date"),
  contractAmount: real("contract_amount"),
```

- [ ] **Step 3: Remove the now-obsolete backfill statement from `lib/db.ts`**

Delete the entire `INSERT IGNORE INTO contracts ... SELECT ... FROM assets WHERE contract_amount IS NOT NULL OR contract_end_date IS NOT NULL` block added in Task 2 Step 1 (including its explanatory comment) — once the columns are gone, this statement would throw `Unknown column 'contract_amount'` on every boot.

- [ ] **Step 4: Remove the sqlite equivalent from `lib/db-sqlite.ts`**

Delete the `INSERT OR IGNORE INTO contracts ...` block added in Task 2 Step 2, same reasoning.

- [ ] **Step 5: Generate migrations**

Run: `DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=x DB_NAME=pixxel_generate npx drizzle-kit generate --config drizzle.config.ts`
Expected: a new numbered file appears under `drizzle/migrations/` containing `ALTER TABLE assets DROP COLUMN contract_end_date` and `ALTER TABLE assets DROP COLUMN contract_amount` (drizzle-kit may combine these into one `ALTER TABLE` statement with two `DROP COLUMN` clauses, or two separate statements — either is correct).

Run: `npm run db:generate:sqlite`
Expected: a new numbered file appears under `drizzle/migrations-sqlite/`. SQLite's `ALTER TABLE ... DROP COLUMN` requires SQLite ≥ 3.35 — if drizzle-kit instead generates a table-rebuild (create new table, copy data, drop old, rename), that is expected and correct for older-SQLite compatibility; read the generated SQL to confirm it preserves all other columns' data.

- [ ] **Step 6: Review the generated SQL carefully**

This is a destructive, irreversible migration. Read both files in full and confirm: only `contract_end_date` and `contract_amount` are affected, no other column is touched, and (for the sqlite table-rebuild case, if it occurs) every other column is correctly carried over in the rebuild's `INSERT INTO ... SELECT` step.

- [ ] **Step 7: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors (this also re-confirms Task 8 fully removed every reference — if it hadn't, this step would now fail on the missing schema fields).

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add drizzle/schema.ts drizzle/schema.sqlite.ts lib/db.ts lib/db-sqlite.ts drizzle/migrations drizzle/migrations-sqlite
git commit -m "feat: drop legacy assets.contract_amount/contract_end_date columns"
```

---

## Task 10: Vendors list — "View contracts" link

**Files:**
- Modify: `app/(dashboard)/vendors/page.tsx`

**Interfaces:**
- Consumes: nothing new (pure UI link to `/contracts?vendor=<id>`, already supported by Task 7's page reading `searchParams.get("vendor")`).

- [ ] **Step 1: Add a "View contracts" link to each vendor row's actions**

In the vendor list's actions `<td>` (around line 420-441 in `app/(dashboard)/vendors/page.tsx`), add a link before the edit/delete buttons:

```tsx
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/contracts?vendor=${vendor.id}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                          aria-label={`View contracts for ${vendor.name}`}
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                        {canWrite && (
                          <>
                            <button
                              onClick={() => { setEditing(vendor); setModalOpen(true); }}
```
(keep the rest of that `<td>` block — the edit/delete buttons — exactly as it already is; this only adds the new `<Link>` immediately before the existing `{canWrite && (...)}` block).

Add the two new imports at the top of the file:
```tsx
import Link from "next/link";
```
and add `FileText` to the existing `lucide-react` import line (`import { Plus, Pencil, Trash2, AlertTriangle, ExternalLink, Package2 } from "lucide-react";` becomes `import { Plus, Pencil, Trash2, AlertTriangle, ExternalLink, Package2, FileText } from "lucide-react";`).

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Start the dev server, go to Vendors, click the new contracts icon on a vendor row, confirm it navigates to `/contracts` pre-filtered to that vendor.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/vendors/page.tsx"
git commit -m "feat: add View contracts link to vendor list rows"
```

---

## Task 11: Dashboard card

**Files:**
- Modify: `app/api/dashboard/stats/route.ts`
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `isExpiringWithin` (Task 3).
- Produces: `GET /api/dashboard/stats` response gains `expiringContracts30d: number` — consumed by the dashboard's stat card grid.

**Design note:** the count is folded into the existing `/api/dashboard/stats` endpoint (one round trip, matching how every other dashboard card already sources its data) rather than a separate call to Task 6's `expiring-count` endpoint — that endpoint remains for Task 12's independent 60-second bell poll, which the dashboard page does not need.

- [ ] **Step 1: Add the expiring-contracts count to `app/api/dashboard/stats/route.ts`**

Add a new import:
```ts
import { isExpiringWithin } from "@/lib/contracts";
```

Add a new query to the existing `Promise.all([...])` array (after the `strategyRows` query):
```ts
      db.execute<mysql.RowDataPacket[]>(
        "SELECT status, end_date, notice_period_days, auto_renews FROM contracts WHERE status = 'Active' AND end_date IS NOT NULL"
      ),
```
and destructure it alongside the others — change:
```ts
    const [[deptRows], [lifecycleRows], [tierRows], [projectRows], [strategyRows]] = await Promise.all([
```
to:
```ts
    const [[deptRows], [lifecycleRows], [tierRows], [projectRows], [strategyRows], [contractRows]] = await Promise.all([
```

Add the computed count after the existing `assetsByStrategy` mapping:
```ts
    const expiringContracts30d = contractRows.filter((r) =>
      isExpiringWithin(
        { status: r.status, endDate: r.end_date, noticePeriodDays: r.notice_period_days, autoRenews: !!r.auto_renews },
        30
      )
    ).length;
```

Add it to the response object:
```ts
    return NextResponse.json({
      publishedDepartments: deptRows[0].count as number,
      activeProjects: Number(projectRows[0].count),
      assetsByLifecycle,
      assetsByTier,
      assetsByStrategy,
      expiringContracts30d,
    });
```

And add a safe default to the catch block's fallback response:
```ts
    return NextResponse.json({ publishedDepartments: 0, assetsByLifecycle: [], expiringContracts30d: 0 }, { status: 500 });
```

- [ ] **Step 2: Add the stat card to `app/(dashboard)/dashboard/page.tsx`**

Add `AlertCircle` to the existing `lucide-react` import line (becomes `import { TrendingUp, Users, Building2, ArrowUpRight, Server, FolderKanban, AlertCircle } from "lucide-react";`).

Add a new state variable near the other `useState` calls:
```tsx
  const [expiringContracts, setExpiringContracts] = useState<number | null>(null);
```

In the existing `useEffect`'s `.then((d) => { ... })` block, add:
```tsx
        setExpiringContracts(d.expiringContracts30d ?? 0);
```

Add a new entry to the `stats` array, after the "Active Projects" entry:
```tsx
    {
      label: "Contracts Expiring Soon",
      value: expiringContracts === null ? "—" : String(expiringContracts),
      change: "Within 30 days",
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/30",
      loading: expiringContracts === null,
    },
```

Wrap the whole card in a link to `/contracts?expiring=30` by changing the stats-grid map from a plain `<div>` to a `<Link>` for this one entry — simplest correct approach: make every stat card a `<Link>`, defaulting to a no-op `href` for cards that don't need one. Add near the top of the file:
```tsx
import Link from "next/link";
```
and give each object in the `stats` array an `href` field (`href: "/contracts?expiring=30"` for the new card; omit or set to `undefined` for the rest), then change the render:
```tsx
        {stats.map((s) => {
          const CardTag = s.href ? Link : "div";
          const cardProps = s.href ? { href: s.href } : {};
          return (
            <CardTag
              key={s.label}
              {...cardProps}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
```
(closing the map with `);})` instead of `))` to match the new block-body arrow function — and closing the `<CardTag>` tag instead of `</div>` at the end of each card's JSX).

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors. `CardTag` being a variable holding either `Link` or the string `"div"` and used as a JSX tag is valid TypeScript/React (a capitalized variable of type `typeof Link | "div"` works as a dynamic component), but double-check the exact type checks cleanly — if `tsc` complains about the union component type, the fallback is to keep the plain `<div>` structure unchanged for all cards except the new one, and wrap only the new card's contents in an internal `<Link>` (e.g. an absolutely-positioned `<Link className="absolute inset-0" />` overlay) rather than changing every card's tag — simpler and avoids the union-type complexity entirely if it causes friction.

- [ ] **Step 4: Manual verification**

Start the dev server, view `/dashboard`, confirm the new "Contracts Expiring Soon" card renders with the correct count and links to `/contracts?expiring=30`.

- [ ] **Step 5: Commit**

```bash
git add app/api/dashboard/stats/route.ts "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: add expiring-contracts count to dashboard"
```

---

## Task 12: Header bell integration

**Files:**
- Modify: `components/layout/Header.tsx`

**Interfaces:**
- Consumes: `GET /api/contracts/expiring-count` (Task 6, default 90-day window).
- Produces: the header bell's badge count and dropdown gain a contracts section — this is the final task in the plan.

**Test note:** as of this plan, no `__tests__/unit/components/**Header*` test file exists for `components/layout/Header.tsx` (confirmed via search during planning) — the spec's guidance to "extend rather than add a parallel test file" therefore doesn't apply here; this task adds no new test file, consistent with the rest of this component having no existing unit test coverage to extend. Manual verification (Step 5) is this task's only verification, matching precedent.

- [ ] **Step 1: Add a second poll for expiring contracts**

Add `FileText` to the existing `lucide-react` import line (becomes `import { Bell, Menu, Moon, Search, Sun, UserCircle, LogOut, MessageSquare, FileText } from "lucide-react";`).

Add a new state variable alongside `newCount`:
```tsx
  const [expiringCount, setExpiringCount] = useState(0);
```

Add a new fetch function alongside `fetchNewCount`:
```tsx
  const fetchExpiringCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/contracts/expiring-count");
      if (!res.ok) return;
      const data = await res.json();
      setExpiringCount(data.count ?? 0);
    } catch {
      // silently ignore
    }
  }, [isAdmin]);
```

Add it to the existing polling `useEffect` (change the effect that currently only calls `fetchNewCount`):
```tsx
  useEffect(() => {
    fetchNewCount();
    fetchExpiringCount();
    const interval = setInterval(() => {
      fetchNewCount();
      fetchExpiringCount();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchNewCount, fetchExpiringCount]);
```

- [ ] **Step 2: Combine both counts into the badge**

Change the badge-count logic. Where the bell button currently renders:
```tsx
              {newCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                  {newCount > 9 ? "9+" : newCount}
                </span>
              )}
```
Introduce a combined total just above the JSX return (or inline) and use it instead:
```tsx
  const totalNotifications = newCount + expiringCount;
```
and change the badge condition/content to use `totalNotifications` instead of `newCount`:
```tsx
              {totalNotifications > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                  {totalNotifications > 9 ? "9+" : totalNotifications}
                </span>
              )}
```

- [ ] **Step 3: Add a contracts section to the dropdown**

Change the dropdown header's "new" badge condition from `newCount > 0` to `totalNotifications > 0`, and its count from `newCount` to `totalNotifications`:
```tsx
                  {totalNotifications > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                      {totalNotifications} new
                    </span>
                  )}
```

Change the empty-state condition from `newCount === 0` to `totalNotifications === 0` (still shows "No new feedback submissions" as the empty state — leave that copy as-is, it's the only content shown when both counts are zero).

Change the feedback section's own conditional from `else` to explicitly `newCount > 0`, and add a second, independent section for `expiringCount > 0` right after it (both can show at once — replace the existing single `{newCount === 0 ? (...) : (...)}` block):

```tsx
                {totalNotifications === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-slate-400">
                    <Bell className="h-8 w-8 text-slate-200 dark:text-slate-700" />
                    <p className="text-sm">No new notifications</p>
                  </div>
                ) : (
                  <>
                    {newCount > 0 && (
                      <div className="px-4 py-4 flex items-start gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
                          <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {newCount} new feedback submission{newCount !== 1 ? "s" : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Awaiting review in Settings → Feedback
                          </p>
                        </div>
                      </div>
                    )}
                    {expiringCount > 0 && (
                      <div className="px-4 py-4 flex items-start gap-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
                          <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {expiringCount} contract{expiringCount !== 1 ? "s" : ""} expiring soon
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <Link
                              href="/contracts?expiring=90"
                              onClick={() => setNotifOpen(false)}
                              className="hover:underline"
                            >
                              View expiring contracts
                            </Link>
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
```

(Note this changes the "No new feedback submissions" empty-state copy to the more general "No new notifications" — correct, since the empty state now covers two notification sources, not just one.)

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Start the dev server, sign in as Admin, create a contract expiring within 90 days (or rely on data from earlier tasks' manual testing), open the header bell, confirm the badge count includes it, confirm the dropdown shows both the feedback section (if any) and the new contracts section, and confirm the "View expiring contracts" link navigates correctly and closes the dropdown.

- [ ] **Step 6: Run the full test suite one final time**

Run: `npm test`
Expected: PASS, all suites.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: succeeds (this also catches any static-generation issue from Task 7's `useSearchParams()` usage that `next dev` might not surface).

- [ ] **Step 7: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "feat: surface expiring contracts in the header notification bell"
```

---

## Final verification

- [ ] Run `npx tsc --noEmit` — zero errors across the whole feature.
- [ ] Run `npm test` — all unit + ui tests pass.
- [ ] Run `npm run build` — production build succeeds.
- [ ] Run `npm run test:integration` if a local test DB is configured (`.env.test`), otherwise note it was skipped.
- [ ] Manually walk through the full lifecycle once end-to-end: create a vendor → create a contract for that vendor linked to an asset with an auto-renew + notice period → confirm it appears on `/contracts`, on the asset's detail page, on the vendor's "View contracts" link, on the dashboard card (if within 30 days), and in the header bell (if within 90 days) → edit it → delete it.
- [ ] Confirm `assets.contract_amount`/`assets.contract_end_date` no longer exist in the schema and no app code references them (`grep -rn "contractAmount\|contractEndDate" app/ components/ lib/ types/` should return nothing).
