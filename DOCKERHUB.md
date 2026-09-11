# Pixxel

**Enterprise Architecture Repository Platform**

Pixxel is a self-hosted web application for registering and managing your organisation's technology assets. It gives you a centralised inventory of every application in your portfolio — capturing ownership, lifecycle stage, dependencies, technology tier, and governance metadata — so your architecture practice has a single source of truth.

Docker Hub: [`tlgrange/pixxel`](https://hub.docker.com/r/tlgrange/pixxel)
Source: [github.com/terencelegrange/pixxel](https://github.com/terencelegrange/pixxel)

---

## Quick start

Just pull and run — nothing has to be configured up front. If you don't set `JWT_SECRET` (which signs session cookies), Pixxel generates one itself on first boot and persists it to `.jwt-secret` inside the container, so restarts keep working sessions. Set it explicitly if you want a stable secret across container recreations (e.g. mount it in, or use `--env-file`), or if you're running more than one replica — see the [Environment variables](#environment-variables) table.

Pixxel also ships with two database options — pick whichever fits your use case. Neither requires any env vars to boot: a container with no database configured yet starts up fine and serves the first-run setup wizard at `/setup`, where you name the instance, pick a dialect, and create the initial admin account.

### Option A — SQLite trial mode (fastest way to try it out)

No separate database container needed. All data lives in a single file inside a named volume.

```bash
docker run -d \
  --name pixxel \
  -p 3000:3000 \
  -v pixxel-data:/app/data \
  -e DB_TYPE=sqlite \
  -e DB_FILE=data/pixxel.db \
  tlgrange/pixxel:latest
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the first-run setup wizard to name your instance and create the initial admin account.

### Option B — MySQL / MariaDB (recommended for production)

```bash
docker run -d \
  --name pixxel \
  -p 3000:3000 \
  -e DB_TYPE=mysql \
  -e DB_HOST=your-db-host \
  -e DB_PORT=3306 \
  -e DB_USER=pixxel \
  -e DB_PASSWORD=your_password \
  -e DB_NAME=pixxel \
  tlgrange/pixxel:latest
```

The target database only needs to exist (`CREATE DATABASE pixxel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`) — schema and reference data are created automatically on first boot via Drizzle migrations.

> If the target database already has a populated `users` table (e.g. you're pointing at an existing Pixxel database), the setup wizard detects this automatically, skips the "create admin account" step, and preserves your existing users and data instead of treating it as a fresh install.

> **Partial `DB_*` env vars are validated at startup.** If you set any one of `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` before setup has completed, the rest are required too — the server refuses to boot with a clear error listing exactly which ones are missing, rather than failing later with a cryptic connection error. Set none of them (SQLite trial mode, or MySQL configured entirely through the wizard) or all of them (pre-configured MySQL) — not a partial set.

### docker-compose

```yaml
services:
  app:
    image: tlgrange/pixxel:latest
    ports:
      - "3000:3000"
    environment:
      # Optional — omit to auto-generate on first boot (see Quick start above).
      # JWT_SECRET: your_generated_secret # openssl rand -base64 32
      DB_TYPE: mysql
      DB_HOST: db
      DB_PORT: 3306
      DB_USER: pixxel
      DB_PASSWORD: your_password
      DB_NAME: pixxel
    depends_on:
      - db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: mariadb:11
    environment:
      MYSQL_DATABASE: pixxel
      MYSQL_USER: pixxel
      MYSQL_PASSWORD: your_password
      MYSQL_ROOT_PASSWORD: change_me
    volumes:
      - pixxel-db:/var/lib/mysql

volumes:
  pixxel-db:
```

Swap the `app` service for the SQLite `docker run` env vars above (plus a `pixxel-data:/app/data` volume) if you don't want to run a separate database container at all.

---

## Choosing a database

| | SQLite (trial mode) | MySQL / MariaDB |
|---|---|---|
| Setup effort | Zero — one file, one volume | Requires a running MySQL/MariaDB 8+ instance |
| Concurrency | Single shared connection, no pooling — fine for one admin, low traffic | Full connection pool via `mysql2` — safe under concurrent writes |
| Intended use | Local trial, demos, evaluation | Production deployments |
| Persistence | Named Docker volume containing the `.db` file | External managed or containerised database |
| Migrations | Custom lightweight runner (`drizzle/migrations-sqlite`), applied at boot | Drizzle's `migrate()` (`drizzle/migrations`), applied at boot |

Both dialects share the exact same application code and API surface — routes call a small `DbClient` abstraction (`execute(sql, params) -> [rows, meta]`) so business logic never branches on dialect except where SQL syntax genuinely diverges (e.g. `INSERT IGNORE` vs `INSERT OR IGNORE`).

SQLite mode is explicitly a trial/evaluation path, not a production backend: the `node:sqlite` connection is a single shared, unpooled connection per process. Concurrent writes from multiple requests are not safe against it — acceptable for a single admin kicking the tires, not for a multi-user production deployment.

---

## Environment variables

| Variable | Applies to | Default | Notes |
|---|---|---|---|
| `JWT_SECRET` | always | auto-generated | Optional. ≥ 32 chars if set. Signs session cookies; never written to `site.config.json`. If unset, generated on first boot and persisted to `.jwt-secret` in the container — set it explicitly for a stable secret across container recreations, or when running multiple replicas (see note below) |
| `DB_TYPE` | both | `mysql` | `mysql` or `sqlite` |
| `DB_HOST` | mysql | — | required once you supply any `DB_*` var pre-setup (see note above) |
| `DB_PORT` | mysql | `3306` | |
| `DB_USER` | mysql | — | required once you supply any `DB_*` var pre-setup |
| `DB_PASSWORD` | mysql | — | required once you supply any `DB_*` var pre-setup |
| `DB_NAME` | mysql | — | required once you supply any `DB_*` var pre-setup |
| `DB_FILE` | sqlite | `data/pixxel.db` | path relative to the container's working dir; mount a volume over its parent directory to persist it |
| `PLANTUML_SERVER_URL` | both | `https://www.plantuml.com/plantuml` | optional — point at a self-hosted PlantUML server if your architecture diagrams are confidential |

`DB_*` credentials can also be supplied entirely through the in-app setup wizard on first boot instead of environment variables — whichever is configured takes effect, with the wizard's `site.config.json` taking priority over env vars once setup has completed. `JWT_SECRET` is never collected by the wizard — it's either an env var you set, or auto-generated.

> **Auto-generated `JWT_SECRET` and container recreation.** The generated secret is written to `.jwt-secret` inside the container's filesystem, not a named volume — it persists across `docker restart`/`docker stop`+`start` of the *same* container, but a fresh `docker run` (new container from the image) generates a new one, invalidating existing sessions (users just log in again; no data is lost). If you want the secret itself to survive container recreation, set `JWT_SECRET` explicitly rather than relying on auto-generation.
>
> **Running multiple replicas?** Each instance auto-generates its own secret independently and will reject session tokens issued by the others. Always set `JWT_SECRET` explicitly (the same value on every replica) for any multi-instance deployment.

---

## Health check

`GET /api/health` runs a `SELECT 1` against the configured database and returns `{ "status": "ok" }` (200) or `{ "status": "error" }` (503). Use this for your orchestrator's liveness/readiness probe.

---

## Architecture

- **Framework:** Next.js 14 (App Router), TypeScript (strict)
- **Runtime image:** multi-stage Alpine build — deps → build → a minimal `next build --standalone` runtime stage running as a non-root user, no dev dependencies or full `node_modules` shipped
- **Database access:** no ORM query layer at runtime — routes use `mysql2`/`node:sqlite` directly through a shared `DbClient` interface. Drizzle is used **only** to author and generate schema migrations (`drizzle/schema.ts` → `drizzle/migrations/*.sql`), not as a query builder
- **Auth:** custom JWT-backed session (bcrypt, cost factor 12), not a third-party auth provider — session state lives in React Context + localStorage on the client, verified server-side per request
- **Audit trail:** every create/update/delete on a tracked table writes a before/after diff to `audit_log`, including the acting user
- **Roles:** `Admin` / `Member` / `Viewer`, assigned per user; the notification bell and admin-only views gate on `Admin`

### Feature surface

- **Asset Registry** — full CRUD for applications: type, lifecycle status, tier, domain, strategy, vendor, department classification
- **Bulk CSV import** — upload a CSV to create many assets at once; unmatched lookup values (tier, domain, vendor, etc.) surface as per-row warnings rather than failing the whole batch; each row commits in its own transaction
- **Projects** — link assets as upstream/downstream dependencies; visualise as an interactive ReactFlow diagram
- **Business Services** — a service catalogue layer above individual assets: group assets into named services (with a URL-friendly slug), classify each member asset's role (Core / Supporting / Dependency), and view the composition as a list or a ReactFlow diagram
- **Reports** — Asset Strategy matrix (domains × strategies), capability and complexity/cost views
- **Audit log** — paginated, filterable, expandable before/after diffs across every entity
- **Setup wizard** — first-run flow to name the instance, choose a database dialect, and create the initial admin account; automatically detects and safely reuses an existing populated database instead of re-initializing it

---

## Test coverage

The image is built from a codebase with unit, integration, and UI test suites (Jest 29):

- **Unit tests** — API routes (mocked DB/audit/auth) and shared `lib/` helpers
- **Integration tests** — auth, CRUD, and cross-entity flows against a real database
- **UI tests** — shared components and context providers (React Testing Library)

At the time of this image's build: **66 test suites / 382 tests**, all passing, with `npx tsc --noEmit` clean. The CI pipeline enforces minimum coverage thresholds (statements 48%, branches 60%, functions 68%, lines 48%) and fails the build on any TypeScript or ESLint error before an image is ever pushed.

---

## Tags

| Tag | Description |
|---|---|
| `latest` | Most recent successful build of `main` |

---

## License

MIT © [Terence Le Grange](https://github.com/terencelegrange/pixxel)
