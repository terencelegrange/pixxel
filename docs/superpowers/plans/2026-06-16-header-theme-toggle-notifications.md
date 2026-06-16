# Header Theme Toggle + General Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a theme toggle icon and a general-purpose notifications bell to the header, backed by a new `notifications` table with per-user read tracking — no creation form, rows are seeded directly.

**Architecture:** Two new tables (`notifications`, `notification_reads`) added to the existing `setupDatabase()` bootstrap in `lib/db.ts`; one new GET route to fetch notifications + unread count, one new POST route to mark them read; two new small client components (`ThemeToggleButton`, `NotificationsBell`) wired into the existing `Header.tsx` icon cluster, leaving the existing admin feedback bell untouched.

**Tech Stack:** Next.js 14 (App Router), TypeScript, mysql2/promise, Tailwind CSS, lucide-react icons, React Context (`ThemeContext`, `AuthContext`).

---

### Task 1: Add `notifications` and `notification_reads` tables + seed data

**Files:**
- Modify: `lib/db.ts:591` (append before the final closing `}` of `runSetup()`, right after the `utilityCaps` seeding loop)

- [ ] **Step 1: Add the two `CREATE TABLE` statements and seed data**

Open `lib/db.ts` and find the end of the `utilityCaps` loop (the `for (const [id, name, description, sortOrder] of utilityCaps) { ... }` block, ending at line 591). Add this immediately after that closing `}`, still inside `runSetup()`:

```ts
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          CHAR(36)     NOT NULL,
      title       VARCHAR(255) NOT NULL,
      message     TEXT         NULL,
      type        ENUM('info','warning','error','success') NOT NULL DEFAULT 'info',
      link        VARCHAR(500) NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id CHAR(36) NOT NULL,
      user_id          CHAR(36) NOT NULL,
      read_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id, user_id),
      KEY idx_notification_reads_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Seed: sample notifications (no creation form exists yet — rows are seeded directly)
  await db.execute(`
    INSERT IGNORE INTO notifications (id, title, message, type, link) VALUES
      ('notif001-0000-0000-0000-000000000001', 'Welcome to Origin Halo', 'Thanks for signing up! Explore the Asset Registry to get started.', 'info', NULL),
      ('notif001-0000-0000-0000-000000000002', 'Scheduled maintenance', 'The platform will be briefly unavailable this weekend for database maintenance.', 'warning', NULL),
      ('notif001-0000-0000-0000-000000000003', 'New feature: Project dependency diagrams', 'You can now visualise upstream/downstream asset dependencies for any project.', 'success', '/projects')
  `);
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (this is a pure addition of `db.execute` calls already typed elsewhere in the file).

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add notifications and notification_reads tables with seed data"
```

---

### Task 2: Add `Notification` type and the `GET /api/notifications` route

**Files:**
- Modify: `types/index.ts` (append at end of file)
- Create: `app/api/notifications/route.ts`

- [ ] **Step 1: Add the `Notification` type**

Append to the end of `types/index.ts`:

```ts
export type NotificationType = "info" | "warning" | "error" | "success";

export interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: NotificationType;
  link: string | null;
  createdAt: string;
  isRead: boolean;
}
```

- [ ] **Step 2: Create the GET route**

Create `app/api/notifications/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";

// GET /api/notifications?userId=<id> — latest 20 notifications + per-user read state
export async function GET(req: NextRequest) {
  try {
    await setupDatabase();
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT n.id, n.title, n.message, n.type, n.link, n.created_at,
              (nr.user_id IS NOT NULL) AS is_read
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 20`,
      [userId]
    );

    const [countRows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS unread_count
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = ?
       WHERE nr.user_id IS NULL`,
      [userId]
    );

    const toISO = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
    const notifications = rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message ?? null,
      type: r.type,
      link: r.link ?? null,
      createdAt: toISO(r.created_at)!,
      isRead: Boolean(r.is_read),
    }));

    return NextResponse.json({
      notifications,
      unreadCount: Number(countRows[0]?.unread_count ?? 0),
    });
  } catch (err) {
    console.error("[GET /api/notifications]", err);
    return NextResponse.json({ error: "Failed to load notifications." }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Start the dev server if not already running**

Run: `npm run dev` (in background if needed) — wait for `Ready` in the output, default port 3000.

- [ ] **Step 5: Verify the route manually with curl**

You need a valid `userId` to test with. Get one by registering or logging in via the existing auth API, or by inspecting an existing user. If you don't have one handy, register a test user first:

Run:
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test-notif@example.com","password":"testpass123"}'
```
Expected: JSON response containing a `user` object with an `id` field. Copy that `id`.

Then run (substituting the id):
```bash
curl -s "http://localhost:3000/api/notifications?userId=<the-id>"
```
Expected: JSON with `"notifications"` array containing 3 items (Welcome, Scheduled maintenance, New feature) and `"unreadCount": 3`.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts app/api/notifications/route.ts
git commit -m "feat: add Notification type and GET /api/notifications route"
```

---

### Task 3: Add `POST /api/notifications/mark-read` route

**Files:**
- Create: `app/api/notifications/mark-read/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/notifications/mark-read/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";

// POST /api/notifications/mark-read — bulk-mark notifications as read for a user
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { userId, notificationIds } = body as { userId?: string; notificationIds?: string[] };

    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 401 });
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ success: true }); // nothing to mark
    }

    const db = getDb();
    const values = notificationIds.map((id) => [id, userId]);
    const placeholders = values.map(() => "(?, ?)").join(", ");
    const flatValues = values.flat();

    await db.execute(
      `INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES ${placeholders}`,
      flatValues
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/notifications/mark-read]", err);
    return NextResponse.json({ error: "Failed to mark notifications as read." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Verify manually with curl**

Using the same `userId` from Task 2 Step 5:

```bash
curl -s -X POST http://localhost:3000/api/notifications/mark-read \
  -H "Content-Type: application/json" \
  -d '{"userId":"<the-id>","notificationIds":["notif001-0000-0000-0000-000000000001","notif001-0000-0000-0000-000000000002","notif001-0000-0000-0000-000000000003"]}'
```
Expected: `{"success":true}`

Then re-run the GET from Task 2 Step 5:
```bash
curl -s "http://localhost:3000/api/notifications?userId=<the-id>"
```
Expected: `"unreadCount": 0` and every notification's `"isRead": true`.

- [ ] **Step 4: Commit**

```bash
git add app/api/notifications/mark-read/route.ts
git commit -m "feat: add POST /api/notifications/mark-read route"
```

---

### Task 4: Add `ThemeToggleButton` component

**Files:**
- Create: `components/layout/ThemeToggleButton.tsx`

- [ ] **Step 1: Create the component**

Create `components/layout/ThemeToggleButton.tsx`:

```tsx
"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/ThemeToggleButton.tsx
git commit -m "feat: add ThemeToggleButton component"
```

---

### Task 5: Add `NotificationsBell` component

**Files:**
- Create: `components/layout/NotificationsBell.tsx`

- [ ] **Step 1: Create the component**

Create `components/layout/NotificationsBell.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Megaphone, Info, AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Notification, NotificationType } from "@/types";

const TYPE_ICON: Record<NotificationType, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertOctagon,
  success: CheckCircle2,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  info: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30",
  warning: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
  error: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
  success: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silently ignore
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && user && notifications.length > 0) {
      try {
        await fetch("/api/notifications/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, notificationIds: notifications.map((n) => n.id) }),
        });
        fetchNotifications();
      } catch {
        // silently ignore
      }
    }
  }

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Megaphone className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 rounded-xl border border-slate-200 bg-white shadow-lg z-50 dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</p>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-slate-400">
              <Megaphone className="h-8 w-8 text-slate-200 dark:text-slate-700" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type];
                const content = (
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${TYPE_COLOR[n.type]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                      {n.message && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/NotificationsBell.tsx
git commit -m "feat: add NotificationsBell component"
```

---

### Task 6: Wire both components into `Header.tsx`

**Files:**
- Modify: `components/layout/Header.tsx:5` (imports)
- Modify: `components/layout/Header.tsx:87-88` (icon cluster)

- [ ] **Step 1: Add the imports**

In `components/layout/Header.tsx`, after the existing `lucide-react` import line (line 5):

```tsx
import { Bell, Menu, Search, UserCircle, LogOut, MessageSquare } from "lucide-react";
import ThemeToggleButton from "./ThemeToggleButton";
import NotificationsBell from "./NotificationsBell";
```

- [ ] **Step 2: Insert the two new icons before the existing admin feedback bell**

Find this block (around line 87-89):

```tsx
      <div className="ml-auto flex items-center gap-2">
        {/* Notifications — admin only */}
        {isAdmin && (
```

Change it to:

```tsx
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggleButton />
        <NotificationsBell />

        {/* Notifications — admin only */}
        {isAdmin && (
```

Do not change anything else in the file — the existing admin feedback bell block and the avatar dropdown block below it stay exactly as they are.

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "feat: wire ThemeToggleButton and NotificationsBell into header"
```

---

### Task 7: Manual end-to-end verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server if not already running**

Run: `npm run dev`
Expected: `Ready` on `http://localhost:3000`.

- [ ] **Step 2: Log in and check the header**

Open `http://localhost:3000` in a browser, log in (use the test user from Task 2 Step 5, or any existing account). Confirm:
- A sun/moon icon now appears in the header. Clicking it toggles light/dark mode immediately, and the choice persists across a page reload.
- A megaphone icon appears next to it, with a red badge showing `3` (the seeded notifications, assuming this user hasn't viewed them yet).

- [ ] **Step 3: Open the notifications dropdown**

Click the megaphone icon. Confirm:
- A dropdown opens showing "Welcome to Origin Halo" (blue info icon), "Scheduled maintenance" (amber warning icon), and "New feature: Project dependency diagrams" (emerald success icon, clickable — navigates to `/projects`).
- The red badge disappears (count drops to 0) once the dropdown has been opened.

- [ ] **Step 4: Confirm read state persists**

Reload the page. Confirm the badge stays at 0 (read state came from the database via `notification_reads`, not just in-memory state).

- [ ] **Step 5: Confirm the existing admin feedback bell still works (if you have an Admin user)**

Log in as a user with `role === "Admin"` (or promote one via `/users`). Confirm the original `Bell` icon (support-request feedback) still appears next to the avatar dropdown, working exactly as before, and is visually distinct from the new megaphone icon.

- [ ] **Step 6: No commit needed for this task** — it's verification only. If any step fails, fix the relevant file from Tasks 1-6 and re-verify before moving on.

---

### Task 8: Update `CLAUDE.md` documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the new tables to the Database schema section**

In the `## Database` → `### Schema (current)` section, add two new entries (placed after the `#### \`support_requests\`` table, before `#### \`projects\``):

```markdown
#### `notifications`
| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `title` | `VARCHAR(255)` | |
| `message` | `TEXT` NULL | |
| `type` | `ENUM('info','warning','error','success')` | Default: `info` |
| `link` | `VARCHAR(500)` NULL | Optional deep link shown in the dropdown |
| `created_at` | `DATETIME` | Auto-set on insert |

> Global — every authenticated user sees the same rows. No creation form exists; rows are seeded directly in `setupDatabase()`.

#### `notification_reads`
| Column | Type | Notes |
|---|---|---|
| `notification_id` | `CHAR(36)` PK (composite) | FK → `notifications.id` |
| `user_id` | `CHAR(36)` PK (composite) | Per-user read marker |
| `read_at` | `DATETIME` | Auto-set on insert |
```

- [ ] **Step 2: Update the Header — Notification Bell section**

Replace the existing `## Header — Notification Bell` section with:

```markdown
## Header — Icons

- **Theme toggle** — sun/moon icon, all users. Wraps the existing `ThemeContext`; also still available at Settings → Appearance.
- **General notifications (`Megaphone` icon)** — all users. Polls `GET /api/notifications?userId=` every 60 seconds. Badge shows unread count (per-user, tracked in `notification_reads`); opening the dropdown calls `POST /api/notifications/mark-read` and clears the badge. No creation UI — rows are seeded directly.
- **Feedback bell (`Bell` icon)** — renders only for Admin users. Polls `GET /api/support` every 60 seconds. Counts submissions with `status === 'New'` and displays a red badge (shows `9+` if > 9). Dropdown panel shows count card with link to `/settings/feedback`. Outside-click detection via `useRef` + `mousedown` listener (independent of the other header dropdowns).
```

- [ ] **Step 3: Add to the Implemented Features checklist**

In `## Implemented Features`, add a new line after the `Dark / light mode toggle` line:

```markdown
- [x] Header theme toggle and general notifications bell — sun/moon icon and Megaphone icon in the header; notifications backed by `notifications`/`notification_reads` tables with per-user read tracking; no creation UI, seeded directly
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document notifications tables and header icon changes"
```
