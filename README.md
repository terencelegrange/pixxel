# Pixel

**Enterprise Architecture Repository Platform**

Pixel is an open-source web application for registering and managing your organisation's technology assets. It gives you a centralised inventory of every application in your portfolio — capturing ownership, lifecycle stage, dependencies, technology tier, and governance metadata — so your architecture practice has a single source of truth.

---

## Features

- **Asset Registry** — Full CRUD for applications with type, lifecycle status, tier, domain, strategy, vendor, and department classification
- **Project dependency mapping** — Link assets to projects as upstream or downstream dependencies; visualise them as an interactive ReactFlow diagram
- **Audit log** — Every create, update, and delete is recorded with before/after diffs and the acting user
- **Reports** — Asset Strategy matrix (domains × strategies) with colour-coded coverage dots
- **User management** — Admin / Member / Viewer roles; bcrypt password hashing
- **Dark mode** — Toggleable via Settings → Appearance; persisted to localStorage with no flash on load
- **Vendors, Domains, Tiers, Departments** — Full reference-data management to classify assets consistently
- **Support & Feedback** — In-app support form; admin feedback viewer with status workflow
- **Setup wizard** — First-run wizard to configure the platform name and initial admin account

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| Database client | mysql2 (promise API) |
| Password hashing | bcryptjs (cost factor 12) |
| Auth state | React Context + localStorage |
| Database | MariaDB / MySQL |
| Charts | Recharts |
| Flow diagrams | ReactFlow |
| Markdown | react-markdown + remark-gfm |

---

## Prerequisites

- Node.js 18+
- MariaDB or MySQL 8+

---

## Installation

```bash
git clone https://github.com/terencelegrange/pixel.git
cd pixel
npm install
```

### 1. Create the database

```sql
CREATE DATABASE pixel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Configure environment variables

Copy the example file and fill in your database credentials:

```bash
cp .env.local.example .env.local
```

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=pixel
```

> `.env.local` is gitignored and must never be committed.

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first run you will be redirected to the setup wizard to name your instance and create the initial admin account. The database schema is created automatically on startup.

---

## Building for production

```bash
npm run build
npm start
```

---

## Project structure

```
pixel/
├── app/
│   ├── (auth)/          # Login and register pages
│   ├── (dashboard)/     # All protected app routes
│   │   ├── assets/      # Asset registry
│   │   ├── projects/    # Projects and dependency diagrams
│   │   ├── reports/     # Asset strategy matrix
│   │   ├── audit/       # Audit log viewer
│   │   ├── settings/    # Roles, appearance, feedback
│   │   └── docs/        # In-app documentation
│   ├── (setup)/         # First-run setup wizard
│   └── api/             # Next.js API routes
├── components/
│   ├── layout/          # DashboardLayout, Header, Sidebar
│   ├── assets/          # AssetModal, AssetIcon
│   ├── projects/        # DependencyFlow (ReactFlow)
│   └── ui/              # Button, Input, Modal primitives
├── config/
│   └── navigation.ts    # Add/remove sidebar nav items here
├── context/             # AuthContext, ThemeContext
├── lib/                 # db.ts, auth.ts, audit.ts
└── types/               # Shared TypeScript interfaces
```

---

## Configuration

Navigation items are driven entirely by [`config/navigation.ts`](config/navigation.ts) — add or remove sidebar links without touching layout components.

The sidebar icon for each nav item is resolved dynamically from `lucide-react` by its PascalCase name string.

---

## License

MIT © [Terence Le Grange](https://github.com/terencelegrange)
