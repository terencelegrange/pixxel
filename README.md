# Pixxel

**Enterprise Architecture Repository Platform**

[![Docker Pulls](https://img.shields.io/docker/pulls/tlgrange/pixxel.svg)](https://hub.docker.com/r/tlgrange/pixxel)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Pixxel is an open-source, self-hosted web application for registering and managing your organisation's technology assets. It provides a centralised inventory of every application in your portfolio — capturing ownership, lifecycle stage, dependencies, technology tier, and governance metadata — so your architecture practice has a single source of truth.

- **Docker Hub:** [`tlgrange/pixxel`](https://hub.docker.com/r/tlgrange/pixxel)
- **Source Repository:** [github.com/terencelegrange/pixxel](https://github.com/terencelegrange/pixxel)

---

## Quick Start with Docker

The fastest way to get Pixxel running is with Docker. Pixxel requires zero pre-configuration on first boot — it starts up immediately and serves a friendly setup wizard to name your instance, choose your database dialect, and create your initial admin account.

### Option A — SQLite Trial Mode (Fastest evaluation)

No external database required. All data persists inside a single Docker volume:

```bash
docker run -d \
  --name pixxel \
  -p 3000:3000 \
  -v pixxel-data:/app/data \
  -e DB_TYPE=sqlite \
  -e DB_FILE=data/pixxel.db \
  tlgrange/pixxel:latest
```

Open [http://localhost:3000](http://localhost:3000) to begin the first-run setup wizard.

### Option B — MySQL / MariaDB (Recommended for production)

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

### Docker Compose

```yaml
services:
  app:
    image: tlgrange/pixxel:latest
    ports:
      - "3000:3000"
    environment:
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

---

## Features

- **Asset Registry** — Full lifecycle tracking (Ideation to Retirement), classification by domain, strategy, vendor, department, and technology tier.
- **Bulk CSV Import** — Batch upload assets with automatic lookup validation and per-row transaction safety.
- **Architecture Diagrams (Excalidraw)** — Integrated interactive diagramming canvas directly tagged to assets and solutions.
- **PlantUML Diagrams** — Text-based diagram authoring with automated asset tag association.
- **Dependency Mapping** — Interactive ReactFlow visualisations of project dependencies and cross-asset relationships.
- **Planning & Roadmaps** — Project portfolio tracking and investment roadmaps classified by platform over time.
- **Contracts & Cost Tracking** — Vendor contracts management with renewal reminders and complexity-vs-cost analysis.
- **Risk Register & Security** — Comprehensive risk assessments, risk attributes, and visual security quadrant reports.
- **Interactive Reports** — Asset Strategy matrix (domains × strategies), capability coverage, and cost matrices.
- **API Keys & OpenAPI Documentation** — Built-in interactive Swagger UI reference (`/docs`) and programmatic API key management.
- **Audit Logging** — Complete audit trail tracking every create, update, and delete with before/after diffs and attribution.
- **Security & User Management** — Admin, Member, and Viewer roles, bcrypt hashing, and optional TOTP two-factor authentication (MFA).
- **First-Run Wizard & Guided Tour** — Seamless onboarding with automated migrations, dialect selection, and UI tour.
- **Dark Mode** — Toggleable theme with zero-flicker client-side persistence.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 (dark mode enabled) |
| Icons | Lucide React |
| Database | MariaDB / MySQL 8+ & SQLite |
| Database Clients | `mysql2` (pooled) & `node:sqlite` |
| Migrations | Drizzle ORM |
| Diagramming & Canvas | ReactFlow & Excalidraw |
| API Specification | OpenAPI 3.0 via `swagger-ui-react` |
| Authentication | JWT-backed sessions, bcryptjs, otplib / qrcode (MFA) |
| Markdown | `react-markdown` + `remark-gfm` |

---

## Running from Source (Local Development)

### Prerequisites

- Node.js 18+ (tested with Node 20+)
- MariaDB or MySQL 8+ (or SQLite)

### 1. Clone and install dependencies

```bash
git clone https://github.com/terencelegrange/pixxel.git
cd pixxel
npm install
```

### 2. Configure environment variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Configure your database credentials in `.env.local`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=pixxel
```

> `.env.local` is gitignored and must never be committed.

### 3. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first run, the setup wizard will guide you through initializing the database schema and creating the initial admin account.

### Building for production

```bash
npm run build
npm start
```

---

## Environment Variables

| Variable | Applies to | Default | Notes |
|---|---|---|---|
| `JWT_SECRET` | Always | Auto-generated | Optional. ≥ 32 chars. Signs session cookies; persisted to `.jwt-secret` if unset. |
| `DB_TYPE` | Both | `mysql` | `mysql` or `sqlite`. |
| `DB_HOST` | MySQL | — | Required when using pre-configured MySQL. |
| `DB_PORT` | MySQL | `3306` | MySQL port. |
| `DB_USER` | MySQL | — | MySQL user. |
| `DB_PASSWORD`| MySQL | — | MySQL password. |
| `DB_NAME` | MySQL | — | MySQL database name. |
| `DB_FILE` | SQLite | `data/pixxel.db` | Relative path to SQLite file. |
| `PLANTUML_SERVER_URL` | Both | `https://www.plantuml.com/plantuml` | Optional self-hosted PlantUML server endpoint. |

---

## Health Check

Pixxel includes a health check endpoint:

```
GET /api/health
```

Returns `{ "status": "ok" }` (HTTP 200) when the database is connected and operational, or `{ "status": "error" }` (HTTP 503) if unreachable.

---

## Testing

Pixxel is tested with Jest and React Testing Library:

```bash
npm test              # Run unit and UI tests
npm run test:coverage # Run with coverage reports
npm run test:all      # Run all test suites
```

Currently **96 test suites / 594 tests**, all passing.

---

## Project Structure

```
pixxel/
├── app/
│   ├── (auth)/          # Login, registration, MFA routes
│   ├── (dashboard)/     # Protected routes (assets, diagrams, projects, reports, etc.)
│   ├── (setup)/         # First-run setup wizard
│   └── api/             # Next.js API routes & OpenAPI specification
├── components/
│   ├── layout/          # Layout, Navigation, Header, Sidebar, Global Search
│   ├── assets/          # Asset management components & modal forms
│   ├── diagrams/        # Excalidraw canvas & PlantUML diagram viewers
│   ├── projects/        # ReactFlow dependency graphs
│   └── ui/              # Button, Input, Modal, and theme primitives
├── config/              # Navigation, features, and site configuration
├── context/             # AuthContext, ThemeContext, FeatureTierContext
├── drizzle/             # Database schemas & migrations for MySQL and SQLite
├── lib/                 # Database clients, auth, audit, and encryption utilities
└── types/               # TypeScript interfaces and entity types
```

---

## License

MIT © [Terence Le Grange](https://github.com/terencelegrange)
