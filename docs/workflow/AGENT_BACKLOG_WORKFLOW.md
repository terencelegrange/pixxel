# Pixxel — Agent Backlog Workflow

This is the project-specific instance of the generic template at
`/Users/terence/development/workflow.md` on the operator's machine — read
that file for the full explanation of the board mechanics, roles, and
rules. This file only fills in Pixxel's specific values.

## Tracker

| | |
|---|---|
| Tracker | `http://192.168.100.228:3042` |
| Project key | `PIXXEL` |
| Auth | `Authorization: Bearer <key>` (**`X-API-Key` returns 401**) — the key itself lives in `/Users/terence/development/workflow.md` on the operator's machine, never in this repo |
| Repo | `http://192.168.100.252:3000/terence/pixxel.git` |

```bash
export TRACKER_URL=http://192.168.100.228:3042
export TRACKER_KEY=<see /Users/terence/development/workflow.md>

curl -s -H "Authorization: Bearer $TRACKER_KEY" \
  "$TRACKER_URL/api/projects/PIXXEL/issues"
```

## The board

Pixxel has **one** real deploy target today (the `pixxel` Jenkins job →
`192.168.100.228`, effectively production — there is no separate
test/staging environment yet), so the board uses the single-deploy-gate
variant of the template rather than the full test/staging/prod ladder:

| Status (`key`) | Name | Who acts here |
|---|---|---|
| `idea` | Idea | User writes |
| `elab` | Elaborate | Agent picks up |
| `ready` | Dev Ready | User promotes |
| `in_progress` | In Progress | Agent picks up |
| `in_review` | In Review | Agent moves here when done |
| `deploy` | Ready to deploy | User promotes (the one gate) |
| `done` | Done | Agent moves here once deployed + verified |

The agent never sets `deploy` itself — same rule as the generic template.
If a second environment (e.g. a staging box) is ever added, add a
`deploystg`/`instg` pair ahead of `deploy` and follow the generic
template's trigger/resting pattern from there.

## Project-specific conventions

- **Build/verify commands** (run all of these before moving a card to
  `in_review`):
  ```bash
  npx tsc --noEmit
  npm run lint
  npm test
  npm run build
  ```
- **API documentation**: any card that adds or changes an API route must
  update `openapi.yaml` in the same commit — see CLAUDE.md's "API
  documentation" section for the exact convention. Treat this the same as
  the build/verify commands above: a route change isn't done until the
  spec reflects it.
- **Breaking API changes get a new version**: if a route uplift would break
  an existing consumer's backwards compatibility, don't change the route
  in place — add it under a new `/api/v2/...` path instead and leave the
  original route working. See CLAUDE.md's "API documentation" section for
  what counts as breaking vs. additive.
- **Migrations**: edit `drizzle/schema.ts` **and** `drizzle/schema.sqlite.ts`
  together, then `npx drizzle-kit generate` (MySQL) and the sqlite
  equivalent — see `CLAUDE.md`'s "Schema migrations" section. Applied
  automatically by `setupDatabase()` on boot against the dev DB; there is
  no separate test/staging DB to replay migrations against yet (see
  "Deploy mechanism" below).
- **Feature shape**: a typical feature is one or more `app/api/**/route.ts`
  handlers (`requireUser(req, role?)` + try/catch + `logger.error` on
  failure + `writeAudit()` after writes) plus a client page under
  `app/(dashboard)/**`. Follow the shape of the most recently built
  comparable feature (e.g. `app/api/profile/preferences/route.ts` for a
  partial-update pattern, `app/(dashboard)/settings/security/page.tsx` for
  a multi-step settings page) rather than inventing a new one.
- **Deploy mechanism (the one `deploy` environment)**: pushing to `main`
  on the Gitea remote trips a webhook (`PIXXEL_WEBHOOK_TOKEN`) that
  triggers the `pixxel` Jenkins job. That job runs the full verify suite,
  writes `.env.production` from Jenkins credentials, rsyncs the repo to
  `192.168.100.228:/home/pixxel`, rebuilds and restarts the Docker Compose
  stack there, and health-checks `http://<host>:3030/api/health` (host
  port **3030**, not 3000 — 3000 is already used by Grafana on that host).
  Verify a deploy by hitting that health endpoint and reading the body,
  not just watching for a green Jenkins build.
- **Docker Hub image publish**: `scripts/build-and-push.sh` is the primary
  way to publish a multi-arch (`linux/amd64`+`linux/arm64`) image to
  `tlgrange/pixxel` — run it from an Apple Silicon Mac with `docker login`
  already done. It builds natively for arm64 and via Rosetta for amd64,
  taking under 4 minutes total; the old Jenkins path
  (`pixxel-dockerhub`, QEMU-emulated on an amd64 agent) took 3h25m for the
  same multi-arch build and is kept only as a spare/fallback, not the
  primary path — check `PIXXEL-1` in the tracker before touching it, it
  has a known OOM issue on the Jenkins Proxmox build agent.
- **Repo-specific gotchas**:
  - Next.js 15 dynamic route params are `Promise<{id: string}>`, must be
    `await`ed — `tsc --noEmit` does **not** catch a missed `await` here,
    only `next build`'s route validation does. Always run the full build
    before calling a route-touching card verified.
  - `key` is a reserved word in MySQL/MariaDB — never write raw SQL with
    an unquoted `key` column; use the `quote()` helper in
    `lib/sql-compat.ts`.
  - Both `drizzle/schema.ts` (MySQL) and `drizzle/schema.sqlite.ts`
    (SQLite mirror) must be updated together for any schema change — the
    test suite's unit project runs against neither DB directly, but the
    integration suite and dev boot both depend on them staying in sync.

## Notification model

No webhook from the tracker back to a session. Default: the user tells
the session directly when a card lands in `ready` or `deploy`. A polling
loop (schedule a wakeup every 15–30 min) is the fallback for unattended
runs — see the generic template for the mechanics.
