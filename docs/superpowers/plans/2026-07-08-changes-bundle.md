# Changes 2026-07-08 Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three features described in `changes_2026-07-08.md` — (A) reuse-an-existing-database on setup instead of always treating it as fresh, (B) CSV bulk asset upload, (C) a new Business Services module — using this codebase's *current* conventions rather than the doc's literal (now-stale) instructions.

**Architecture:** All three features are additive. Feature A extends the existing setup-wizard routes/UI with detection state. Feature B adds one new API route + one new client page, reusing the exact multi-value-junction insert pattern already used by `POST /api/assets`. Feature C adds two new Drizzle-managed tables (`services`, `service_assets`), a full CRUD + composed-read API surface, and list/detail pages with a ReactFlow diagram, mirroring the existing `projects` module end-to-end.

**Tech Stack:** Next.js 14 App Router, TypeScript, mysql2 + Drizzle migrations (MySQL) / node:sqlite (SQLite trial mode), Tailwind, ReactFlow (already a dependency), Jest.

## Global Constraints

- Every new/modified API route must be dialect-agnostic: use `getDb()`/`DbClient`, branch SQL text on `getDbDialect()` only where MySQL/SQLite syntax actually diverges (use `insertIgnoreSql`/`nowSql` from `lib/sql-compat.ts` — do not hand-roll dialect branches for things those helpers already cover).
- Every new/modified API route must call `requireUser(req)` (reads) or `requireUser(req, ["Admin","Member"])` (writes) exactly like existing routes, and return `auth.response` unchanged on failure.
- All schema changes go through `drizzle/schema.ts` **and** `drizzle/schema.sqlite.ts`, generated via `npx drizzle-kit generate` and `npm run db:generate:sqlite` — never hand-written `CREATE TABLE` in `lib/db.ts`.
- No FK constraint builders (`references()`) are used anywhere in this schema — new FK-shaped columns are plain `char(36)` (mysql) / `text` (sqlite), integrity enforced app-side. Follow this, don't introduce `references()`.
- UUIDs are always generated app-side via `randomUUID()` from `crypto` — never DB-side.
- Every mutating route writes to `audit_log` via `writeAudit()` (except nested link/unlink sub-resources, e.g. `project_assets` add/remove, which are precedented as *not* audited — follow that precedent for `service_assets` too).
- New unit tests must follow the exact `jest.mock('@/lib/db', ...)` / `jest.mock('@/lib/audit', ...)` / `jest.mock('@/lib/require-user', ...)` conventions already used in `__tests__/unit/api/projects/*.test.ts`.
- Verify with `npx tsc --noEmit` after each task and `npm test` before considering the bundle done.

---

## Part A — Reuse an existing database on setup

### Task A1: Detect existing installation in `test-db` and `complete` routes

**Files:**
- Modify: `app/api/setup/test-db/route.ts`
- Modify: `app/api/setup/complete/route.ts`
- Test: `__tests__/unit/api/setup/test-db.test.ts` (create if it doesn't already exist — check first)
- Test: `__tests__/unit/api/setup/complete.test.ts` (create if it doesn't already exist — check first)

**Interfaces:**
- Produces: `test-db` route response gains `existingDatabase: boolean` alongside the existing `{ success: true }` shape (mysql branch only — sqlite trial mode has no pre-existing-install concept since the file is created fresh by the wizard, so always report `existingDatabase: false` for sqlite).
- Produces: `complete` route response gains `existingDatabase: boolean`; when `true`, the `admin` fields in the request body become optional and no admin row is created.

- [ ] **Step 1: Add existing-install detection to the mysql branch of `test-db`**

After the existing `CREATE DATABASE IF NOT EXISTS` + connection-close block in the mysql branch of `app/api/setup/test-db/route.ts`, reopen a connection scoped to the target database and check for a populated `users` table:

```ts
// after: await bootstrap.end();  (existing code, unchanged)

let existingDatabase = false;
const scoped = await mysql.createConnection({
  host: body.host, port: Number(body.port ?? 3306),
  user: body.user, password: body.password ?? "",
  database: body.name, connectTimeout: 8000,
});
try {
  const [tables] = await scoped.execute<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
    [body.name]
  );
  if (Number(tables[0].count) > 0) {
    const [rows] = await scoped.execute<mysql.RowDataPacket[]>("SELECT COUNT(*) AS count FROM users");
    existingDatabase = Number(rows[0].count) > 0;
  }
} finally {
  await scoped.end();
}

return NextResponse.json({ success: true, existingDatabase });
```

For the sqlite branch, change the final success return to `NextResponse.json({ success: true, existingDatabase: false })` (no detection needed — a fresh file is always created by the wizard flow at this step).

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors in `app/api/setup/test-db/route.ts`.

- [ ] **Step 3: Add existing-install detection + conditional admin requirement to `complete`**

In `app/api/setup/complete/route.ts`, the current validation block unconditionally requires `admin.name`/`admin.email`/`admin.password`. Change this to defer the admin requirement until after `setupDatabase()` runs and we know whether `users` already has rows:

```ts
// Remove the up-front admin-fields-required check from the initial validation block.
// ... existing validation for db.dialect / appName / orgName stays as-is ...
```

Then, after the existing `await setupDatabase();` call (inside the dynamically-imported `@/lib/db` block), before the bcrypt-hash-and-insert step:

```ts
const [existingRows] = await db.execute<mysql.RowDataPacket[]>("SELECT COUNT(*) AS count FROM users");
const existingDatabase = getDbDialectValue === "sqlite"
  ? Number(existingRows[0].count) > 0   // sqlite path — same query works via DbClient
  : Number(existingRows[0].count) > 0;
```

(Use whatever local variable name the route already uses for the resolved `db`/dialect — there is no dialect-specific SQL difference for a plain `COUNT(*)`, so a single query works for both.)

If `existingDatabase` is `true`: skip admin validation and the bcrypt/insert step entirely, go straight to writing `site.config.json` with `setupComplete: true`.

If `existingDatabase` is `false`: require `admin.name`/`admin.email`/`admin.password` here (the same 400-with-rollback behavior that used to run up-front — move that exact block here), then hash + insert as before.

Add `existingDatabase` to the final success JSON response: `NextResponse.json({ success: true, existingDatabase })`.

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors in `app/api/setup/complete/route.ts`.

- [ ] **Step 5: Write/extend unit tests**

Check whether `__tests__/unit/api/setup/` already has test files for these two routes. If yes, add cases to them; if no, create them following the `jest.mock('@/lib/db', ...)` pattern from `__tests__/unit/api/projects/route.test.ts`, mocking `mysql2/promise`'s `createConnection` to return a fake connection whose `execute()` resolves `[{ count: 1 }]` (existing DB) or `[{ count: 0 }]` (fresh DB) for the two respective test cases. Assert:
- `test-db` POST (mysql) with a users-table count of 1 row → response body `existingDatabase: true`.
- `test-db` POST (mysql) with no `users` table → response body `existingDatabase: false`.
- `complete` POST with existing users and no `admin` field in the body → `200`, no insert into `users`, `existingDatabase: true` in response.
- `complete` POST with a fresh DB and no `admin` field → `400`.

- [ ] **Step 6: Run tests**

Run: `npm test -- setup`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/setup/test-db/route.ts app/api/setup/complete/route.ts __tests__/unit/api/setup
git commit -m "feat: detect and reuse an existing installation during setup"
```

### Task A2: Wizard UI — skip Admin step and show existing-DB notice

**Files:**
- Modify: `app/(setup)/setup/page.tsx`

**Interfaces:**
- Consumes: `existingDatabase` field from `POST /api/setup/test-db` and `POST /api/setup/complete` responses (Task A1).
- Produces: `existingDb: boolean` piece of wizard state, read by step-navigation logic and by `StepReview`'s submit handler.

- [ ] **Step 1: Add `existingDb` state and wire it to `StepDatabase`'s test-connection handler**

In the top-level `SetupPage` component, add `const [existingDb, setExistingDb] = useState(false);`. In the `handleTest` function (or wherever `POST /api/setup/test-db` is called), read `existingDatabase` from the response JSON and call `setExistingDb(Boolean(data.existingDatabase))`. Reset it to `false` whenever any connection field changes (find the existing `onChange` handlers for the dialect/host/user/password/name/file fields and add `setExistingDb(false)` alongside the existing `setTestState("idle")` reset, if such a reset already exists — mirror that pattern).

- [ ] **Step 2: Render an info banner in `StepDatabase` after a successful test when `existingDb` is true**

```tsx
{testState === "ok" && existingDb && (
  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
    Existing database detected — your data will be preserved and the Admin Account step will be skipped. Sign in with your existing credentials after setup completes.
  </div>
)}
```

- [ ] **Step 3: Make the step sequence dynamic**

Locate the `StepIndicator` component and the array/definition of step labels (`["Database", "Application", "Admin Account", "Review"]` or similar). Change it to a computed value:

```ts
const steps = existingDb
  ? ["Database", "Application", "Review"]
  : ["Database", "Application", "Admin Account", "Review"];
```

Pass `steps` into `StepIndicator` so it renders `1..steps.length` positionally instead of a hardcoded 4.

- [ ] **Step 4: Skip the Admin step in Next/Back navigation**

Wherever `setStep(step + 1)` / `setStep(step - 1)` (or equivalent) is called from `StepApplication`'s "Next" and `StepReview`'s "Back", branch on `existingDb`:

```ts
// From StepApplication "Next"
setStep(existingDb ? 4 /* Review */ : 3 /* Admin */);

// From StepReview "Back"
setStep(existingDb ? 2 /* Application */ : 3 /* Admin */);
```

Adjust the literal step numbers to match whatever the file's actual `Step` union/type currently is (read the file's current step-number scheme before editing — do not assume 1–4 if the real type differs).

- [ ] **Step 5: `StepReview` — hide admin summary, omit `admin` from the completion payload**

In `StepReview`, wrap the existing "Admin Account" summary block in `{!existingDb && (...)}"` and add an else-branch info notice:

```tsx
{existingDb && (
  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
    Using existing database credentials — no new admin account will be created.
  </div>
)}
```

In the submit handler that builds the `POST /api/setup/complete` request body, omit the `admin` key entirely when `existingDb` is true:

```ts
const payload = {
  db: dbConfig, appName, orgName,
  ...(existingDb ? {} : { admin }),
};
```

- [ ] **Step 6: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors in `app/(setup)/setup/page.tsx`.

- [ ] **Step 7: Manual verification**

Start the dev server (`npm run dev`), run through the wizard against a MySQL database that already has a `users` row, and confirm: the banner appears after Test Connection, the Admin step is skipped both forward and backward, Review shows the existing-DB notice, and Complete Setup succeeds without creating a new user. Then repeat against a brand-new empty database and confirm the original 4-step flow with admin creation still works unchanged.

- [ ] **Step 8: Commit**

```bash
git add "app/(setup)/setup/page.tsx"
git commit -m "feat: skip admin step and show notice when setup detects an existing database"
```

---

## Part B — Bulk upload assets from CSV

Extends the doc's column list per user decision: also support `architects`, `capabilities`, `complexity`, and `heroDiagram` as additional optional columns, matching every field the existing `POST /api/assets` route accepts.

### Task B1: `POST /api/assets/bulk` route

**Files:**
- Create: `app/api/assets/bulk/route.ts`
- Test: `__tests__/unit/api/assets/bulk.test.ts`

**Interfaces:**
- Consumes: `insertIgnoreSql`, `nowSql` from `@/lib/sql-compat`; `getDb`, `getDbDialect`, `setupDatabase`, `withTransaction` from `@/lib/db`; `writeAudit` from `@/lib/audit`; `requireUser` from `@/lib/require-user`; `VALID_TYPES`/`VALID_STATUSES` — either import from `app/api/assets/route.ts` if exported, or re-declare identically (check first whether they're exported; if not, export them from that file rather than duplicating the literal arrays).
- Produces: `POST /api/assets/bulk` accepting `{ rows: Record<string,string>[], userId: string, userName: string }` (userId/userName are redundant with `requireUser`'s `auth.user` — use `auth.user.id`/`auth.user.name` server-side instead of trusting client-supplied values; the doc's mention of `userId`/`userName` in the body predates auth middleware, so this deviates deliberately per the earlier decision to require auth). Returns `{ summary: { total, created, failed, departmentsCreated: number }, results: Array<{ row: number, status: "created"|"failed", assetId?: string, warnings: string[], error?: string }> }`.

- [ ] **Step 1: Column normalization + lookup preload**

```ts
function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const REQUIRED_COLUMNS = ["name", "department"];
const KNOWN_COLUMNS = new Set([
  "name", "department", "short_code", "description", "type", "category",
  "lifecycle_status", "business_owner", "technical_owner", "domain", "vendor",
  "tier", "strategy", "notes", "app_url", "architects", "capabilities",
  "complexity", "hero_diagram",
]);
```

Preload every lookup table into a `Map<string /* lowercased name */, string /* id */>` up front (one query per table, outside the per-row loop): `domains`, `vendors`, `tiers`, `asset_strategies`, `asset_complexities`, `departments` (existing departments, so new ones can be detected), `diagrams` (for `hero_diagram`, matched by name), and `users` (for matching `architects` by name — reuse the same `SELECT id, name FROM users` join-by-name approach already used for `asset_architects`, since there is no separate architects table). Also preload `business_capabilities` into a name→id map for `capabilities`.

- [ ] **Step 2: Per-row resolution**

For each input row (object keyed by normalized header):
- 400 the whole request up front if any of `REQUIRED_COLUMNS` is missing from the header set (check this once against `Object.keys(rows[0] ?? {})`, not per-row).
- Skip/ignore any key not in `KNOWN_COLUMNS`.
- `department`: split on `/[;|]/`, trim each, case-insensitively match against the preloaded department map; for unmatched names, create the department now (`Unpublished`, `writeAudit` CREATE) and add it to both the map and a `departmentsCreated: string[]` accumulator (dedupe by name across the whole request, not per row).
- `architects`/`capabilities`: same `;`/`|` split, matched by name against their respective preloaded maps; unmatched names become a per-row warning string (`"Architect 'X' not found — skipped"` / `"Capability 'X' not found — skipped"`), not a hard failure.
- `domain`/`vendor`/`tier`/`strategy`/`hero_diagram`: single-value name lookup; unmatched → left `null` + a per-row warning, never a hard failure.
- `type`: default `"Other"` if omitted; if present but not in `VALID_TYPES`, fall back to `"Other"` with a warning.
- `lifecycle_status`: default `"Proposed"`; same fallback-with-warning rule using `VALID_STATUSES`.
- `category`: default `"Application"` if omitted (free text, no whitelist — matches how `assets.category` is stored elsewhere: plain `VARCHAR`, not an enum).
- Only `name` presence per-row is a hard per-row failure (`status: "failed", error: "Missing required field: name"`); every other problem downgrades to a warning so the rest of the row still gets created — this matches the doc's "unmatched values are left blank and surfaced as a per-row warning" behavior.

- [ ] **Step 3: Insert, one row per `withTransaction` scope**

For each valid row, run the same shape of insert `POST /api/assets` uses (full column list `INSERT INTO assets (...)`, then junction inserts via `insertIgnoreSql("asset_departments", [...], dialect)` / `asset_architects` / `asset_capabilities`), each inside its own `withTransaction` call so one bad row never rolls back the whole batch. After each successful row, `writeAudit({ tableName: "assets", recordId: id, action: "CREATE", performedById: user.id, performedByName: user.name, oldValues: null, newValues: {...} })`.

- [ ] **Step 4: Response assembly**

```ts
return NextResponse.json({
  summary: {
    total: rows.length,
    created: results.filter(r => r.status === "created").length,
    failed: results.filter(r => r.status === "failed").length,
    departmentsCreated,
  },
  results,
});
```

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Unit tests**

Mirror `__tests__/unit/api/assets/route.test.ts`'s mocking setup exactly (`jest.mock('@/lib/db', ...)` with `withTransaction: jest.fn((cb) => cb({ execute: mockExecute }))`, `jest.mock('@/lib/audit', ...)`, `jest.mock('@/lib/require-user', ...)`). Cover:
- All-valid 2-row CSV → `summary.created === 2`, two `writeAudit` calls.
- Row missing `name` → that row `status: "failed"`, others still created.
- New department name not in the preloaded map → inserted once, appears once in `departmentsCreated` even if two rows reference it.
- Unknown `tier` name → row still created, `warnings` contains a tier-not-found message, `tier_id` inserted as `null`.
- Missing `department` column in the header entirely → whole request `400`.

- [ ] **Step 7: Run tests**

Run: `npm test -- assets/bulk`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/api/assets/bulk/route.ts __tests__/unit/api/assets/bulk.test.ts
git commit -m "feat: add POST /api/assets/bulk CSV import endpoint"
```

### Task B2: Bulk upload page + settings tile

**Files:**
- Create: `app/(dashboard)/settings/bulk-upload-assets/page.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: `POST /api/assets/bulk` response shape from Task B1.

- [ ] **Step 1: Client-side CSV parser**

Write a small quote-aware CSV parser (no new dependency — the doc doesn't call for one and the format is simple enough): handles quoted fields containing commas/newlines/escaped `""`. Function signature: `parseCsv(text: string): { headers: string[]; rows: Record<string,string>[] }`.

- [ ] **Step 2: Page layout**

Sections in order: (1) format description listing required/optional columns per Task B1's `KNOWN_COLUMNS`/`REQUIRED_COLUMNS`, (2) a `<input type="file" accept=".csv">` picker, (3) once a file is chosen, parse it client-side and render a preview `<table>` of the first N rows with the resolved headers, (4) an "Import" button that POSTs `{ rows }` to `/api/assets/bulk` (auth cookie sent automatically, no need to pass userId/userName per Task B1's server-side `auth.user` decision), (5) after the response, a results table: total/created/failed counts, `departmentsCreated` list, and a per-row table with status + warnings.

- [ ] **Step 3: Add the settings tile**

In `app/(dashboard)/settings/page.tsx`, add `Upload` to the `lucide-react` import line, then add a tile in the **Reference Data** section (same section as Business Capabilities per the file's current grouping):

```tsx
<SettingsTile
  href="/settings/bulk-upload-assets"
  icon={Upload}
  iconBg="bg-teal-500"
  title="Bulk Upload Assets"
  description="Import multiple assets at once from a CSV file."
/>
```

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Start dev server, sign in as Admin, go to Settings → Bulk Upload Assets, upload a small CSV with 2–3 rows including one new department name and one unknown tier name, confirm the preview and results tables render correctly and the assets appear in `/assets` afterward.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/settings/bulk-upload-assets/page.tsx" "app/(dashboard)/settings/page.tsx"
git commit -m "feat: add Bulk Upload Assets settings page"
```

---

## Part C — Business Services module

### Task C1: Schema — `services` + `service_assets`

**Files:**
- Modify: `drizzle/schema.ts`
- Modify: `drizzle/schema.sqlite.ts`
- Generate: `drizzle/migrations/000X_*.sql` (via `npx drizzle-kit generate`)
- Generate: `drizzle/migrations-sqlite/000X_*.sql` (via `npm run db:generate:sqlite`)

**Interfaces:**
- Produces: `services` table (id, name, slug UNIQUE, description, status enum, tier_id, domain_id, business_owner, technical_owner, created_by, timestamps) and `service_assets` junction (composite PK service_id+asset_id, role enum, notes) — column names and shapes consumed by every route in Tasks C2–C4.

- [ ] **Step 1: Add to `drizzle/schema.ts`**, mirroring the `tiers`/`projects` lookup-table pattern and the `projectAssets` junction-with-enum pattern:

```ts
export const services = mysqlTable("services", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique("uq_services_slug"),
  description: text("description"),
  status: mysqlEnum("status", ["Planned", "Active", "Degraded", "Retired"]).notNull().default("Planned"),
  tierId: char("tier_id", { length: 36 }),
  domainId: char("domain_id", { length: 36 }),
  businessOwner: varchar("business_owner", { length: 255 }),
  technicalOwner: varchar("technical_owner", { length: 255 }),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const serviceAssets = mysqlTable("service_assets", {
  serviceId: char("service_id", { length: 36 }).notNull(),
  assetId: char("asset_id", { length: 36 }).notNull(),
  role: mysqlEnum("role", ["Core", "Supporting", "Dependency"]).notNull().default("Supporting"),
  notes: text("notes"),
}, (t) => [
  primaryKey({ columns: [t.serviceId, t.assetId] }),
  index("idx_service_assets_asset").on(t.assetId),
]);
```

- [ ] **Step 2: Add the sqlite mirror to `drizzle/schema.sqlite.ts`**, following that file's `text(col, { enum: [...] })` convention (see `assets.type` in that file for the exact pattern) instead of `mysqlEnum`:

```ts
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique("uq_services_slug"),
  description: text("description"),
  status: text("status", { enum: ["Planned", "Active", "Degraded", "Retired"] }).notNull().default("Planned"),
  tierId: text("tier_id"),
  domainId: text("domain_id"),
  businessOwner: text("business_owner"),
  technicalOwner: text("technical_owner"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const serviceAssets = sqliteTable("service_assets", {
  serviceId: text("service_id").notNull(),
  assetId: text("asset_id").notNull(),
  role: text("role", { enum: ["Core", "Supporting", "Dependency"] }).notNull().default("Supporting"),
  notes: text("notes"),
}, (t) => [
  primaryKey({ columns: [t.serviceId, t.assetId] }),
  index("idx_service_assets_asset").on(t.assetId),
]);
```

- [ ] **Step 3: Generate migrations**

Run: `npx drizzle-kit generate` (requires `DB_*` env vars or a completed `site.config.json` — use whichever the local dev environment already has set up for this repo).
Expected: a new numbered file appears under `drizzle/migrations/` containing `CREATE TABLE services (...)` and `CREATE TABLE service_assets (...)`.

Run: `npm run db:generate:sqlite`
Expected: a new numbered file appears under `drizzle/migrations-sqlite/`.

- [ ] **Step 4: Review generated SQL**

Read both generated files and confirm the enum/unique/composite-PK/index clauses match what Step 1/2 specified — drizzle-kit sometimes needs a manual nudge (e.g. confirming "no destructive change" prompts) since this run happens against a schema with prior tables already present.

- [ ] **Step 5: Boot the app once against a scratch/dev database and confirm migrations apply cleanly**

Run: `npm run dev`, hit any route that calls `setupDatabase()`, confirm no errors, then check `SHOW TABLES LIKE 'service%'` (mysql) or the sqlite file's schema shows both new tables.

- [ ] **Step 6: Commit**

```bash
git add drizzle/schema.ts drizzle/schema.sqlite.ts drizzle/migrations drizzle/migrations-sqlite
git commit -m "feat: add services and service_assets tables via drizzle migrations"
```

### Task C2: `lib/slug.ts`

**Files:**
- Create: `lib/slug.ts`
- Test: `__tests__/unit/lib/slug.test.ts`

**Interfaces:**
- Produces: `slugify(name: string): string` and `uniqueSlug(base: string, exists: (candidate: string) => Promise<boolean>): Promise<string>`, consumed by Tasks C3/C4.

- [ ] **Step 1: Write the failing tests**

```ts
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, trims, and hyphenates", () => {
    expect(slugify("Telephony for Retail")).toBe("telephony-for-retail");
  });
  it("strips non-alphanumeric characters", () => {
    expect(slugify("Payments & Billing (v2)")).toBe("payments-billing-v2");
  });
  it("collapses repeated separators", () => {
    expect(slugify("  Multi   Space -- Name ")).toBe("multi-space-name");
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when unused", async () => {
    const exists = jest.fn().mockResolvedValue(false);
    expect(await uniqueSlug("telephony-retail", exists)).toBe("telephony-retail");
  });
  it("appends -2, -3 on collision", async () => {
    const exists = jest.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    expect(await uniqueSlug("telephony-retail", exists)).toBe("telephony-retail-3");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/slug`
Expected: FAIL with "Cannot find module '@/lib/slug'"

- [ ] **Step 3: Implement**

```ts
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/slug`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/slug.ts __tests__/unit/lib/slug.test.ts
git commit -m "feat: add slugify/uniqueSlug helpers for service slugs"
```

### Task C3: `types/index.ts` additions

**Files:**
- Modify: `types/index.ts`

**Interfaces:**
- Produces: `ServiceStatus`, `ServiceRole`, `Service`, `ServiceAsset` types consumed by every route and component in Tasks C4–C6.

- [ ] **Step 1: Add the types**, following the exact field-naming convention already used by `Project`/`ProjectAsset` (camelCase, `Id`/`Name` pairs for denormalized FKs):

```ts
export type ServiceStatus = "Planned" | "Active" | "Degraded" | "Retired";
export type ServiceRole = "Core" | "Supporting" | "Dependency";

export interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ServiceStatus;
  tierId: string | null;
  tierName: string | null;
  domainId: string | null;
  domainName: string | null;
  businessOwner: string | null;
  technicalOwner: string | null;
  assetCount?: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceAsset {
  assetId: string;
  assetName: string;
  assetType: string;
  assetIcon: string | null;
  lifecycleStatus: string;
  tierName: string | null;
  role: ServiceRole;
  notes: string | null;
}
```

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors (types added but unused is fine).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Service/ServiceAsset types"
```

### Task C4: `lib/services.ts` — composed-view helper

**Files:**
- Create: `lib/services.ts`
- Test: `__tests__/unit/lib/services.test.ts`

**Interfaces:**
- Consumes: `DbClient` from `@/lib/db-sqlite`, `getDbDialect` from `@/lib/db`.
- Produces: `getComposedService(db: DbClient, dialect: DbDialect, opts: { id?: string; slug?: string }): Promise<(Service & { members: ServiceAsset[] }) | null>`, consumed by Tasks C5 (both `[id]` and `by-slug/[slug]` read routes).

- [ ] **Step 1: Write the failing test**

```ts
import { getComposedService } from "@/lib/services";

describe("getComposedService", () => {
  it("returns null when the service row is not found", async () => {
    const execute = jest.fn().mockResolvedValueOnce([[], []]);
    const result = await getComposedService({ execute } as any, "mysql", { id: "missing" });
    expect(result).toBeNull();
  });

  it("composes the service with its ordered members", async () => {
    const serviceRow = {
      id: "s1", name: "Telephony", slug: "telephony", description: null,
      status: "Active", tier_id: null, tier_name: null, domain_id: null, domain_name: null,
      business_owner: null, technical_owner: null,
      created_by_id: "u1", created_by_name: "Alice",
      created_at: new Date("2026-01-01"), updated_at: new Date("2026-01-01"),
    };
    const memberRows = [
      { asset_id: "a1", asset_name: "Twilio", asset_type: "SaaS", asset_icon: "Phone",
        lifecycle_status: "Production", tier_name: "Gold", role: "Core", notes: null },
    ];
    const execute = jest.fn()
      .mockResolvedValueOnce([[serviceRow], []])
      .mockResolvedValueOnce([memberRows, []]);
    const result = await getComposedService({ execute } as any, "mysql", { id: "s1" });
    expect(result?.slug).toBe("telephony");
    expect(result?.members).toHaveLength(1);
    expect(result?.members[0].role).toBe("Core");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/services`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**, reusing the exact row-shape query joins from `app/api/projects/[id]/assets/route.ts`'s GET (junction → asset → tier) plus a tier/domain join on the parent row itself:

```ts
import type { DbClient } from "@/lib/db-sqlite";
import type { DbDialect } from "@/lib/setup";
import type { Service, ServiceAsset } from "@/types";

const ROLE_ORDER: Record<string, number> = { Core: 0, Supporting: 1, Dependency: 2 };

export async function getComposedService(
  db: DbClient,
  _dialect: DbDialect,
  opts: { id?: string; slug?: string }
): Promise<(Service & { members: ServiceAsset[] }) | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT s.*, t.name AS tier_name, d.name AS domain_name
     FROM services s
     LEFT JOIN tiers t ON t.id = s.tier_id
     LEFT JOIN domains d ON d.id = s.domain_id
     WHERE ${opts.id ? "s.id = ?" : "s.slug = ?"}`,
    [opts.id ?? opts.slug]
  );
  const row = rows[0];
  if (!row) return null;

  const [memberRows] = await db.execute<any[]>(
    `SELECT sa.role, sa.notes, a.id AS asset_id, a.name AS asset_name, a.type AS asset_type,
            a.icon AS asset_icon, a.lifecycle_status, t.name AS tier_name
     FROM service_assets sa
     JOIN assets a ON a.id = sa.asset_id
     LEFT JOIN tiers t ON t.id = a.tier_id
     WHERE sa.service_id = ?`,
    [row.id]
  );

  const toISO = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : "");
  const members: ServiceAsset[] = memberRows
    .map((r: any) => ({
      assetId: r.asset_id, assetName: r.asset_name, assetType: r.asset_type,
      assetIcon: r.asset_icon ?? null, lifecycleStatus: r.lifecycle_status,
      tierName: r.tier_name ?? null, role: r.role, notes: r.notes ?? null,
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  return {
    id: row.id, name: row.name, slug: row.slug, description: row.description ?? null,
    status: row.status, tierId: row.tier_id ?? null, tierName: row.tier_name ?? null,
    domainId: row.domain_id ?? null, domainName: row.domain_name ?? null,
    businessOwner: row.business_owner ?? null, technicalOwner: row.technical_owner ?? null,
    createdById: row.created_by_id, createdByName: row.created_by_name,
    createdAt: toISO(row.created_at), updatedAt: toISO(row.updated_at),
    members,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/services`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services.ts __tests__/unit/lib/services.test.ts
git commit -m "feat: add getComposedService shared read helper"
```

### Task C5: API routes — CRUD + composed reads

**Files:**
- Create: `app/api/services/route.ts`
- Create: `app/api/services/[id]/route.ts`
- Create: `app/api/services/[id]/assets/route.ts`
- Create: `app/api/services/[id]/assets/[assetId]/route.ts`
- Create: `app/api/services/by-slug/[slug]/route.ts`
- Test: `__tests__/unit/api/services/route.test.ts`
- Test: `__tests__/unit/api/services/id.test.ts`
- Test: `__tests__/unit/api/services/assets.test.ts`
- Test: `__tests__/unit/api/services/assetId.test.ts`
- Test: `__tests__/unit/api/services/by-slug.test.ts`

**Interfaces:**
- Consumes: `getComposedService` (Task C4), `slugify`/`uniqueSlug` (Task C2), `Service`/`ServiceAsset`/`ServiceStatus`/`ServiceRole` (Task C3).
- Produces: the full REST surface consumed by Task C6's pages.

- [ ] **Step 1: `app/api/services/route.ts`** — mirror `app/api/projects/route.ts` exactly (asset-count rollup GET, `requireUser`-gated POST with `nowSql`-inlined timestamps, single `db.execute()` insert, `writeAudit`), with these Business-Services-specific differences:
  - `GET`: `LEFT JOIN service_assets sa ON sa.service_id = s.id`, `GROUP BY s.id`, `COUNT(sa.asset_id) AS asset_count`, plus `LEFT JOIN tiers`/`LEFT JOIN domains` for `tier_name`/`domain_name`. Order by `s.name ASC`.
  - `POST` body: `{ name, description, status, tierId, domainId, businessOwner, technicalOwner, slug? }`. Validate `name.trim()` required, `status` in `["Planned","Active","Degraded","Retired"]` (default `"Planned"` if omitted). Compute slug: `const base = slugify(body.slug?.trim() || name);` then `const slug = await uniqueSlug(base, async (c) => { const [r] = await db.execute<any[]>("SELECT 1 FROM services WHERE slug = ?", [c]); return r.length > 0; });`. Insert, `writeAudit`, `201 { id, slug }`.

- [ ] **Step 2: `app/api/services/[id]/route.ts`** — mirror `app/api/projects/[id]/route.ts`'s `PUT`/`DELETE` (async `params`, read-before-write for audit `oldValues`, 404 handling), plus a `GET` that calls `getComposedService(getDb(), getDbDialect(), { id })` and returns `404` if `null`, else `NextResponse.json(service)`.
  - `PUT`: body may include a new `slug` — **only recompute/change the slug if `body.slug` is explicitly provided and differs from the current one** (rename must not auto-change slug, per the doc's explicit "renames do not change the slug unless a new one is explicitly supplied" rule); if a new slug is supplied, still run it through `slugify` + `uniqueSlug` (excluding the current row: `WHERE slug = ? AND id != ?`).
  - `DELETE`: existence check → 404, `DELETE FROM service_assets WHERE service_id = ?` then `DELETE FROM services WHERE id = ?`, `writeAudit` with `newValues: null`.

- [ ] **Step 3: `app/api/services/[id]/assets/route.ts`** — mirror `app/api/projects/[id]/assets/route.ts` exactly: `GET` validates parent exists (404), returns the joined member list (same shape as `getComposedService`'s members — consider calling `getComposedService` here too and returning just `.members`, to avoid duplicating the join). `POST` validates `assetId` required, `role` in `["Core","Supporting","Dependency"]` (default `"Supporting"`), parent exists (404), target asset exists (404), not already linked (409), plain insert, no audit call (matches the `project_assets` precedent of not auditing link/unlink sub-resources).

- [ ] **Step 4: `app/api/services/[id]/assets/[assetId]/route.ts`** — mirror `app/api/projects/[id]/assets/[assetId]/route.ts`: `PATCH` updates `role`/`notes` (validate `role` whitelist if present), `DELETE` removes the membership row. Both 404 if the membership doesn't exist.

- [ ] **Step 5: `app/api/services/by-slug/[slug]/route.ts`** — `GET` only, calls `getComposedService(getDb(), getDbDialect(), { slug: params.slug })`, 404 if null, else `NextResponse.json(service)`. Per the earlier decision, this route still goes through `requireUser(req)` like every other route in the app — the doc's "no new auth was added, external gateway handles it" note refers to *not adding a second parallel auth mechanism*, not to skipping the app's existing cookie auth. If the external platform consuming this needs a non-cookie auth path, that is a separate, explicitly-scoped piece of work — flag it to the user rather than silently building an unauthenticated endpoint.

- [ ] **Step 6: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors across all five new route files.

- [ ] **Step 7: Unit tests**

For each route file, copy the corresponding `projects` test file's structure (`route.test.ts` → list/create, `id.test.ts` → get/put/delete, `assets.test.ts` → list/add members, `assetId.test.ts` → patch/remove member) and adapt table/field names. Additionally add slug-specific cases to `route.test.ts` (auto-slug generation, `-2` suffix on collision) and to `id.test.ts` (rename doesn't change slug; explicit new slug does, with its own collision suffix).

- [ ] **Step 8: Run tests**

Run: `npm test -- api/services`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add app/api/services __tests__/unit/api/services
git commit -m "feat: add Business Services CRUD and composed-read API routes"
```

### Task C6: `components/services/ServiceFlow.tsx` + pages + navigation

**Files:**
- Create: `components/services/ServiceFlow.tsx`
- Create: `app/(dashboard)/services/page.tsx`
- Create: `app/(dashboard)/services/[id]/page.tsx`
- Modify: `config/navigation.ts`

**Interfaces:**
- Consumes: `Service`/`ServiceAsset` types (C3), the API routes from C5.

- [ ] **Step 1: `ServiceFlow.tsx`** — copy `components/projects/DependencyFlow.tsx` structurally: same `NODE_TYPES`/custom node components/manual layout/`smoothstep` animated edges approach, but with three role-based columns instead of two direction-based ones (`Core` centered nearest the hub, `Supporting` next ring, `Dependency` outer ring — or simplest: keep the existing two-column left/right layout but color-code edges by role instead of direction, using role→color mapping `{ Core: "#7c3aed", Supporting: "#0ea5e9", Dependency: "#94a3b8" }`). Props: `{ service: Service; members: ServiceAsset[] }`.

- [ ] **Step 2: `app/(dashboard)/services/page.tsx`** — mirror `app/(dashboard)/projects/page.tsx`: list table (name, slug, status badge, tier, domain, asset count, actions), status filter, create/edit modal (name, auto-slug preview that updates live as the user types the name unless they've manually edited the slug field, description, status, tier dropdown, domain dropdown, business/technical owner).

- [ ] **Step 3: `app/(dashboard)/services/[id]/page.tsx`** — mirror `app/(dashboard)/projects/[id]/page.tsx`: hero card (name, slug, status badge, tier/domain/owners), List/Flow toggle, List view grouped by role (`Core`/`Supporting`/`Dependency` sections) with inline edit/remove, Flow view lazy-loaded via `next/dynamic({ ssr: false })` exactly like `DependencyFlow` is loaded.

- [ ] **Step 4: Navigation**

In `config/navigation.ts`, add a new group above the existing `"Assets"` group:

```ts
{
  title: "Business Services",
  items: [
    { label: "Service Catalogue", href: "/services", icon: "Layers" },
  ],
},
```

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Start dev server, navigate to Business Services → Service Catalogue, create a service, add two assets with different roles, confirm List and Flow views both render correctly, edit a member's role/notes, remove a member, rename the service and confirm the slug is unchanged, explicitly edit the slug and confirm it updates, delete the service.

- [ ] **Step 7: Commit**

```bash
git add components/services "app/(dashboard)/services" config/navigation.ts
git commit -m "feat: add Business Services list/detail pages and navigation entry"
```

---

## Final verification

- [ ] Run `npx tsc --noEmit` — zero new errors across the whole bundle.
- [ ] Run `npm test` — all unit + ui tests pass.
- [ ] Run `npm run test:integration` if a local test DB is configured (`.env.test`), otherwise note it was skipped.
- [ ] Manually walk through all three features once end-to-end per the manual-verification steps in Tasks A2, B2, and C6.
