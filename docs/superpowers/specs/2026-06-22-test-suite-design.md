# Test Suite Design — Pixel

**Date:** 2026-06-22  
**Scope:** Full test coverage for all API routes, lib utilities, and UI components  
**Approach:** Jest Option A — two Jest projects (node + jsdom) in one config

---

## 1. Infrastructure

### Dependencies (dev)

```
jest
ts-jest
jest-environment-jsdom
@types/jest
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
```

### Jest config

Single `jest.config.ts` at repo root with three Jest projects:

| Project | `testEnvironment` | Glob | DB required |
|---|---|---|---|
| `unit` | `node` | `__tests__/unit/**/*.test.ts` | No — mocked |
| `integration` | `node` | `__tests__/integration/**/*.test.ts` | Yes — `pixel_dev` |
| `ui` | `jsdom` | `__tests__/ui/**/*.test.tsx` | No |

`moduleNameMapper` resolves the `@/*` path alias to `<rootDir>/*` so route imports work without modification.

### npm scripts

```json
"test":             "jest --testPathPattern='unit|ui'",
"test:integration": "jest --testPathPattern='integration'",
"test:all":         "jest"
```

`npm test` is the fast, no-DB command for development. Integration tests run separately when the MariaDB Docker container is up.

### Integration test DB credentials

Stored in `.env.test` (gitignored). Minimum required:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<same as .env.local>
DB_NAME=pixel_dev
```

---

## 2. Directory Layout

```
__tests__/
├── unit/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.test.ts
│   │   │   └── register.test.ts
│   │   ├── users/
│   │   │   ├── route.test.ts
│   │   │   └── [id].test.ts
│   │   ├── roles/
│   │   │   ├── route.test.ts
│   │   │   └── [id].test.ts
│   │   ├── assets/
│   │   │   ├── route.test.ts
│   │   │   ├── [id].test.ts
│   │   │   └── [id]/history.test.ts
│   │   ├── vendors/
│   │   │   ├── route.test.ts
│   │   │   └── [id].test.ts
│   │   ├── organisations/
│   │   │   ├── route.test.ts
│   │   │   └── [id].test.ts
│   │   ├── domains/
│   │   │   ├── route.test.ts
│   │   │   └── [id].test.ts
│   │   ├── asset-strategy/
│   │   │   ├── route.test.ts
│   │   │   └── [id].test.ts
│   │   ├── tiers/
│   │   │   ├── route.test.ts
│   │   │   └── [id].test.ts
│   │   ├── support/
│   │   │   ├── route.test.ts
│   │   │   └── [id].test.ts
│   │   ├── dashboard/
│   │   │   └── stats.test.ts
│   │   └── projects/
│   │       ├── route.test.ts
│   │       ├── [id].test.ts
│   │       ├── [id]/assets/route.test.ts
│   │       └── [id]/assets/[assetId].test.ts
│   └── lib/
│       ├── audit.test.ts
│       └── auth.test.ts
├── integration/
│   ├── api/
│   │   ├── auth.test.ts
│   │   ├── users.test.ts
│   │   ├── roles.test.ts
│   │   ├── vendors.test.ts
│   │   └── assets.test.ts
│   └── lib/
│       └── audit.test.ts
└── ui/
    ├── components/
    │   ├── ui/
    │   │   ├── Button.test.tsx
    │   │   ├── Modal.test.tsx
    │   │   └── Input.test.tsx
    │   └── auth/
    │       ├── LoginForm.test.tsx
    │       └── RegisterForm.test.tsx
    └── context/
        ├── AuthContext.test.tsx
        └── ThemeContext.test.tsx
```

---

## 3. Mocking Strategy

### Unit tests

Two module-level mocks applied at the top of every API unit test file:

```ts
jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({
  writeAudit: jest.fn().mockResolvedValue(undefined),
}))
```

Per-test, `getDb` returns a mock pool with `execute` returning whatever rows that test needs:

```ts
(getDb as jest.Mock).mockReturnValue({
  execute: jest.fn().mockResolvedValueOnce([[{ id: '1', ... }]])
})
```

`NextRequest` is imported directly from `next/server` — it works in the Node environment without a shim.

### Integration tests

No mocks. `resetPool()` is called in `beforeAll` to ensure the pool uses `.env.test` credentials rather than any cached pool from a previous test. Each test records inserted IDs and deletes them in `afterEach` so `pixel_dev` is left clean.

### UI tests

`fetch` is mocked globally per-test with `jest.fn()`. No MSW required — components only call fetch on user interaction, so a simple `global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({...}) })` is sufficient.

---

## 4. Test Coverage

### Unit tests — API routes

Every route file gets these four cases as a minimum:

1. **Validation** — missing or invalid required fields → correct 4xx status + error message
2. **Guard conditions** — business rules that block an operation (self-delete, role in use, etc.)
3. **Happy path** — DB mock returns valid data; verify response shape + status
4. **DB error** — `execute` rejects; verify → 500 with generic message

Key cases per route:

| Route | Specific cases |
|---|---|
| `POST /api/auth/login` | Missing fields → 400; wrong password → 401; unknown email → 401 (same code path, no enumeration leak); success → 200 with `User` object (no password field) |
| `POST /api/auth/register` | Missing fields → 400; password < 8 chars → 400; duplicate email → 409; success → 201 with `User` object |
| `DELETE /api/users/[id]` | `params.id === userId` → 400 self-delete blocked; user not found → 404; success → calls `writeAudit` with action `DELETE` |
| `DELETE /api/roles/[id]` | Users assigned (`role_id` match) → 400; not found → 404; success → calls `writeAudit` |
| `DELETE /api/vendors/[id]` | Nulls `vendor_id` on assets via UPDATE before DELETE; not found → 404 |
| All `PUT` routes | Name/required field missing → 400; invalid enum value → 400; record not found → 404; success → `writeAudit` called with `oldValues` and `newValues` |
| `PATCH /api/support/[id]` | Invalid status value → 400; not found → 404; success → 200 |
| `GET /api/assets` | Returns rows from DB; GROUP_CONCAT fields present in response |
| `GET /api/dashboard/stats` | Returns `{ departmentCount, assetsByTier }` shape |

### Unit tests — lib

**`lib/audit.ts`**
- `writeAudit` calls `db.execute` with the correct 8-column INSERT
- `oldValues` and `newValues` are JSON-serialised when present
- `oldValues: null` is passed as SQL `null` (not the string `"null"`)
- A UUID is generated for each call (value is a valid UUID pattern)

**`lib/auth.ts` (client-side)**
- `loginUser` calls `fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({email, password}) })`
- `getStoredUser` returns parsed object from `localStorage.getItem('user')`
- `getStoredUser` returns `null` when key is absent or JSON is malformed

### Integration tests — `pixel_dev`

**Auth round-trip**
- Register with valid data → 201; same email again → 409
- Login with registered credentials → 200 with user object
- Login with wrong password → 401

**User CRUD**
- Create user; PUT to update name + role; DELETE by a different user succeeds
- DELETE self (same `userId` as `params.id`) → 400

**Role CRUD**
- Create role; delete with no users assigned → succeeds
- Assign `role_id` to a user; attempt delete → 400 blocked

**Vendor CRUD**
- Create vendor; create asset linked to that vendor; delete vendor; verify asset's `vendor_id` is null

**Asset CRUD**
- Create asset with tier, strategy, domain; GET single → returns joined metadata; DELETE → gone from DB

### UI tests

| Component | Cases |
|---|---|
| `Button` | Renders with correct class per variant (`primary`, `secondary`, `ghost`, `danger`); `disabled` prop sets the HTML `disabled` attribute |
| `Modal` | Children are rendered; pressing Escape calls `onClose`; `document.body.style.overflow` is `hidden` while open |
| `Input` | Renders `label`, `error`, and `hint` text; `showToggle` changes `type` between `password` and `text` |
| `LoginForm` | Submit with empty email/password shows error or blocks; submit with valid fields calls `fetch` with correct body |
| `RegisterForm` | Password < 8 chars shows error; valid submit calls `fetch` and updates `AuthContext` |
| `AuthContext` | On mount reads `localStorage` and sets `user`; `logout()` clears state and removes `localStorage` key |
| `ThemeContext` | `toggleTheme()` adds `dark` to `document.documentElement.classList` and writes `"dark"` to `localStorage`; toggle again removes it |

---

## 5. Constraints & Decisions

- **No MSW** — components' fetch calls are simple enough that per-test `jest.fn()` stubs suffice; MSW would add unnecessary complexity.
- **`ts-jest` over Babel** — avoids maintaining a separate Babel config; transforms `.ts`/`.tsx` directly using the existing `tsconfig.json`.
- **`.env.test` is gitignored** — DB credentials for `pixel_dev` are not committed. CI must inject them as environment variables.
- **Integration tests clean up after themselves** — no `beforeAll` truncates; tests track their own inserted IDs and delete in `afterEach`. This keeps integration tests safe to run against a shared dev DB.
- **UI tests do not test dark-mode Tailwind classes** — Tailwind utility classes are applied at build time; testing class names would be fragile and low-value. Tests focus on DOM behaviour and state.
