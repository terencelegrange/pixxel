# Contract Management — Design

## Purpose

Give vendor contracts a first-class data model instead of the single
`contract_amount`/`contract_end_date` pair currently bolted onto `assets`.
Track value, dates, renewal terms, notice period, owner, and status per
contract; link each contract to a vendor and (optionally) a single asset;
surface upcoming expirations/renewal deadlines via a `/contracts` list and
the existing header notification bell. This is backlog item #4
(`docs/backlog.md`, Priority 1).

## Non-goals

- Multi-currency support. Contract value is USD-only, matching today's
  `contract_amount` formatting exactly. Currency/locale handling is a
  separate, deliberately deferred backlog item (#26, Internationalisation —
  see `docs/backlog.md`), so this feature doesn't have to solve it first.
- One contract covering multiple assets. `contracts.asset_id` is a single
  nullable FK, not a junction table — matches the common case (one
  subscription tied to one app, or a vendor-level contract tied to no
  specific asset) without the added complexity of a many-to-many UI for a
  case that's rare in practice. Can be revisited later if it turns out to
  matter.
- A vendor detail page. Vendors currently has no `/vendors/[id]` route (list
  + modal only). The backlog's "vendor contracts tab" is delivered instead
  as a vendor-filtered view of the one `/contracts` list
  (`/contracts?vendor=<id>`), not a new page type.
- A literal Gantt-style "renewal timeline" page. The backlog's "contracts
  list with renewal timeline" is delivered as the `/contracts` list sorted/
  filterable by end date with a color-coded urgency badge, not a separate
  swimlane view (that would overlap with the existing Roadmap views).
- Scheduled/background jobs. No cron infrastructure exists anywhere in this
  app. "Expiring soon" and the notice-deadline calculation are computed at
  read time from stored dates, not precomputed or cached.
- Role-scoped alerts. Expiry alerts are Admin-only, matching the existing
  header bell's audience exactly — no per-contract "owner" account linkage
  (the `owner` field stays free text, same as `business_owner` elsewhere).

## Current state (relevant facts)

- `assets` has `contract_end_date` (`DATE` NULL) and `contract_amount`
  (`DECIMAL(15,2)` NULL), formatted as USD in the UI (asset detail page and
  `AssetModal`). No other contract concept exists anywhere in the app.
- `vendors` (`drizzle/schema.ts`) has no `id`-keyed detail route — only
  `app/(dashboard)/vendors/page.tsx` (list + create/edit modal), consistent
  with `tiers`/`departments`/`domains`.
- The header notification bell (`components/layout/Header.tsx`) is the only
  existing alerting mechanism: Admin-only, polls `GET /api/support` every
  60s via `setInterval`, shows a badge count (9+ cap) and a dropdown with a
  single feedback-count section linking to `/settings/feedback`. This is
  the pattern contract alerts extend, not replace.
- CRUD routes for reference-data-shaped entities (`vendors`, `tiers`,
  `departments`) follow one consistent shape: `GET`/`POST` on the collection
  route, `PUT`/`DELETE` on `[id]`, `requireUser(req)` for reads /
  `requireUser(req, ["Admin","Member"])` for writes, `writeAudit()` on every
  mutation. `contracts` follows this exactly.
- `assets.vendor_id` is already a nullable FK (`char("vendor_id", { length:
  36 })`, no `.notNull()`) — `contracts.vendor_id` follows the same
  nullability for the same reason: some assets currently have contract data
  with no vendor set, and that data must survive migration.
- No FK constraint builders (`references()`) are used anywhere in this
  schema — `contracts.vendor_id`/`asset_id` are plain `char(36)`, integrity
  enforced app-side, consistent with every other table.

## Data model

New `contracts` table (MySQL + SQLite, both `drizzle/schema.ts` and
`drizzle/schema.sqlite.ts`, generated migrations for both dialects):

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID, app-generated via `randomUUID()` |
| `vendor_id` | `CHAR(36)` NULL | no FK builder; nullable — see Non-goals/Current state |
| `asset_id` | `CHAR(36)` NULL | at most one linked asset |
| `title` | `VARCHAR(255)` NOT NULL | |
| `value` | `DECIMAL(15,2)` NULL | USD |
| `start_date` | `DATE` NULL | |
| `end_date` | `DATE` NULL | |
| `notice_period_days` | `INT UNSIGNED` NULL | |
| `auto_renews` | `BOOLEAN` NOT NULL DEFAULT `false` | |
| `owner` | `VARCHAR(255)` NULL | free text |
| `status` | `ENUM('Active','Terminated')` NOT NULL DEFAULT `'Active'` | user-set only — "Expired"/"Expiring Soon" are computed, never stored (see below) |
| `doc_url` | `VARCHAR(500)` NULL | plain URL, same pattern as `assets.doc_url` |
| `notes` | `TEXT` NULL | |
| `created_by_id` / `created_by_name` | | denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | auto-managed |

`assets.contract_end_date` and `assets.contract_amount` are **dropped** in
the same migration. A one-time data migration (run as part of
`setupDatabase()`, idempotent — checks a marker before running) creates one
`contracts` row per asset that currently has a non-null `contract_amount`
or `contract_end_date`, using `title = "<asset name> contract"`,
`vendor_id = assets.vendor_id` (may be null), `value = contract_amount`,
`end_date = contract_end_date`, `status = 'Active'`.

## Alert / urgency computation

Not stored. Computed per-request from `end_date`, `notice_period_days`, and
`auto_renews`:

```
effective_deadline = auto_renews AND notice_period_days IS NOT NULL
  ? end_date - notice_period_days
  : end_date
```

A contract is "expiring soon" when `status = 'Active'` AND
`effective_deadline` is within 30 or 90 days of the current date — two
separate thresholds, used by different surfaces: the header bell counts the
90-day window (an earlier, softer heads-up, glanced at frequently), the
dashboard card counts the tighter 30-day window (a more urgent, more
actionable summary). Both are simple counts of the same underlying
computation at different cutoffs — no shared/cached value between them.

List/detail urgency badge, purely presentational, derived the same way:
- `status = 'Terminated'` → gray "Terminated"
- `effective_deadline` in the past → red "Overdue"
- `effective_deadline` within 30 days → red "Expiring in Nd"
- `effective_deadline` within 90 days → amber "Expiring in Nd"
- otherwise → green "Active"

## API

- `app/api/contracts/route.ts` — `GET` (list, joins `vendors`/`assets` for
  display names, supports `?vendor=<id>`, `?asset=<id>`, and `?expiring=<days>`
  filters — the last using the same `effective_deadline` computation as
  `expiring-count` below) + `POST` (create, `writeAudit` CREATE).
- `app/api/contracts/[id]/route.ts` — `GET` (single) + `PUT` (update,
  `writeAudit` UPDATE) + `DELETE` (`writeAudit` DELETE).
- `app/api/contracts/expiring-count/route.ts` — `GET`, accepts `?days=`
  (default `90`), returns `{ count: number }` for contracts with
  `effective_deadline` within that many days. The header bell polls it with
  the default (90) as its second poll target (parallel to its existing
  `GET /api/support` poll, not a replacement); the dashboard card fetches
  it once with `?days=30`.

All routes: `requireUser(req)` for reads, `requireUser(req, ["Admin",
"Member"])` for writes, dialect-agnostic (`getDb()`/`getDbDialect()`, no
hand-rolled SQL divergence expected — this is plain CRUD with no
`INSERT IGNORE`/`GROUP_CONCAT` need).

## UI

- **`/contracts`** (new top-level nav item) — list table: title, vendor,
  linked asset (if any), value, end date, urgency badge. Filters: vendor,
  asset, status. Create/edit via a single modal (all fields fit — no
  separate detail page, matching the `Vendors`/`Tiers`/`Departments`
  list-plus-modal pattern rather than `Assets`/`Projects`' full
  detail-page pattern, since contracts have no nested sub-resource of
  their own to justify one).
- **Asset detail page** — the existing contract info fields
  (`contract_amount`/`contract_end_date` display) are replaced with a small
  "Contracts" list scoped to `asset_id`, reusing the `/contracts` list
  component/query rather than a bespoke read.
- **Vendors list** — each row gains a "View contracts" link to
  `/contracts?vendor=<id>`.
- **Dashboard** — one new small card: count of contracts with
  `effective_deadline` within 30 days, linking to `/contracts?expiring=30`.
- **Header bell** (`components/layout/Header.tsx`) — badge count becomes
  `newFeedbackCount + expiringContractsCount` (both polled independently,
  every 60s, same as today). Dropdown gains a second section ("N contracts
  expiring soon") linking to `/contracts?expiring=90`, alongside the
  existing feedback section — one bell, not a second icon.

## Testing

Unit tests for all three route files following the existing
`jest.mock('@/lib/db', ...)` / `jest.mock('@/lib/audit', ...)` /
`jest.mock('@/lib/require-user', ...)` convention (mirrors `vendors`/
`tiers` test files), including: CRUD happy paths, `expiring-count`'s date
math (auto-renew notice-deadline case vs. plain end-date case, boundary at
exactly 30/90 days), and the vendor/asset filter query params. No new UI
tests required beyond what the existing `Header.tsx` tests already cover
being extended for the second poll (if such tests exist — verify during
implementation and extend rather than add a parallel test file).

## Migration risk

Dropping `assets.contract_amount`/`contract_end_date` is irreversible via
Drizzle's forward-only migration model. The implementation plan must
include, in order: (1) add `contracts` table + backfill migration, (2) a
verification step confirming backfill row count matches the count of
assets with non-null contract fields before, (3) only then drop the two
asset columns in a second migration. Never combine backfill and column
drop in one migration — if backfill logic has a bug, the source data must
still be recoverable from `assets` until verified.
