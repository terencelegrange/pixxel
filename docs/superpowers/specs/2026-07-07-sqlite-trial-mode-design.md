# SQLite Trial Mode — Design

## Purpose

Let a user choose, at install time (via the `/setup` wizard), between connecting
Pixxel to an existing MySQL/MariaDB server (current, only supported path) or
running entirely on an embedded SQLite database file — so the app can be tried
out in a single container with no external database service to stand up.

This is a **trial-only** mode. It is not a commitment to full production parity
with MySQL going forward: single-writer concurrency limits, no backup tooling,
and no guarantee that every future schema change ships a SQLite migration on
day one are all acceptable trade-offs. It must, however, be correct for the
current feature set at the time it ships.

## Non-goals

- PostgreSQL support (out of scope entirely — see prior discussion; SQLite
  solves the actual problem, which is "no second container needed for a
  trial," better than adding another networked database would).
- Production-grade concurrency, backups, or replication for SQLite.
- Keeping SQLite schema/queries in permanent lockstep with every future MySQL
  change as a hard requirement — acceptable for it to lag, since it's a trial
  path, as long as it doesn't silently produce wrong data.
- Full integration-test duplication (one Jest project per dialect). A smoke
  test is enough (see Testing).

## Current state (relevant facts)

- `lib/db.ts` is the single point that creates a `mysql2/promise` `Pool` and
  runs `setupDatabase()` (creates the DB, applies Drizzle migrations, seeds
  reference data). Credentials come from `site.config.json` (written by
  `/setup`) or `DB_*` env vars.
- 63 route files under `app/api/**` import `mysql2/promise` and call
  `pool.execute(sql, params)` directly — no ORM/query-builder layer at
  runtime. `drizzle/schema.ts` is migration-source-of-truth only.
- Of those, all but 12 files use plain parameterized SQL with no
  MySQL-specific syntax — these need **no changes** for SQLite support,
  because both `mysql2` and the SQLite adapter (see below) expose the same
  `execute(sql, params) → rows` shape.
- 5 files use `INSERT IGNORE` / `ON DUPLICATE KEY UPDATE ... VALUES(...)` (9
  call sites total): `settings/route.ts`, `plantuml/[id]/assets/auto-tag/route.ts`,
  `assets/[id]/route.ts`, `assets/route.ts`, `diagrams/[id]/versions/route.ts`.
- 3 files use `GROUP_CONCAT(DISTINCT ... ORDER BY ... SEPARATOR ...)`:
  `assets/route.ts`, `assets/[id]/route.ts`, `assets/my-assets/route.ts`.
  SQLite's `GROUP_CONCAT` supports neither `DISTINCT` nor an internal
  `ORDER BY`. The aggregated columns all come from junction tables with
  composite primary keys (`asset_departments`, `asset_architects`,
  `asset_capabilities`), so duplicate rows are structurally impossible —
  `DISTINCT` is defensive, not load-bearing, and can be dropped for the
  SQLite path.
- `lib/db.ts` itself uses MySQL-only `UUID()` (in seed inserts) and
  `GET_LOCK`/`RELEASE_LOCK` (to serialize schema setup across parallel
  Next.js build workers) — contained entirely to this one file.
- `drizzle/schema.ts` defines 30 tables using `mysql-core` builders,
  including `mysqlEnum` columns and a `datetime` `updated_at` column with
  `ON UPDATE CURRENT_TIMESTAMP` (MySQL-only column behavior).
- `Dockerfile` builds on `node:20-alpine`. Node's built-in `node:sqlite`
  module requires Node 22.5+, so the base image must be bumped.
- `app/(setup)/setup/page.tsx` already has a 4-step wizard (Database →
  Application → Admin Account → Review) with a "test connection" step
  (`/api/setup/test-db`) and a completion step (`/api/setup/complete`) that
  writes `site.config.json` + `.env.local` and bootstraps the schema.

## Architecture

### Dialect abstraction

`site.config.json` and `.env.local` gain a `dbType: "mysql" | "sqlite"` field.
For `sqlite`, config carries a file path (e.g. `data/pixxel.db`) instead of
host/port/user/password.

`lib/db.ts` exposes a dialect-agnostic `getDb()` returning an object with the
same `.execute(sql, params) → [rows, fields]` contract that `mysql2/promise`'s
pool already provides, so every route file that only does plain parameterized
SQL keeps working unmodified regardless of which dialect is active.

For SQLite, the driver is Drizzle's `sqlite-proxy` (a generic driver you back
with your own execute callback) wrapping Node's built-in `node:sqlite`
(`DatabaseSync`, synchronous). This avoids adding a native dependency that
needs platform-specific compilation inside the Docker image (the classic
`better-sqlite3`-in-Docker problem) — `node:sqlite` ships with Node itself.

`withTransaction()` gets a SQLite implementation using `DatabaseSync`'s
built-in transaction support, matching the existing begin/commit/rollback
callback shape.

### Schema and migrations

New `drizzle/schema.sqlite.ts`, a parallel definition of all 30 tables using
`sqlite-core` builders:

- `mysqlEnum` → `text` + a `CHECK (col IN (...))` constraint.
- `char(36)` (UUID primary/foreign keys) → `text`.
- `decimal` → `real`.
- `datetime` → `text` (ISO-8601 strings), matching how the app already
  formats dates in JS before sending them as query params.
- `updated_at`'s MySQL `ON UPDATE CURRENT_TIMESTAMP` becomes an `AFTER
  UPDATE` SQLite trigger per table (defined in the migration SQL), so no
  route code needs to remember to touch `updated_at` manually.

New `drizzle/migrations-sqlite/` holds the generated SQLite migration SQL,
applied the same way `setupDatabase()` applies MySQL migrations today, just
against the SQLite connection.

### Query compatibility

`lib/db.ts` exposes the active dialect (e.g. `getDbDialect(): "mysql" |
"sqlite"`) so the small number of routes with MySQL-specific SQL can branch:

- The 9 `INSERT IGNORE` / `ON DUPLICATE KEY UPDATE` call sites get an
  `if (dialect === "sqlite")` branch using `INSERT OR IGNORE` and
  `ON CONFLICT(...) DO UPDATE SET col = excluded.col`.
- The 3 `GROUP_CONCAT` queries get a SQLite branch that rewrites the
  aggregation as `GROUP_CONCAT(col, ',')` over a pre-ordered correlated
  subquery (dropping `DISTINCT`, preserving display order via the subquery's
  own `ORDER BY`).

`setupDatabase()` branches on dialect: for SQLite, skip `CREATE DATABASE`
(a SQLite database is just a file — created on first connection) and skip
`GET_LOCK`/`RELEASE_LOCK` (no cross-worker race to guard against in a
single-process trial container). Seed data that currently uses SQL `UUID()`
switches to app-level `randomUUID()` for the SQLite path.

### Setup wizard UX

Step 1 ("Database Connection") gains a type toggle at the top:
**MySQL / MariaDB** (existing form, unchanged) vs **SQLite (Trial Mode)**.
Selecting SQLite hides the host/port/user/password fields entirely and shows
a short note that data is stored in a single file inside the container
(default `data/pixxel.db`), with an optional override for the path. The
"Test Connection" step becomes "verify the path is writable" instead of
opening a network connection.

`/api/setup/test-db` and `/api/setup/complete` both branch on the selected
`dbType` to run the appropriate connection test / bootstrap path.

### Docker

- Bump `Dockerfile`'s base image from `node:20-alpine` to `node:22-alpine`
  (minimum for `node:sqlite`) — reasonable regardless, given local dev is
  already on Node 25.8.1.
- Document (and optionally wire in a sample `docker-compose.yml`) a volume
  mount for the `data/` directory so the SQLite file survives a container
  restart. Not required for the feature to work — the trial still functions
  fully with an ephemeral file — but worth offering since restart-losing-data
  would otherwise surprise a trial user immediately.

## Testing

- Unit tests for the new SQLite branches (the `INSERT OR IGNORE`/`ON
  CONFLICT` and `GROUP_CONCAT` rewrites) follow the existing pattern:
  `lib/db` mocked, dialect forced to `"sqlite"`, assert the SQL string/params
  passed to `execute`.
- One lightweight integration smoke test: boot with `dbType: sqlite`, run
  `setupDatabase()` against a temp file, hit a handful of representative
  routes (asset create + list with departments/architects/capabilities
  attached, to exercise the rewritten `GROUP_CONCAT` path; a settings
  upsert, to exercise `ON CONFLICT`). Not a full duplicate of the MySQL
  integration suite.

## Open items for the implementation plan

- Exact SQLite column types for a couple of edge cases (`longtext`,
  `int unsigned`) — map during schema port, no design-level ambiguity
  expected.
- Whether `data/` needs to be `.gitignore`d (yes, alongside existing
  `.env.local` pattern) — implementation detail, not a design decision.
