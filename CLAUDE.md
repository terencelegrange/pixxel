# Origin Halo — Enterprise Architecture Repository Platform

## Purpose

A web-based platform for registering and managing enterprise applications, tracking their full lifecycle — from ideation through retirement. Provides a centralised inventory of all applications in an organisation, capturing ownership, technology, status, dependencies, and governance metadata.

---

## Development Environment

- **Runtime:** Node.js v25.8.1 via Homebrew (`/opt/homebrew/Cellar/node/25.8.1_1/bin/node`)
- Node is **not symlinked** to PATH — add `export PATH="/opt/homebrew/bin:$PATH"` to `~/.zshrc` or prefix commands directly
- **Database:** MariaDB on `localhost:3306` (Docker container)
- **Database credentials:** stored in `.env.local` (gitignored — never commit this file)

```bash
# Start dev server
npm run dev          # http://localhost:3000

# Type check
npx tsc --noEmit
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 (`darkMode: "class"`) |
| Icons | Lucide React |
| Database client | mysql2 (promise API) |
| Password hashing | bcryptjs (cost factor 12) |
| Auth state | React Context API + localStorage |
| Theme state | React Context API + localStorage (`ThemeContext`) |
| Database | MariaDB |
| Charts | Recharts (dashboard bar chart) |
| Flow diagrams | ReactFlow / reactflow (project dependency map) |
| Markdown rendering | react-markdown + remark-gfm + @tailwindcss/typography |

---

## Directory Structure

```
saas-boilerplate/
├── app/
│   ├── (auth)/                   # Unauthenticated routes (centered card layout)
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/              # Protected routes — redirect to /login if unauthenticated
│   │   ├── layout.tsx            # Mounts DashboardLayout (auth guard lives here)
│   │   ├── dashboard/page.tsx    # Bar chart: assets by tier; published departments count
│   │   ├── assets/
│   │   │   ├── page.tsx          # Asset registry list — filter, create, edit, delete; name links to detail
│   │   │   └── [id]/page.tsx     # Asset detail — info sections, edit/delete, audit history
│   │   ├── projects/
│   │   │   ├── page.tsx          # Projects list — create/edit/delete; status filter; links to detail
│   │   │   └── [id]/page.tsx     # Project detail — hero card + asset dependency panel (List / Flow tab)
│   │   ├── organisations/page.tsx # Department CRUD
│   │   ├── vendors/page.tsx      # Vendor CRUD — contact details, address, primary contact + role
│   │   ├── domains/page.tsx      # Domain CRUD
│   │   ├── asset-strategy/page.tsx # Asset Strategy CRUD (with sort_order)
│   │   ├── tiers/page.tsx        # Tier CRUD (name, description, SLA, support hours, response/resolution times)
│   │   ├── users/page.tsx        # User management — add (with password), edit name/role, delete; roles: Admin/Member/Viewer
│   │   ├── support/page.tsx      # Support form — users submit Feature Requests, Report Requests, Bugs, Other
│   │   ├── reports/
│   │   │   └── assets-by-domain/page.tsx  # Asset Strategy matrix report (domains × strategies)
│   │   ├── audit/page.tsx        # Audit log viewer — paginated, filterable, expandable diffs
│   │   ├── docs/page.tsx         # Documentation — Server Component; reads CLAUDE.md with fs/promises; renders via react-markdown + remark-gfm; sticky TOC sidebar (xl+)
│   │   ├── profile/page.tsx
│   │   └── settings/
│   │       ├── page.tsx          # Settings hub — Appearance toggle; tile grid linking to sub-pages
│   │       ├── roles/page.tsx    # Roles CRUD — name, description, permission level (read-only/member/admin)
│   │       └── feedback/page.tsx # Feedback viewer (admin) — status filter, inline status update
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts    # POST /api/auth/login
│   │   │   └── register/route.ts # POST /api/auth/register
│   │   ├── dashboard/
│   │   │   └── stats/route.ts    # GET — published departments + assets by tier (LEFT JOIN tiers)
│   │   ├── assets/
│   │   │   ├── route.ts          # GET (list + GROUP_CONCAT dept + vendor/domain/strategy/tier JOINs) + POST
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET single + PUT (update) + DELETE
│   │   │       └── history/route.ts # GET audit_log entries for this asset
│   │   ├── vendors/
│   │   │   ├── route.ts          # GET + POST
│   │   │   └── [id]/route.ts     # PUT + DELETE (nulls vendor_id on assets first)
│   │   ├── organisations/
│   │   │   ├── route.ts          # GET + POST
│   │   │   └── [id]/route.ts     # PUT + DELETE
│   │   ├── domains/
│   │   │   ├── route.ts          # GET + POST
│   │   │   └── [id]/route.ts     # PUT + DELETE (nulls domain_id on assets first)
│   │   ├── asset-strategy/
│   │   │   ├── route.ts          # GET (ORDER BY sort_order IS NULL, sort_order ASC, name ASC) + POST
│   │   │   └── [id]/route.ts     # PUT + DELETE (nulls strategy_id on assets first)
│   │   ├── tiers/
│   │   │   ├── route.ts          # GET + POST
│   │   │   └── [id]/route.ts     # PUT + DELETE (nulls tier_id on assets first)
│   │   ├── users/
│   │   │   ├── route.ts          # GET (list, password excluded) + POST (create with bcrypt password)
│   │   │   └── [id]/route.ts     # PUT (name + role) + DELETE (blocks self-delete)
│   │   ├── roles/
│   │   │   ├── route.ts          # GET + POST
│   │   │   └── [id]/route.ts     # PUT + DELETE (blocks if users assigned)
│   │   ├── support/
│   │   │   ├── route.ts          # GET (all submissions) + POST (create, status defaults to 'New')
│   │   │   └── [id]/route.ts     # PATCH (update status)
│   │   └── projects/
│   │       ├── route.ts          # GET (list with asset count) + POST
│   │       └── [id]/
│   │           ├── route.ts      # PUT + DELETE (cascades project_assets)
│   │           └── assets/
│   │               ├── route.ts          # GET (linked assets with metadata) + POST (link asset)
│   │               └── [assetId]/route.ts # PATCH (update dependency_type/notes) + DELETE (unlink)
│   ├── globals.css
│   ├── layout.tsx                # Root layout — mounts ThemeProvider + AuthProvider; inline script for no-FOUC dark mode
│   └── page.tsx                  # Root redirect → /dashboard or /login
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── layout/
│   │   ├── DashboardLayout.tsx   # Auth guard + responsive shell; dark:bg-slate-950
│   │   ├── Header.tsx            # Sticky top bar; bell icon (admin only) polls /api/support for 'New' count; avatar dropdown
│   │   └── Sidebar.tsx           # Config-driven nav, mobile overlay; dark mode aware
│   ├── assets/
│   │   └── AssetModal.tsx        # Full create/edit modal; exports AssetIcon + LIFECYCLE_STATUSES; includes tier/strategy/domain/vendor dropdowns
│   ├── projects/
│   │   └── DependencyFlow.tsx    # ReactFlow diagram — project hub node + upstream/downstream asset nodes; lazy-loaded (ssr: false)
│   └── ui/
│       ├── Button.tsx            # Variants: primary / secondary / ghost / danger
│       ├── Input.tsx             # Label, error, hint, showToggle (show/hide password)
│       └── Modal.tsx             # Reusable overlay modal (Escape to close, body scroll lock)
├── config/
│   └── navigation.ts             # ← Edit this to add/remove sidebar menu items
├── context/
│   ├── AuthContext.tsx           # useAuth hook; rehydrates from localStorage on mount
│   └── ThemeContext.tsx          # useTheme hook; persists "light"/"dark" to localStorage; toggles `dark` class on <html>
├── lib/
│   ├── audit.ts                  # Server-only: writeAudit() helper — call after every write
│   ├── auth.ts                   # Client-side: localStorage helpers + fetch to API routes
│   └── db.ts                     # Server-only: mysql2 pool singleton + setupDatabase()
└── types/
    └── index.ts                  # Shared TypeScript interfaces (Asset, Project, ProjectAsset, Role, etc.)
```

---

## Navigation Structure

```
(no group)     Dashboard, Profile
Assets         Asset Registry, Projects
Reports        Asset Strategy (matrix report: domains × strategies)
Manage         Departments, Domains, Asset Strategy, Vendors, Tier, Users, Settings, Audit
Resources      Documentation, Support
```

Navigation is driven entirely by `config/navigation.ts`. Icons resolved dynamically from `lucide-react` by PascalCase name string. Sign-out in header avatar dropdown.

### Settings sub-pages (tile grid at `/settings`)
| Tile | Route | Status |
|---|---|---|
| Roles | `/settings/roles` | Live |
| Feedback | `/settings/feedback` | Live — Admin only |
| General | — | Placeholder |
| Notifications | — | Placeholder |
| Security | — | Placeholder |
| Integrations | — | Placeholder |

---

## Database

### Connection
Configured via environment variables in `.env.local`:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<see .env.local>
DB_NAME=saas_app
```

### Schema (current)

#### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` | Full display name |
| `email` | `VARCHAR(255)` UNIQUE | Normalised to lowercase on write |
| `password` | `VARCHAR(255)` | bcrypt hash only — plaintext never stored |
| `role` | `VARCHAR(50)` | Default: `Member`. Values: `Admin`, `Member`, `Viewer` |
| `role_id` | `CHAR(36)` NULL | FK → `roles.id` (legacy column — no longer used in UI) |
| `created_at` | `DATETIME` | Auto-set on insert |
| `updated_at` | `DATETIME` | Auto-updated on row change |

#### `departments`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` UNIQUE | |
| `description` | `TEXT` NULL | |
| `status` | `ENUM('Published','Unpublished')` | Default: `Unpublished` |
| `created_by_id/name` | | Denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | Auto-managed |

#### `domains`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` UNIQUE | e.g. Application Architecture, Infrastructure |
| `description` | `TEXT` NULL | |
| `created_by_id/name` | | Denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | Auto-managed |

#### `asset_strategies`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` UNIQUE | e.g. Emerging, Adopting, Productionised, Phasing Out |
| `description` | `TEXT` NULL | |
| `sort_order` | `INT UNSIGNED` NULL | Controls column order in the strategy report; NULLs sort last |
| `created_by_id/name` | | Denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | Auto-managed |

#### `tiers`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` UNIQUE | e.g. Tier 1, Gold, Critical |
| `description` | `TEXT` NULL | |
| `sla_availability` | `VARCHAR(50)` NULL | e.g. 99.9% |
| `support_hours` | `VARCHAR(100)` NULL | e.g. 24x7 |
| `response_time` | `VARCHAR(100)` NULL | e.g. 15 minutes |
| `resolution_time` | `VARCHAR(100)` NULL | e.g. 4 hours |
| `created_by_id/name` | | Denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | Auto-managed |

#### `roles`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` UNIQUE | Custom role label |
| `description` | `TEXT` NULL | |
| `permission_level` | `ENUM('read-only','member','admin')` | Default: `member` |
| `created_by_id/name` | | Denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | Auto-managed |

#### `support_requests`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `user_id` | `CHAR(36)` | Submitting user ID |
| `user_name` | `VARCHAR(255)` | Submitting user name |
| `type` | `ENUM('Feature Request','Report Request','Bug','Other')` | Default: `Feature Request` |
| `subject` | `VARCHAR(500)` | |
| `description` | `TEXT` NULL | |
| `status` | `ENUM('New','Acknowledged','Under Review','Will Fix','Will Not Implement','Completed')` | Default: `New` |
| `created_at` | `DATETIME` | Auto-set on insert |

#### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` | |
| `description` | `TEXT` NULL | |
| `status` | `ENUM('Active','On Hold','Completed','Cancelled')` | Default: `Active` |
| `start_date` | `DATE` NULL | |
| `end_date` | `DATE` NULL | |
| `created_by_id/name` | | Denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | Auto-managed |

#### `project_assets`
| Column | Type | Notes |
|---|---|---|
| `project_id` | `CHAR(36)` PK (composite) | FK → `projects.id` |
| `asset_id` | `CHAR(36)` PK (composite) | FK → `assets.id` |
| `dependency_type` | `ENUM('upstream','downstream')` | Direction of the dependency |
| `notes` | `TEXT` NULL | Description of the relationship |

#### `audit_log`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `table_name` | `VARCHAR(100)` | e.g. `assets`, `tiers`, `users`, `projects` |
| `record_id` | `CHAR(36)` | ID of affected row |
| `action` | `ENUM('CREATE','UPDATE','DELETE')` | |
| `performed_by_id` | `CHAR(36)` | User ID |
| `performed_by_name` | `VARCHAR(255)` | User name at time of action |
| `performed_at` | `DATETIME` | Auto-set on insert |
| `old_values` | `JSON` NULL | Before state (null for CREATE) |
| `new_values` | `JSON` NULL | After state (null for DELETE) |

> `setupDatabase()` auto-creates all tables and runs idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` live migrations on every boot.
> All write operations call `writeAudit()` after the DB write.
> Covered tables: `assets`, `departments`, `domains`, `asset_strategies`, `tiers`, `vendors`, `users`, `roles`, `projects`

#### `assets`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` | |
| `short_code` | `VARCHAR(50)` NULL | |
| `description` | `TEXT` NULL | |
| `type` | `ENUM('SaaS','On-Premise','Hybrid','Cloud','Open Source','Other')` | |
| `category` | `VARCHAR(100)` | Default `Application` |
| `icon` | `VARCHAR(100)` | Lucide icon name — default `Server` |
| `tier_id` | `CHAR(36)` FK → `tiers.id` NULL | |
| `strategy_id` | `CHAR(36)` FK → `asset_strategies.id` NULL | |
| `domain_id` | `CHAR(36)` FK → `domains.id` NULL | |
| `vendor_id` | `CHAR(36)` FK → `vendors.id` NULL | |
| `lifecycle_status` | `ENUM('Proposed','Approved','In Development','Production','Sunset','Retired')` | |
| `business_owner` | `VARCHAR(255)` NULL | |
| `technical_owner` | `VARCHAR(255)` NULL | |
| `sla_availability` | `VARCHAR(50)` NULL | |
| `sla_rto` | `VARCHAR(100)` NULL | Recovery Time Objective |
| `sla_rpo` | `VARCHAR(100)` NULL | Recovery Point Objective |
| `go_live_date` | `DATE` NULL | |
| `retirement_date` | `DATE` NULL | |
| `contract_end_date` | `DATE` NULL | |
| `contract_amount` | `DECIMAL(15,2)` NULL | Formatted as USD in UI |
| `app_url` | `VARCHAR(500)` NULL | |
| `doc_url` | `VARCHAR(500)` NULL | Documentation link |
| `notes` | `TEXT` NULL | |
| `created_by_id/name` | | Denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | Auto-managed |

> Departments via `asset_departments` junction. FK columns use `UPDATE assets SET x_id = NULL WHERE x_id = ?` before deleting a lookup row.
> Asset list GET uses GROUP_CONCAT + LEFT JOINs to all lookup tables in one query.
> Asset list table shows: Asset name, Type badge, Tier, Strategy, Lifecycle badge, Actions.

#### `asset_departments`
| Column | Type | Notes |
|---|---|---|
| `asset_id` | `CHAR(36)` PK (composite) | FK → `assets.id` |
| `department_id` | `CHAR(36)` PK (composite) | FK → `departments.id` |

#### `vendors`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(255)` | |
| `website` | `VARCHAR(500)` NULL | |
| `email` | `VARCHAR(255)` NULL | |
| `phone` | `VARCHAR(100)` NULL | |
| `address_line1/2`, `city`, `state_province`, `country`, `postal_code` | | Address fields |
| `primary_contact_name` | `VARCHAR(255)` NULL | |
| `primary_contact_role` | `VARCHAR(100)` NULL | e.g. Customer Success Manager, Account Manager |
| `primary_contact_email` | `VARCHAR(255)` NULL | |
| `primary_contact_phone` | `VARCHAR(100)` NULL | |
| `notes` | `TEXT` NULL | |
| `created_by_id/name` | | Denormalised creator |
| `created_at` / `updated_at` | `DATETIME` | Auto-managed |

---

## Dark Mode

- Tailwind config: `darkMode: "class"`
- `context/ThemeContext.tsx` — `ThemeProvider` persists `"light"/"dark"` to localStorage; `toggleTheme()` adds/removes `dark` class on `<html>`; `useTheme()` hook
- `app/layout.tsx` — inline `<script>` runs before hydration to apply stored theme (prevents flash of wrong theme)
- Shell components (`DashboardLayout`, `Sidebar`, `Header`) have `dark:` Tailwind variants
- Page content components do **not** have dark variants — only the shell is themed
- Toggle lives in **Settings → Appearance** (light/dark mode cards + toggle switch)

---

## Authentication

### Flow
1. User submits `LoginForm` or `RegisterForm`
2. Client calls `loginUser()` / `registerUser()` in `lib/auth.ts`
3. These `fetch` `POST /api/auth/login` or `POST /api/auth/register`
4. API routes run server-side: query MariaDB, bcrypt compare/hash, return `User` object (no password)
5. `AuthContext` stores the user in React state and persists to `localStorage`
6. On page refresh, `AuthContext` rehydrates from `localStorage` — no round-trip needed

### Security notes
- Passwords hashed with bcrypt cost factor **12**
- Login uses a constant-time code path even when the email doesn't exist (prevents user enumeration)
- `.env.local` is gitignored

### Roles
| Role | How assigned | Notes |
|---|---|---|
| `Admin` | Set via Users page | Sees notification bell; can access Feedback viewer |
| `Member` | Default on registration | Standard user |
| `Viewer` | Set via Users page | Read-only intent (guards not yet enforced) |

> Role is stored as a plain `VARCHAR` on `users.role`. No route-level guards are implemented yet — all authenticated users can access all routes.

---

## Header — Notification Bell

- Renders **only for Admin** users (`user.role === "Admin"`)
- Polls `GET /api/support` every 60 seconds via `useCallback` + `setInterval`
- Counts submissions with `status === "New"` and displays a red badge (shows `9+` if > 9)
- Dropdown panel shows count card with link to `/settings/feedback`
- Outside-click detection via `useRef` + `mousedown` listener (independent of avatar dropdown)

---

## Projects — Dependency Flow

- **`/projects`** — list page; status filter (Active / On Hold / Completed / Cancelled); create/edit/delete
- **`/projects/[id]`** — detail page with two views toggled via **List / Flow** buttons:
  - **List view** — grouped by upstream / downstream with inline edit and remove
  - **Flow view** — ReactFlow diagram loaded client-side (`dynamic(() => ..., { ssr: false })`)
- **`DependencyFlow` component** (`components/projects/DependencyFlow.tsx`):
  - Custom `ProjectNode` — centre hub, colour-coded by status
  - Custom `AssetNode` — lifecycle dot badge, tier label, optional notes
  - Upstream assets → left column → animated violet edges → project
  - Project → animated sky-blue edges → right column → downstream assets
  - Draggable nodes, fit-to-view on load, zoom/pan via ReactFlow `Controls`

---

## Implemented Features

- [x] User registration + login (bcrypt, MariaDB)
- [x] Protected dashboard routes with auth guard
- [x] Persistent login state (localStorage)
- [x] Profile page
- [x] Responsive dashboard layout (sticky header, collapsible sidebar)
- [x] Config-driven sidebar navigation (`config/navigation.ts`)
- [x] Header avatar dropdown — Profile link + Sign out; shows user name and role
- [x] Header notification bell — Admin only; polls for new feedback submissions; dropdown with count and link
- [x] Dark / light mode toggle — `ThemeContext`, Tailwind `darkMode: "class"`, Settings → Appearance
- [x] Department management — full CRUD at `/organisations`
- [x] Domain management — full CRUD at `/domains`
- [x] Asset Strategy management — full CRUD at `/asset-strategy`; `sort_order` field controls report column sequence
- [x] Tier management — full CRUD at `/tiers`; fields: name, description, SLA availability, support hours, response time, resolution time
- [x] Vendor management — full CRUD at `/vendors`; primary contact includes role dropdown
- [x] User management — add user (with password + role), edit name/role, delete (cannot self-delete); roles: Admin / Member / Viewer; audited
- [x] Asset Registry — full CRUD at `/assets`; all lookup fields (tier, strategy, domain, vendor, departments); audited
- [x] Asset fields: doc_url (documentation link), contract_end_date, contract_amount (USD)
- [x] Asset list table columns: Asset name, Type, Tier, Strategy, Lifecycle, Actions
- [x] Asset detail page (`/assets/[id]`) — hero card, info sections (incl. contract + doc URL), audit history
- [x] Reports → Asset Strategy matrix (`/reports/assets-by-domain`) — domains as row groups, strategies as columns, colour-coded dots
- [x] Audit log viewer (`/audit`) — paginated, filters (table, action, user), expandable field diffs; covers all entities
- [x] `AssetModal` — reusable create/edit modal with sections: Basic Info, Ownership (dept checkboxes, tier, strategy, domain, vendor), SLA & Dates (incl. contract), Links & Notes (incl. doc URL), Appearance (icon picker)
- [x] `AssetIcon` — resolves Lucide icon by name string; used in list, detail, and modal
- [x] Dashboard — bar chart of assets grouped by tier (Recharts); published departments count
- [x] Support form (`/support`) — users submit feature requests, report requests, bugs, other; status defaults to `New`
- [x] Settings hub (`/settings`) — Appearance section + clickable tile grid linking to sub-pages
- [x] Roles management (`/settings/roles`) — CRUD for custom roles with permission levels (read-only / member / admin); delete blocked if users assigned
- [x] Feedback viewer (`/settings/feedback`) — Admin only; lists all support submissions; filter by status/type; inline status update via PATCH
- [x] Projects (`/projects`) — CRUD; status (Active / On Hold / Completed / Cancelled); start/end dates
- [x] Project asset dependencies (`/projects/[id]`) — link assets as upstream or downstream; notes per link; edit/remove inline
- [x] Project dependency flow diagram — ReactFlow visualisation; project hub + upstream/downstream asset nodes; animated directional edges; lazy-loaded
- [x] Documentation page (`/docs`) — Server Component; renders `CLAUDE.md` via `react-markdown` + `remark-gfm`; sticky TOC sidebar built from `##` headings; custom component renderers for tables, code blocks, blockquotes

## Not Yet Implemented

- [ ] Role-based access control guards (routes are currently open to all authenticated users)
- [ ] Asset-to-asset dependency mapping (independent of projects)
- [ ] Lifecycle stage management and transitions
- [ ] Full-text search across assets
- [ ] Password reset / forgot password flow
- [ ] Email verification on registration
- [ ] CSV / PDF export
