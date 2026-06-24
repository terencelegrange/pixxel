# Roadmap by Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Gantt-chart roadmap page at `/roadmap/by-platform` that shows every asset's investment phases over a user-selected quarter range, with inline add/edit/delete phase modals and a configurable investment classifications settings page.

**Architecture:** Two new DB tables (`investment_classifications`, `asset_roadmap_phases`) are bootstrapped in the existing `setupDatabase()` call. Four new API route files handle CRUD. The roadmap page uses percentage-based absolute positioning over a `position: relative` chart lane — no new libraries. Investment Classifications are managed via a new settings page following the exact changelog page pattern.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS v3 (`darkMode: "class"`), mysql2 pool via `lib/db.ts`, `writeAudit()` on every write, Jest 29 (unit tests mock `@/lib/db` and `@/lib/audit`).

## Global Constraints

- Quarter strings always in `"YYYY-Qn"` format (e.g. `"2026-Q3"`). Lexicographic sort is correct for this format.
- `end_quarter >= start_quarter` must be enforced at the API level (return 400 if violated).
- Overlapping phases for the same asset must return 409 (not 400).
- DELETE of a classification in use by phases must return 409 with message `"Cannot delete: this classification is in use by one or more roadmap phases."`
- All writes call `writeAudit()` with the correct table name, action, oldValues, newValues.
- Unit tests follow the exact pattern in `__tests__/unit/api/roles/route.test.ts`: `jest.mock` before imports, `beforeEach` with `jest.clearAllMocks()`, `(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })`.
- No new npm packages.
- Run `npx tsc --noEmit` after every task that touches TypeScript files.
- Run `npm test` (unit + UI suite) after every task that touches test files.

---

### Task 1: DB tables + TypeScript types

**Files:**
- Modify: `lib/db.ts` (end of `runSetup()`, after the `plantuml_diagram_assets` table block)
- Modify: `types/index.ts` (append 4 new interfaces at end of file)

**Interfaces:**
- Produces: `InvestmentClassification`, `AssetRoadmapPhase`, `RoadmapAsset`, `RoadmapDomainGroup` — used by all later tasks

- [ ] **Step 1: Add the two tables + seed to `lib/db.ts`**

In `lib/db.ts`, find the closing `}` of `runSetup()` (currently after the `plantuml_diagram_assets` table block at the bottom). Insert the following **before** that closing brace:

```typescript
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
      SELECT UUID(), 'Invest',       '#22c55e', 1, 'system', 'System' UNION ALL
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
```

- [ ] **Step 2: Add TypeScript types to `types/index.ts`**

Append to the end of `types/index.ts`:

```typescript
export interface InvestmentClassification {
  id: string;
  name: string;
  color: string;
  sortOrder: number | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRoadmapPhase {
  id: string;
  assetId: string;
  classificationId: string;
  classificationName: string;
  classificationColor: string;
  startQuarter: string;
  endQuarter: string;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapAsset {
  id: string;
  name: string;
  phases: AssetRoadmapPhase[];
}

export interface RoadmapDomainGroup {
  domainId: string;
  domainName: string;
  assets: RoadmapAsset[];
}
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add lib/db.ts types/index.ts
git commit -m "feat: add investment_classifications and asset_roadmap_phases DB tables and TypeScript types"
```

---

### Task 2: Investment Classifications API

**Files:**
- Create: `app/api/investment-classifications/route.ts`
- Create: `app/api/investment-classifications/[id]/route.ts`
- Create: `__tests__/unit/api/investment-classifications/route.test.ts`
- Create: `__tests__/unit/api/investment-classifications/id.test.ts`

**Interfaces:**
- Consumes: `InvestmentClassification` from `@/types`
- Produces: `GET /api/investment-classifications` → `{ classifications: InvestmentClassification[] }`, `POST` → `{ id }` 201, `PUT`/`DELETE` → `{ ok: true }` 200

- [ ] **Step 1: Write failing tests for `route.ts`**

Create `__tests__/unit/api/investment-classifications/route.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/investment-classifications/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/investment-classifications', () => {
  it('returns classifications list', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'c1', name: 'Invest', color: '#22c55e', sort_order: 1, created_by_id: 'u1', created_by_name: 'Admin', created_at: new Date(), updated_at: new Date() }]])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classifications).toHaveLength(1)
    expect(body.classifications[0].name).toBe('Invest')
  })
})

describe('POST /api/investment-classifications', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/investment-classifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ color: '#22c55e', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when color is missing', async () => {
    const res = await POST(makeReq({ name: 'Invest', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when userId is missing', async () => {
    const res = await POST(makeReq({ name: 'Invest', color: '#22c55e' }))
    expect(res.status).toBe(401)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Invest', color: '#22c55e', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --testPathPattern="investment-classifications/route"
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement `app/api/investment-classifications/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

function rowToClassification(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:            row.id,
    name:          row.name,
    color:         row.color,
    sortOrder:     row.sort_order ?? null,
    createdById:   row.created_by_id,
    createdByName: row.created_by_name,
    createdAt:     toISO(row.created_at)!,
    updatedAt:     toISO(row.updated_at)!,
  };
}

export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM investment_classifications ORDER BY sort_order ASC, name ASC"
    );
    return NextResponse.json({ classifications: rows.map(rowToClassification) });
  } catch (err) {
    console.error("[GET /api/investment-classifications]", err);
    return NextResponse.json({ error: "Failed to load investment classifications." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, color, sortOrder, userId, userName } = body;

    if (!name?.trim())  return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!color?.trim()) return NextResponse.json({ error: "Color is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const id = randomUUID();

    await db.execute(
      `INSERT INTO investment_classifications (id, name, color, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), color.trim(), sortOrder ?? null, userId, userName]
    );

    await writeAudit({
      tableName: "investment_classifications", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null,
      newValues: { name: name.trim(), color: color.trim(), sortOrder: sortOrder ?? null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/investment-classifications]", err);
    return NextResponse.json({ error: "Failed to create investment classification." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests for route — confirm pass**

```
npm test -- --testPathPattern="investment-classifications/route"
```

Expected: PASS (4 tests)

- [ ] **Step 5: Write failing tests for `[id]` route**

Create `__tests__/unit/api/investment-classifications/id.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/investment-classifications/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: { id: 'c1' } }
const dbRow = { id: 'c1', name: 'Invest', color: '#22c55e', sort_order: 1 }

function makeReq(method: string, body: object) {
  return new NextRequest('http://localhost/api/investment-classifications/c1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/investment-classifications/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'Invest', color: '#22c55e', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 when name missing', async () => {
    const res = await PUT(makeReq('PUT', { color: '#22c55e', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbRow]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq('PUT', { name: 'Invest Updated', color: '#16a34a', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/investment-classifications/[id]', () => {
  it('returns 401 when userId missing', async () => {
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 409 when phases reference this classification', async () => {
    mockExecute.mockResolvedValueOnce([[dbRow]])       // SELECT classification
    mockExecute.mockResolvedValueOnce([[{ id: 'p1' }]]) // SELECT phases
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('in use') })
  })

  it('returns 200 when no phases reference it', async () => {
    mockExecute.mockResolvedValueOnce([[dbRow]]) // SELECT classification
    mockExecute.mockResolvedValueOnce([[]])      // SELECT phases — empty
    mockExecute.mockResolvedValueOnce([{}])      // DELETE
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 6: Run test to confirm it fails**

```
npm test -- --testPathPattern="investment-classifications/id"
```

Expected: FAIL (module not found)

- [ ] **Step 7: Implement `app/api/investment-classifications/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, color, sortOrder, userId, userName } = body;

    if (!name?.trim())  return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!color?.trim()) return NextResponse.json({ error: "Color is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM investment_classifications WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Classification not found." }, { status: 404 });
    const current = rows[0];

    await db.execute(
      "UPDATE investment_classifications SET name = ?, color = ?, sort_order = ? WHERE id = ?",
      [name.trim(), color.trim(), sortOrder ?? null, params.id]
    );

    await writeAudit({
      tableName: "investment_classifications", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, color: current.color, sortOrder: current.sort_order },
      newValues: { name: name.trim(), color: color.trim(), sortOrder: sortOrder ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/investment-classifications/[id]]", err);
    return NextResponse.json({ error: "Failed to update investment classification." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { userId, userName } = body as { userId?: string; userName?: string };
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM investment_classifications WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Classification not found." }, { status: 404 });
    const current = rows[0];

    const [phases] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM asset_roadmap_phases WHERE classification_id = ? LIMIT 1", [params.id]
    );
    if (phases.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete: this classification is in use by one or more roadmap phases." },
        { status: 409 }
      );
    }

    await db.execute("DELETE FROM investment_classifications WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "investment_classifications", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, color: current.color },
      newValues: null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/investment-classifications/[id]]", err);
    return NextResponse.json({ error: "Failed to delete investment classification." }, { status: 500 });
  }
}
```

- [ ] **Step 8: Run all investment-classifications tests**

```
npm test -- --testPathPattern="investment-classifications"
```

Expected: PASS (8 tests total)

- [ ] **Step 9: Run full unit suite to check no regressions**

```
npm test
```

Expected: all tests pass (previous count + 8 new tests)

- [ ] **Step 10: Commit**

```
git add app/api/investment-classifications/ __tests__/unit/api/investment-classifications/
git commit -m "feat: add investment classifications API (GET, POST, PUT, DELETE) with unit tests"
```

---

### Task 3: Roadmap Phases API

**Files:**
- Create: `app/api/roadmap/phases/route.ts`
- Create: `app/api/roadmap/phases/[id]/route.ts`
- Create: `__tests__/unit/api/roadmap/phases-route.test.ts`
- Create: `__tests__/unit/api/roadmap/phases-id.test.ts`

**Interfaces:**
- Consumes: `RoadmapDomainGroup`, `RoadmapAsset`, `AssetRoadmapPhase` from `@/types`
- Produces:
  - `GET /api/roadmap/phases?from=YYYY-Qn&to=YYYY-Qn` → `{ groups: RoadmapDomainGroup[] }`
  - `POST /api/roadmap/phases` → `{ id }` 201
  - `PUT /api/roadmap/phases/[id]` → `{ ok: true }` 200
  - `DELETE /api/roadmap/phases/[id]` → `{ ok: true }` 200

- [ ] **Step 1: Write failing tests for `route.ts`**

Create `__tests__/unit/api/roadmap/phases-route.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/roadmap/phases/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/roadmap/phases', () => {
  it('returns grouped structure', async () => {
    mockExecute.mockResolvedValueOnce([[
      {
        domain_id: 'd1', domain_name: 'CRM', asset_id: 'a1', asset_name: 'Salesforce',
        phase_id: 'p1', classification_id: 'c1', classification_name: 'Invest',
        classification_color: '#22c55e', start_quarter: '2026-Q3', end_quarter: '2027-Q2',
        notes: null, created_by_id: 'u1', created_by_name: 'Admin',
        phase_created_at: new Date(), phase_updated_at: new Date(),
      },
    ]])
    const req = new NextRequest('http://localhost/api/roadmap/phases?from=2026-Q1&to=2028-Q4')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groups).toHaveLength(1)
    expect(body.groups[0].domainName).toBe('CRM')
    expect(body.groups[0].assets[0].phases).toHaveLength(1)
  })

  it('includes assets with no phases', async () => {
    mockExecute.mockResolvedValueOnce([[
      {
        domain_id: 'd1', domain_name: 'CRM', asset_id: 'a1', asset_name: 'Salesforce',
        phase_id: null, classification_id: null, classification_name: null,
        classification_color: null, start_quarter: null, end_quarter: null,
        notes: null, created_by_id: null, created_by_name: null,
        phase_created_at: null, phase_updated_at: null,
      },
    ]])
    const req = new NextRequest('http://localhost/api/roadmap/phases?from=2026-Q1&to=2028-Q4')
    const res = await GET(req)
    const body = await res.json()
    expect(body.groups[0].assets[0].phases).toHaveLength(0)
  })
})

describe('POST /api/roadmap/phases', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/roadmap/phases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const validBody = {
    assetId: 'a1', classificationId: 'c1',
    startQuarter: '2026-Q3', endQuarter: '2027-Q2',
    userId: 'u1', userName: 'Admin',
  }

  it('returns 400 when assetId missing', async () => {
    const res = await POST(makeReq({ ...validBody, assetId: undefined }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when quarter format invalid', async () => {
    const res = await POST(makeReq({ ...validBody, startQuarter: '2026-03' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when end before start', async () => {
    const res = await POST(makeReq({ ...validBody, startQuarter: '2027-Q2', endQuarter: '2026-Q3' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when overlap exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'p-existing' }]])
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(409)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([[]])  // overlap check — none
    mockExecute.mockResolvedValueOnce([{}]) // INSERT
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --testPathPattern="roadmap/phases-route"
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement `app/api/roadmap/phases/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { RoadmapDomainGroup, RoadmapAsset, AssetRoadmapPhase } from "@/types";

function isValidQuarter(q: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(q);
}

// GET /api/roadmap/phases?from=YYYY-Qn&to=YYYY-Qn
export async function GET(req: NextRequest) {
  try {
    await setupDatabase();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "2026-Q1";
    const to   = searchParams.get("to")   ?? "2028-Q4";

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT
         d.id            AS domain_id,
         d.name          AS domain_name,
         a.id            AS asset_id,
         a.name          AS asset_name,
         p.id            AS phase_id,
         p.classification_id,
         ic.name         AS classification_name,
         ic.color        AS classification_color,
         p.start_quarter,
         p.end_quarter,
         p.notes,
         p.created_by_id,
         p.created_by_name,
         p.created_at    AS phase_created_at,
         p.updated_at    AS phase_updated_at
       FROM assets a
       LEFT JOIN domains d ON a.domain_id = d.id
       LEFT JOIN asset_roadmap_phases p
         ON p.asset_id = a.id
         AND p.start_quarter <= ? AND p.end_quarter >= ?
       LEFT JOIN investment_classifications ic ON p.classification_id = ic.id
       ORDER BY d.name ASC, a.name ASC, p.start_quarter ASC`,
      [to, from]
    );

    const groupMap = new Map<string, RoadmapDomainGroup>();
    const assetMap = new Map<string, RoadmapAsset>();

    const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;

    for (const row of rows) {
      const domainId   = row.domain_id   ?? "no-domain";
      const domainName = row.domain_name ?? "No Domain";

      if (!groupMap.has(domainId)) {
        groupMap.set(domainId, { domainId, domainName, assets: [] });
      }
      const group = groupMap.get(domainId)!;

      if (!assetMap.has(row.asset_id)) {
        const asset: RoadmapAsset = { id: row.asset_id, name: row.asset_name, phases: [] };
        assetMap.set(row.asset_id, asset);
        group.assets.push(asset);
      }

      if (row.phase_id) {
        const phase: AssetRoadmapPhase = {
          id:                  row.phase_id,
          assetId:             row.asset_id,
          classificationId:    row.classification_id,
          classificationName:  row.classification_name,
          classificationColor: row.classification_color,
          startQuarter:        row.start_quarter,
          endQuarter:          row.end_quarter,
          notes:               row.notes ?? null,
          createdById:         row.created_by_id,
          createdByName:       row.created_by_name,
          createdAt:           toISO(row.phase_created_at)!,
          updatedAt:           toISO(row.phase_updated_at)!,
        };
        assetMap.get(row.asset_id)!.phases.push(phase);
      }
    }

    return NextResponse.json({ groups: Array.from(groupMap.values()) });
  } catch (err) {
    console.error("[GET /api/roadmap/phases]", err);
    return NextResponse.json({ error: "Failed to load roadmap phases." }, { status: 500 });
  }
}

// POST /api/roadmap/phases
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { assetId, classificationId, startQuarter, endQuarter, notes, userId, userName } = body;

    if (!assetId)          return NextResponse.json({ error: "assetId is required." }, { status: 400 });
    if (!classificationId) return NextResponse.json({ error: "classificationId is required." }, { status: 400 });
    if (!startQuarter || !isValidQuarter(startQuarter))
      return NextResponse.json({ error: "startQuarter must be in YYYY-Qn format." }, { status: 400 });
    if (!endQuarter || !isValidQuarter(endQuarter))
      return NextResponse.json({ error: "endQuarter must be in YYYY-Qn format." }, { status: 400 });
    if (endQuarter < startQuarter)
      return NextResponse.json({ error: "endQuarter must be >= startQuarter." }, { status: 400 });
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();

    // Overlap check
    const [overlapping] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM asset_roadmap_phases
       WHERE asset_id = ? AND start_quarter <= ? AND end_quarter >= ?
       LIMIT 1`,
      [assetId, endQuarter, startQuarter]
    );
    if (overlapping.length > 0) {
      return NextResponse.json(
        { error: "A phase for this asset overlaps the specified quarter range." },
        { status: 409 }
      );
    }

    const id = randomUUID();
    await db.execute(
      `INSERT INTO asset_roadmap_phases
         (id, asset_id, classification_id, start_quarter, end_quarter, notes, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, assetId, classificationId, startQuarter, endQuarter, notes?.trim() || null, userId, userName]
    );

    await writeAudit({
      tableName: "asset_roadmap_phases", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null,
      newValues: { assetId, classificationId, startQuarter, endQuarter, notes: notes?.trim() || null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/roadmap/phases]", err);
    return NextResponse.json({ error: "Failed to create roadmap phase." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test -- --testPathPattern="roadmap/phases-route"
```

Expected: PASS (7 tests)

- [ ] **Step 5: Write failing tests for `[id]` route**

Create `__tests__/unit/api/roadmap/phases-id.test.ts`:

```typescript
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/roadmap/phases/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: { id: 'p1' } }
const dbPhase = {
  id: 'p1', asset_id: 'a1', classification_id: 'c1',
  start_quarter: '2026-Q3', end_quarter: '2027-Q2', notes: null,
}

function makeReq(method: string, body: object) {
  return new NextRequest('http://localhost/api/roadmap/phases/p1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validPutBody = {
  classificationId: 'c1', startQuarter: '2026-Q3', endQuarter: '2027-Q2',
  userId: 'u1', userName: 'Admin',
}

describe('PUT /api/roadmap/phases/[id]', () => {
  it('returns 404 when phase not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', validPutBody), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 when quarter format invalid', async () => {
    const res = await PUT(makeReq('PUT', { ...validPutBody, startQuarter: '2026-03' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 409 when update would cause overlap', async () => {
    mockExecute.mockResolvedValueOnce([[dbPhase]])           // SELECT current phase
    mockExecute.mockResolvedValueOnce([[{ id: 'p-other' }]]) // overlap check
    const res = await PUT(makeReq('PUT', { ...validPutBody, startQuarter: '2025-Q1', endQuarter: '2027-Q4' }), params)
    expect(res.status).toBe(409)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbPhase]]) // SELECT current
    mockExecute.mockResolvedValueOnce([[]])        // overlap check — none
    mockExecute.mockResolvedValueOnce([{}])        // UPDATE
    const res = await PUT(makeReq('PUT', validPutBody), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/roadmap/phases/[id]', () => {
  it('returns 401 when userId missing', async () => {
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbPhase]]) // SELECT
    mockExecute.mockResolvedValueOnce([{}])        // DELETE
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 6: Run test to confirm it fails**

```
npm test -- --testPathPattern="roadmap/phases-id"
```

Expected: FAIL (module not found)

- [ ] **Step 7: Implement `app/api/roadmap/phases/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

function isValidQuarter(q: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(q);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { classificationId, startQuarter, endQuarter, notes, userId, userName } = body;

    if (!classificationId)
      return NextResponse.json({ error: "classificationId is required." }, { status: 400 });
    if (!startQuarter || !isValidQuarter(startQuarter))
      return NextResponse.json({ error: "startQuarter must be in YYYY-Qn format." }, { status: 400 });
    if (!endQuarter || !isValidQuarter(endQuarter))
      return NextResponse.json({ error: "endQuarter must be in YYYY-Qn format." }, { status: 400 });
    if (endQuarter < startQuarter)
      return NextResponse.json({ error: "endQuarter must be >= startQuarter." }, { status: 400 });
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_roadmap_phases WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Phase not found." }, { status: 404 });
    const current = rows[0];

    // Overlap check — exclude self
    const [overlapping] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM asset_roadmap_phases
       WHERE asset_id = ? AND id != ? AND start_quarter <= ? AND end_quarter >= ?
       LIMIT 1`,
      [current.asset_id, params.id, endQuarter, startQuarter]
    );
    if (overlapping.length > 0) {
      return NextResponse.json(
        { error: "A phase for this asset overlaps the specified quarter range." },
        { status: 409 }
      );
    }

    await db.execute(
      `UPDATE asset_roadmap_phases
         SET classification_id = ?, start_quarter = ?, end_quarter = ?, notes = ?
       WHERE id = ?`,
      [classificationId, startQuarter, endQuarter, notes?.trim() || null, params.id]
    );

    await writeAudit({
      tableName: "asset_roadmap_phases", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: {
        classificationId: current.classification_id,
        startQuarter: current.start_quarter,
        endQuarter: current.end_quarter,
        notes: current.notes,
      },
      newValues: { classificationId, startQuarter, endQuarter, notes: notes?.trim() || null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/roadmap/phases/[id]]", err);
    return NextResponse.json({ error: "Failed to update roadmap phase." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { userId, userName } = body as { userId?: string; userName?: string };
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_roadmap_phases WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Phase not found." }, { status: 404 });
    const current = rows[0];

    await db.execute("DELETE FROM asset_roadmap_phases WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "asset_roadmap_phases", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: {
        assetId: current.asset_id,
        classificationId: current.classification_id,
        startQuarter: current.start_quarter,
        endQuarter: current.end_quarter,
      },
      newValues: null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/roadmap/phases/[id]]", err);
    return NextResponse.json({ error: "Failed to delete roadmap phase." }, { status: 500 });
  }
}
```

- [ ] **Step 8: Run all roadmap tests**

```
npm test -- --testPathPattern="roadmap"
```

Expected: PASS (14 tests total)

- [ ] **Step 9: Run full unit suite**

```
npm test
```

Expected: all tests pass

- [ ] **Step 10: Commit**

```
git add app/api/roadmap/ __tests__/unit/api/roadmap/
git commit -m "feat: add roadmap phases API (GET, POST, PUT, DELETE) with unit tests"
```

---

### Task 4: Navigation + Settings tile

**Files:**
- Modify: `config/navigation.ts`
- Modify: `app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces: nav route `/roadmap/by-platform` and settings route `/settings/investment-classifications` visible in the UI

- [ ] **Step 1: Add Roadmap nav group to `config/navigation.ts`**

In `config/navigation.ts`, after the closing `},` of the `Reports` group (around line 68) and before the `Manage` group, insert:

```typescript
  {
    title: "Roadmap",
    items: [
      {
        label: "Roadmap by Platform",
        href: "/roadmap/by-platform",
        icon: "GanttChart",
      },
    ],
  },
```

The full file after the edit (verify `Reports` stays at lines 49–68, new group at 69–78):

```typescript
import { NavGroup } from "@/types";

export const navigationConfig: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    ],
  },
  {
    title: "Assets",
    items: [
      { label: "Asset Registry",    href: "/assets",           icon: "Server" },
      { label: "My Assets",         href: "/assets/my-assets", icon: "UserCheck" },
      { label: "Diagrams",          href: "/diagrams",         icon: "GitBranch" },
      { label: "PlantUML Diagrams", href: "/plantuml",         icon: "FileCode2" },
      { label: "Projects",          href: "/projects",         icon: "FolderKanban" },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Asset Strategy",     href: "/reports/assets-by-domain",     icon: "LayoutGrid" },
      { label: "Capability Coverage",href: "/reports/capabilities-matrix",  icon: "TableProperties" },
      { label: "Complexity vs Cost", href: "/reports/complexity-cost",      icon: "TrendingDown" },
    ],
  },
  {
    title: "Roadmap",
    items: [
      { label: "Roadmap by Platform", href: "/roadmap/by-platform", icon: "GanttChart" },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Users",    href: "/users",    icon: "Users" },
      { label: "Settings", href: "/settings", icon: "Settings" },
      { label: "Audit",    href: "/audit",    icon: "ClipboardList" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "Documentation", href: "/docs",    icon: "BookOpen" },
      { label: "Support",       href: "/support", icon: "LifeBuoy" },
    ],
  },
];
```

- [ ] **Step 2: Add Investment Classifications tile to `app/(dashboard)/settings/page.tsx`**

In `settings/page.tsx`, add `MapPin` to the import line (line 4) and add a new tile in the Configuration section grid.

Change the import line from:
```typescript
import { Settings, Bell, Lock, Globe, ShieldCheck, MessageSquare, ChevronRight, Layers, GitBranch, Gauge, Building2, Network, Target, Package2, BarChart2, ScrollText } from "lucide-react";
```
to:
```typescript
import { Settings, Bell, Lock, Globe, ShieldCheck, MessageSquare, ChevronRight, Layers, GitBranch, Gauge, Building2, Network, Target, Package2, BarChart2, ScrollText, MapPin } from "lucide-react";
```

Then, inside the Configuration section grid (after the `Changelog` tile and before the `Industry Sectors` tile), add:

```tsx
        <SettingsTile
          href="/settings/investment-classifications"
          icon={MapPin}
          iconBg="bg-rose-500"
          title="Investment Classifications"
          description="Configure roadmap investment labels and their colours."
        />
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```

Expected: no errors. If `GanttChart` is not a recognised Lucide icon name, the Sidebar resolves icons dynamically — the nav config only stores the string name. The icon name `"GanttChart"` must exist in the installed version of lucide-react. Verify it exists:

```
node -e "const icons = require('lucide-react'); console.log('GanttChart' in icons);"
```

If the output is `false`, use `"CalendarRange"` as the icon name instead and update Step 1 accordingly.

- [ ] **Step 4: Commit**

```
git add config/navigation.ts app/(dashboard)/settings/page.tsx
git commit -m "feat: add Roadmap nav group and Investment Classifications settings tile"
```

---

### Task 5: Investment Classifications Settings Page

**Files:**
- Create: `app/(dashboard)/settings/investment-classifications/page.tsx`

**Interfaces:**
- Consumes: `GET /api/investment-classifications` → `{ classifications: InvestmentClassification[] }`, POST/PUT/DELETE per Task 2
- Consumes: `InvestmentClassification` type from `@/types`
- Produces: fully working CRUD settings page at `/settings/investment-classifications`

- [ ] **Step 1: Create the page**

Create `app/(dashboard)/settings/investment-classifications/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { InvestmentClassification } from "@/types";

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------
interface ClassificationForm {
  name: string;
  color: string;
  sortOrder: string;
}

const EMPTY_FORM: ClassificationForm = { name: "", color: "#6366f1", sortOrder: "" };

function rowToForm(c: InvestmentClassification): ClassificationForm {
  return {
    name:      c.name,
    color:     c.color,
    sortOrder: c.sortOrder !== null ? String(c.sortOrder) : "",
  };
}

// ---------------------------------------------------------------------------
// Edit/Add modal
// ---------------------------------------------------------------------------
function ClassificationModal({
  isOpen, onClose, editing, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: InvestmentClassification | null;
  onSave: (form: ClassificationForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ClassificationForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ClassificationForm, string>>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? rowToForm(editing) : EMPTY_FORM);
      setErrors({}); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof ClassificationForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<keyof ClassificationForm, string>> = {};
    if (!form.name.trim()) newErrors.name = "Name is required.";
    if (!form.color.trim()) newErrors.color = "Color is required.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit — ${editing.name}` : "Add Classification"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            type="text"
            placeholder="e.g. Invest"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            autoFocus
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Colour
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                className="h-9 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{form.color}</span>
            </div>
            {errors.color && <p className="text-xs text-red-500">{errors.color}</p>}
          </div>
          <Input
            label="Sort Order (optional)"
            type="number"
            placeholder="e.g. 1"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>{editing ? "Save changes" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function InvestmentClassificationsPage() {
  const { user } = useAuth();
  const [classifications, setClassifications] = useState<InvestmentClassification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentClassification | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<InvestmentClassification | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/investment-classifications");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load classifications.");
      setClassifications(data.classifications);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(form: ClassificationForm) {
    if (!user) return;
    const url    = editing ? `/api/investment-classifications/${editing.id}` : "/api/investment-classifications";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        color: form.color,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : null,
        userId: user.id,
        userName: user.name,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchData();
    setModalOpen(false); setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/investment-classifications/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userName: user.name }),
      });
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
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Investment Classifications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure the investment labels and colours used on the roadmap.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Classification
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
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
        ) : classifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <MapPin className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">No classifications yet</p>
            <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Classification
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Colour</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Sort</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {classifications.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <div
                        className="h-6 w-6 rounded-md flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                        title={c.color}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{c.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {c.sortOrder ?? "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditing(c); setModalOpen(true); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                          aria-label={`Edit ${c.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(c); setDeleteError(null); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && !fetchError && classifications.length > 0 && (
        <p className="text-xs text-slate-400">
          {classifications.length} classification{classifications.length !== 1 ? "s" : ""}
        </p>
      )}

      <ClassificationModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Classification" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                This will fail if it is used by any roadmap phases.
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

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add "app/(dashboard)/settings/investment-classifications/"
git commit -m "feat: add Investment Classifications settings page"
```

---

### Task 6: Roadmap by Platform page

**Files:**
- Create: `app/(dashboard)/roadmap/by-platform/page.tsx`

**Interfaces:**
- Consumes: `GET /api/roadmap/phases?from=YYYY-Qn&to=YYYY-Qn` → `{ groups: RoadmapDomainGroup[] }`
- Consumes: `GET /api/domains` → `{ domains: Domain[] }`
- Consumes: `GET /api/investment-classifications` → `{ classifications: InvestmentClassification[] }`
- Consumes: `POST /api/roadmap/phases`, `PUT /api/roadmap/phases/[id]`, `DELETE /api/roadmap/phases/[id]`
- Consumes: `RoadmapDomainGroup`, `RoadmapAsset`, `AssetRoadmapPhase`, `InvestmentClassification`, `Domain` from `@/types`

- [ ] **Step 1: Create the page**

Create `app/(dashboard)/roadmap/by-platform/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  RoadmapDomainGroup, RoadmapAsset, AssetRoadmapPhase,
  InvestmentClassification, Domain,
} from "@/types";

// ---------------------------------------------------------------------------
// Quarter utilities
// ---------------------------------------------------------------------------
function generateQuarters(from: string, to: string): string[] {
  const quarters: string[] = [];
  let [year, q] = from.split("-Q").map(Number);
  const [toYear, toQ] = to.split("-Q").map(Number);
  while (year < toYear || (year === toYear && q <= toQ)) {
    quarters.push(`${year}-Q${q}`);
    q++;
    if (q > 4) { q = 1; year++; }
  }
  return quarters;
}

const ALL_QUARTER_OPTIONS = generateQuarters("2024-Q1", "2030-Q4");

function currentQuarter(): string {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
}

function addQuarters(quarter: string, n: number): string {
  let [year, q] = quarter.split("-Q").map(Number);
  q += n;
  year += Math.floor((q - 1) / 4);
  q = ((q - 1) % 4) + 1;
  return `${year}-Q${q}`;
}

function formatQuarter(q: string): string {
  const [year, qPart] = q.split("-");
  return `${qPart} ${year}`;
}

function phasePosition(
  phase: AssetRoadmapPhase,
  quarters: string[]
): { left: string; width: string } | null {
  const n = quarters.length;
  if (n === 0) return null;
  const from = quarters[0];
  const to   = quarters[n - 1];
  if (phase.endQuarter < from || phase.startQuarter > to) return null;
  const clampedStart = phase.startQuarter < from ? from : phase.startQuarter;
  const clampedEnd   = phase.endQuarter   > to   ? to   : phase.endQuarter;
  const startIdx = quarters.indexOf(clampedStart);
  const endIdx   = quarters.indexOf(clampedEnd);
  if (startIdx === -1 || endIdx === -1) return null;
  const left  = `${(startIdx / n) * 100}%`;
  const width = `${((endIdx - startIdx + 1) / n) * 100}%`;
  return { left, width };
}

// ---------------------------------------------------------------------------
// Domain filter (multi-select dropdown)
// ---------------------------------------------------------------------------
function DomainFilter({
  domains, selected, onChange,
}: {
  domains: Domain[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const label = selected.length === 0 ? "All Domains" : `${selected.length} domain${selected.length !== 1 ? "s" : ""}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand-400 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <span>Domains: {label}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="max-h-64 overflow-y-auto p-2">
            {domains.length === 0 && (
              <p className="px-2 py-1 text-sm text-slate-400">No domains configured.</p>
            )}
            {domains.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...selected, d.id]);
                    else onChange(selected.filter((id) => id !== d.id));
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                />
                <span className="text-slate-700 dark:text-slate-300">{d.name}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button
                onClick={() => onChange([])}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase modal (add + edit)
// ---------------------------------------------------------------------------
interface PhaseForm {
  classificationId: string;
  startQuarter: string;
  endQuarter: string;
  notes: string;
}

function PhaseModal({
  isOpen, onClose, asset, phase, classifications, fromQuarter, onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  asset: RoadmapAsset | null;
  phase: AssetRoadmapPhase | null;
  classifications: InvestmentClassification[];
  fromQuarter: string;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const isEdit = phase !== null;

  const defaultForm: PhaseForm = {
    classificationId: classifications[0]?.id ?? "",
    startQuarter:     fromQuarter,
    endQuarter:       addQuarters(fromQuarter, 3),
    notes:            "",
  };

  const [form, setForm] = useState<PhaseForm>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof PhaseForm, string>>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGeneralError(""); setErrors({});
      if (phase) {
        setForm({
          classificationId: phase.classificationId,
          startQuarter:     phase.startQuarter,
          endQuarter:       phase.endQuarter,
          notes:            phase.notes ?? "",
        });
      } else {
        setForm({ ...defaultForm, classificationId: classifications[0]?.id ?? "" });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phase]);

  function set<K extends keyof PhaseForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<keyof PhaseForm, string>> = {};
    if (!form.classificationId) newErrors.classificationId = "Classification is required.";
    if (!form.startQuarter)     newErrors.startQuarter = "Start quarter is required.";
    if (!form.endQuarter)       newErrors.endQuarter = "End quarter is required.";
    if (form.endQuarter && form.startQuarter && form.endQuarter < form.startQuarter)
      newErrors.endQuarter = "End quarter must be after start quarter.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    if (!user) return;

    setGeneralError(""); setIsSaving(true);
    try {
      const url    = isEdit ? `/api/roadmap/phases/${phase!.id}` : "/api/roadmap/phases";
      const method = isEdit ? "PUT" : "POST";
      const body   = isEdit
        ? { classificationId: form.classificationId, startQuarter: form.startQuarter, endQuarter: form.endQuarter, notes: form.notes, userId: user.id, userName: user.name }
        : { assetId: asset!.id, classificationId: form.classificationId, startQuarter: form.startQuarter, endQuarter: form.endQuarter, notes: form.notes, userId: user.id, userName: user.name };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      onSaved();
      onClose();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsSaving(false); }
  }

  async function handleDelete() {
    if (!phase || !user) return;
    setIsDeleting(true); setGeneralError("");
    try {
      const res = await fetch(`/api/roadmap/phases/${phase.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userName: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      onSaved();
      onClose();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsDeleting(false); }
  }

  const selectCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit phase — ${asset?.name ?? ""}` : `Add phase — ${asset?.name ?? ""}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Classification</label>
            <select value={form.classificationId} onChange={(e) => set("classificationId", e.target.value)} className={selectCls}>
              {classifications.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.classificationId && <p className="text-xs text-red-500">{errors.classificationId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Start quarter</label>
              <select value={form.startQuarter} onChange={(e) => set("startQuarter", e.target.value)} className={selectCls}>
                {ALL_QUARTER_OPTIONS.map((q) => (
                  <option key={q} value={q}>{formatQuarter(q)}</option>
                ))}
              </select>
              {errors.startQuarter && <p className="text-xs text-red-500">{errors.startQuarter}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">End quarter</label>
              <select value={form.endQuarter} onChange={(e) => set("endQuarter", e.target.value)} className={selectCls}>
                {ALL_QUARTER_OPTIONS.map((q) => (
                  <option key={q} value={q}>{formatQuarter(q)}</option>
                ))}
              </select>
              {errors.endQuarter && <p className="text-xs text-red-500">{errors.endQuarter}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          {isEdit ? (
            <Button type="button" variant="danger" isLoading={isDeleting} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : <div />}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{isEdit ? "Save changes" : "Add phase"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Roadmap chart
// ---------------------------------------------------------------------------
function RoadmapChart({
  groups, quarters, onAddPhase, onEditPhase,
}: {
  groups: RoadmapDomainGroup[];
  quarters: string[];
  onAddPhase: (asset: RoadmapAsset) => void;
  onEditPhase: (asset: RoadmapAsset, phase: AssetRoadmapPhase) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleDomain(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const n = quarters.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div style={{ minWidth: `${200 + n * 80}px` }}>
        {/* Quarter header */}
        <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="w-48 flex-shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400" />
          <div
            className="flex-1 grid"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(80px, 1fr))` }}
          >
            {quarters.map((q) => (
              <div
                key={q}
                className="border-l border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"
              >
                {formatQuarter(q)}
              </div>
            ))}
          </div>
        </div>

        {/* Domain groups */}
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.domainId);
          return (
            <div key={group.domainId}>
              {/* Domain header */}
              <button
                onClick={() => toggleDomain(group.domainId)}
                className="flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {isCollapsed
                  ? <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                }
                {group.domainName}
                <span className="ml-1 font-normal text-slate-400">
                  ({group.assets.length})
                </span>
              </button>

              {/* Asset rows */}
              {!isCollapsed && group.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex border-b border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/20"
                >
                  {/* Asset name */}
                  <div className="w-48 flex-shrink-0 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 truncate" title={asset.name}>
                    {asset.name}
                  </div>

                  {/* Phase lane */}
                  <div
                    className="relative flex-1 cursor-pointer"
                    style={{ height: "40px" }}
                    onClick={() => onAddPhase(asset)}
                  >
                    {/* Quarter column guides */}
                    <div
                      className="pointer-events-none absolute inset-0 grid"
                      style={{ gridTemplateColumns: `repeat(${n}, minmax(80px, 1fr))` }}
                    >
                      {quarters.map((q) => (
                        <div key={q} className="border-l border-slate-100 dark:border-slate-800" />
                      ))}
                    </div>

                    {/* Empty state hint */}
                    {asset.phases.length === 0 && (
                      <div className="pointer-events-none absolute inset-1 rounded-md border-2 border-dashed border-slate-200 flex items-center px-3 dark:border-slate-700">
                        <span className="text-xs text-slate-400">Click to add a phase</span>
                      </div>
                    )}

                    {/* Phase bars */}
                    {asset.phases.map((phase) => {
                      const pos = phasePosition(phase, quarters);
                      if (!pos) return null;
                      return (
                        <div
                          key={phase.id}
                          className="absolute inset-y-1.5 flex cursor-pointer items-center rounded-md px-2 text-xs font-medium text-white shadow-sm overflow-hidden"
                          style={{
                            left: pos.left,
                            width: pos.width,
                            backgroundColor: phase.classificationColor,
                          }}
                          title={`${phase.classificationName}${phase.notes ? `: ${phase.notes}` : ""}`}
                          onClick={(e) => { e.stopPropagation(); onEditPhase(asset, phase); }}
                        >
                          <span className="truncate">{phase.classificationName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-400">
            <p className="text-sm">No assets match the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RoadmapByPlatformPage() {
  const cq = currentQuarter();
  const [from, setFrom] = useState(cq);
  const [to,   setTo]   = useState(addQuarters(cq, 7));

  const [groups,          setGroups]          = useState<RoadmapDomainGroup[]>([]);
  const [domains,         setDomains]         = useState<Domain[]>([]);
  const [classifications, setClassifications] = useState<InvestmentClassification[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [fetchError,      setFetchError]      = useState<string | null>(null);

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false);
  const [activeAsset,  setActiveAsset]  = useState<RoadmapAsset | null>(null);
  const [activePhase,  setActivePhase]  = useState<AssetRoadmapPhase | null>(null);

  const quarters = generateQuarters(from, to);

  const fetchRoadmap = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch(`/api/roadmap/phases?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load roadmap.");
      setGroups(data.groups);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load roadmap.");
    } finally { setIsLoading(false); }
  }, [from, to]);

  useEffect(() => { fetchRoadmap(); }, [fetchRoadmap]);

  useEffect(() => {
    Promise.all([
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/investment-classifications").then((r) => r.json()),
    ]).then(([domainsData, classData]) => {
      setDomains(domainsData.domains ?? []);
      setClassifications(classData.classifications ?? []);
    }).catch(() => { /* non-critical */ });
  }, []);

  function openAddModal(asset: RoadmapAsset) {
    setActiveAsset(asset); setActivePhase(null); setModalOpen(true);
  }

  function openEditModal(asset: RoadmapAsset, phase: AssetRoadmapPhase) {
    setActiveAsset(asset); setActivePhase(phase); setModalOpen(true);
  }

  // Apply domain filter client-side
  const filteredGroups = selectedDomains.length === 0
    ? groups
    : groups.filter((g) => selectedDomains.includes(g.domainId));

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300";

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Roadmap by Platform</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Asset investment phases across quarters. Click a lane to add a phase, click a bar to edit.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <DomainFilter
          domains={domains}
          selected={selectedDomains}
          onChange={setSelectedDomains}
        />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls}>
            {ALL_QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>{formatQuarter(q)}</option>
            ))}
          </select>
          <span>to</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={selectCls}>
            {ALL_QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>{formatQuarter(q)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-red-500">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm">{fetchError}</p>
          <Button variant="secondary" size="sm" onClick={fetchRoadmap}>Retry</Button>
        </div>
      ) : (
        <RoadmapChart
          groups={filteredGroups}
          quarters={quarters}
          onAddPhase={openAddModal}
          onEditPhase={openEditModal}
        />
      )}

      {/* Phase modal */}
      <PhaseModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setActiveAsset(null); setActivePhase(null); }}
        asset={activeAsset}
        phase={activePhase}
        classifications={classifications}
        fromQuarter={from}
        onSaved={fetchRoadmap}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full unit suite (no regressions)**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add "app/(dashboard)/roadmap/"
git commit -m "feat: add Roadmap by Platform page with Gantt chart, domain filter, and phase modal"
```
