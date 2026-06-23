# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete Jest test suite covering all API routes, lib utilities, and UI components with unit tests (mocked DB), integration tests (pixel_dev), and UI component tests (jsdom).

**Architecture:** Three Jest projects in one config — `unit` (node, mocked DB) for all ~20 API route files and lib utilities; `integration` (node, real DB) for round-trip flows against `pixel_dev`; `ui` (jsdom + @testing-library/react) for React components and context. All test files live under `__tests__/` at the repo root.

**Tech Stack:** Jest 29, ts-jest, jest-environment-jsdom, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, Next.js 14 (App Router), TypeScript 5, mysql2, bcryptjs.

## Global Constraints

- Node environment for unit/integration tests; jsdom for UI tests
- Path alias `@/*` resolves to `<rootDir>/*` in all jest projects
- Integration tests target `pixel_dev` DB via `.env.test` (gitignored)
- Every test file imports mocks before the module under test
- `NextRequest` is constructed as `new NextRequest('http://localhost/test', options)` — no shims required on Node 18+
- Route handlers are called directly: `POST(req, { params })` — no HTTP server needed
- `writeAudit` and `setupDatabase` are always mocked in unit tests
- bcryptjs is mocked in auth unit tests to avoid CPU cost
- `next/navigation` is mocked in UI tests (`useRouter` returns `{ push: jest.fn() }`)

---

## File Map

**Created:**
- `tsconfig.test.json` — Jest-compatible TS config (CommonJS module)
- `jest.config.ts` — three-project Jest config
- `jest.setup.ts` — imports @testing-library/jest-dom for the ui project
- `.env.test` — integration DB credentials (gitignored, not committed)
- `__tests__/unit/api/auth/login.test.ts`
- `__tests__/unit/api/auth/register.test.ts`
- `__tests__/unit/api/users/route.test.ts`
- `__tests__/unit/api/users/id.test.ts`
- `__tests__/unit/api/roles/route.test.ts`
- `__tests__/unit/api/roles/id.test.ts`
- `__tests__/unit/api/assets/route.test.ts`
- `__tests__/unit/api/assets/id.test.ts`
- `__tests__/unit/api/assets/history.test.ts`
- `__tests__/unit/api/vendors/route.test.ts`
- `__tests__/unit/api/vendors/id.test.ts`
- `__tests__/unit/api/organisations/route.test.ts`
- `__tests__/unit/api/organisations/id.test.ts`
- `__tests__/unit/api/domains/route.test.ts`
- `__tests__/unit/api/domains/id.test.ts`
- `__tests__/unit/api/asset-strategy/route.test.ts`
- `__tests__/unit/api/asset-strategy/id.test.ts`
- `__tests__/unit/api/tiers/route.test.ts`
- `__tests__/unit/api/tiers/id.test.ts`
- `__tests__/unit/api/support/route.test.ts`
- `__tests__/unit/api/support/id.test.ts`
- `__tests__/unit/api/dashboard/stats.test.ts`
- `__tests__/unit/api/projects/route.test.ts`
- `__tests__/unit/api/projects/id.test.ts`
- `__tests__/unit/api/projects/assets.test.ts`
- `__tests__/unit/api/projects/assetId.test.ts`
- `__tests__/unit/lib/audit.test.ts`
- `__tests__/unit/lib/auth.test.ts`
- `__tests__/integration/api/auth.test.ts`
- `__tests__/integration/api/users.test.ts`
- `__tests__/integration/api/roles.test.ts`
- `__tests__/integration/api/vendors.test.ts`
- `__tests__/integration/api/assets.test.ts`
- `__tests__/ui/components/ui/Button.test.tsx`
- `__tests__/ui/components/ui/Input.test.tsx`
- `__tests__/ui/components/ui/Modal.test.tsx`
- `__tests__/ui/components/auth/LoginForm.test.tsx`
- `__tests__/ui/components/auth/RegisterForm.test.tsx`
- `__tests__/ui/context/AuthContext.test.tsx`
- `__tests__/ui/context/ThemeContext.test.tsx`

**Modified:**
- `package.json` — add devDependencies + test scripts
- `.gitignore` — add `.env.test`

---

### Task 1: Jest infrastructure

**Files:**
- Create: `tsconfig.test.json`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm test` runs unit+ui tests; `npm run test:integration` runs integration tests; `npm run test:all` runs everything

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D jest@29 ts-jest@29 jest-environment-jsdom @types/jest \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: packages added to `node_modules`, `package.json` devDependencies updated.

- [ ] **Step 2: Create `tsconfig.test.json`**

The main `tsconfig.json` uses `"module": "esnext"` and `"moduleResolution": "bundler"` which ts-jest cannot handle. This override fixes that.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 3: Create `jest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create `jest.config.ts`**

```ts
import type { Config } from 'jest'

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/unit/**/*.test.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/**/*.test.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
      testTimeout: 30000,
    },
    {
      displayName: 'ui',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/ui/**/*.test.tsx'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(css|scss)$': '<rootDir>/__tests__/__mocks__/fileMock.ts',
      },
      setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
    },
  ],
}

export default config
```

- [ ] **Step 5: Create CSS file mock**

```bash
mkdir -p __tests__/__mocks__
```

Create `__tests__/__mocks__/fileMock.ts`:

```ts
module.exports = ''
```

- [ ] **Step 6: Add scripts to `package.json`**

In the `"scripts"` block add:

```json
"test":             "jest --selectProjects unit ui",
"test:integration": "jest --selectProjects integration",
"test:all":         "jest"
```

- [ ] **Step 7: Add `.env.test` to `.gitignore`**

Open `.gitignore` and append:

```
.env.test
```

- [ ] **Step 8: Write a smoke test to verify the config works**

Create `__tests__/unit/smoke.test.ts`:

```ts
describe('jest config', () => {
  it('resolves @/ path alias', async () => {
    const { User } = await import('@/types')
    expect(User).toBeUndefined() // types have no runtime value — just verifies import resolves
  })
})
```

- [ ] **Step 9: Run and verify**

```bash
npm test -- --testPathPattern=smoke
```

Expected output: `PASS __tests__/unit/smoke.test.ts` and 1 test passing.

- [ ] **Step 10: Delete the smoke test and commit**

```bash
rm __tests__/unit/smoke.test.ts
git add tsconfig.test.json jest.config.ts jest.setup.ts package.json .gitignore __tests__/__mocks__/fileMock.ts
git commit -m "test: add Jest infrastructure (three-project config)"
```

---

### Task 2: Unit tests — auth/login

**Files:**
- Create: `__tests__/unit/api/auth/login.test.ts`
- Test: `app/api/auth/login/route.ts`

**Interfaces:**
- Consumes: `setupDatabase` (mocked), `getDb` (mocked), `bcrypt.compare` (mocked)
- Produces: test coverage for `POST /api/auth/login`

- [ ] **Step 1: Write the tests**

```ts
// __tests__/unit/api/auth/login.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

import { getDb } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { POST } from '@/app/api/auth/login/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const dbUser = {
  id: 'user-1',
  name: 'Jane Smith',
  email: 'jane@example.com',
  password: '$2a$12$hashedpassword',
  role: 'Member',
  created_at: new Date('2025-01-01'),
}

describe('POST /api/auth/login', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeReq({ password: 'secret' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('required') })
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeReq({ email: 'jane@example.com' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('required') })
  })

  it('returns 401 when email not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeReq({ email: 'nobody@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Invalid email or password.' })
  })

  it('runs bcrypt.compare even when user not found (prevents enumeration)', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
    await POST(makeReq({ email: 'nobody@example.com', password: 'x' }))
    expect(bcrypt.compare).toHaveBeenCalledWith('x', '$2a$12$invalidhashforenumerationprevention')
  })

  it('returns 401 when password is wrong', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeReq({ email: 'jane@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 200 with User object on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
    const res = await POST(makeReq({ email: 'jane@example.com', password: 'correct' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({
      id: 'user-1',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'Member',
      avatarInitials: 'JS',
    })
    expect(body.user.password).toBeUndefined()
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB down'))
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    const res = await POST(makeReq({ email: 'jane@example.com', password: 'x' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run and verify tests fail (no mocks yet causing import issues)**

```bash
npm test -- --testPathPattern="auth/login"
```

Expected: tests run — some may fail if import resolution has issues; fix any config problems before proceeding.

- [ ] **Step 3: Run and verify all 7 tests pass**

```bash
npm test -- --testPathPattern="auth/login"
```

Expected: `PASS __tests__/unit/api/auth/login.test.ts` — 7 tests passing.

- [ ] **Step 4: Commit**

```bash
git add __tests__/unit/api/auth/login.test.ts
git commit -m "test(unit): auth/login route"
```

---

### Task 3: Unit tests — auth/register

**Files:**
- Create: `__tests__/unit/api/auth/register.test.ts`
- Test: `app/api/auth/register/route.ts`

**Interfaces:**
- Consumes: `setupDatabase` (mocked), `getDb` (mocked), `bcrypt.hash` (mocked)

- [ ] **Step 1: Write the tests**

```ts
// __tests__/unit/api/auth/register.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'),
}))

import { getDb } from '@/lib/db'
import { POST } from '@/app/api/auth/register/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const valid = { name: 'Jane Smith', email: 'jane@example.com', password: 'password123' }

describe('POST /api/auth/register', () => {
  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ email: valid.email, password: valid.password }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('required') })
  })

  it('returns 400 when name is only whitespace', async () => {
    const res = await POST(makeReq({ name: '   ', email: valid.email, password: valid.password }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeReq({ name: valid.name, email: valid.email }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is shorter than 8 characters', async () => {
    const res = await POST(makeReq({ ...valid, password: 'short' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('8 characters') })
  })

  it('returns 409 when email already exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'existing' }]])
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('already exists') })
  })

  it('returns 201 with User object on success', async () => {
    mockExecute.mockResolvedValueOnce([[]])   // no existing user
    mockExecute.mockResolvedValueOnce([{}])   // INSERT
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user).toMatchObject({
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'Member',
      avatarInitials: 'JS',
    })
    expect(body.user.password).toBeUndefined()
  })

  it('normalises email to lowercase', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ ...valid, email: 'JANE@EXAMPLE.COM' }))
    const body = await res.json()
    expect(body.user.email).toBe('jane@example.com')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB down'))
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run and verify all 8 tests pass**

```bash
npm test -- --testPathPattern="auth/register"
```

Expected: `PASS __tests__/unit/api/auth/register.test.ts` — 8 tests passing.

- [ ] **Step 3: Commit**

```bash
git add __tests__/unit/api/auth/register.test.ts
git commit -m "test(unit): auth/register route"
```

---

### Task 4: Unit tests — users routes

**Files:**
- Create: `__tests__/unit/api/users/route.test.ts`
- Create: `__tests__/unit/api/users/id.test.ts`
- Test: `app/api/users/route.ts`, `app/api/users/[id]/route.ts`

**Interfaces:**
- Consumes: `setupDatabase` (mocked), `getDb` (mocked), `writeAudit` (mocked)

- [ ] **Step 1: Write `route.test.ts` (GET list + POST create)**

```ts
// __tests__/unit/api/users/route.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('$hashed') }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/users/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const dbUsers = [{ id: 'u1', name: 'Jane', email: 'jane@example.com', role: 'Admin', created_at: new Date() }]

describe('GET /api/users', () => {
  it('returns users list', async () => {
    mockExecute.mockResolvedValueOnce([dbUsers])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toHaveLength(1)
    expect(body.users[0].id).toBe('u1')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/users', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ email: 'a@b.com', password: 'password1', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when email already exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'existing' }]])
    const res = await POST(makeReq({ name: 'New', email: 'a@b.com', password: 'password1', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(409)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([[]])   // no existing
    mockExecute.mockResolvedValueOnce([{}])   // INSERT
    const res = await POST(makeReq({ name: 'New User', email: 'new@b.com', password: 'password1', role: 'Member', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Write `id.test.ts` (PUT + DELETE)**

```ts
// __tests__/unit/api/users/id.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import { PUT, DELETE } from '@/app/api/users/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: { id: 'target-user' } }
const dbUser = { id: 'target-user', name: 'Old Name', email: 'old@b.com', role: 'Member' }

function makePutReq(body: object) {
  return new NextRequest('http://localhost/api/users/target-user', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function makeDeleteReq(body: object) {
  return new NextRequest('http://localhost/api/users/target-user', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/users/[id]', () => {
  it('returns 400 when name is missing', async () => {
    const res = await PUT(makePutReq({ role: 'Member', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 400 when role is invalid', async () => {
    const res = await PUT(makePutReq({ name: 'Jane', role: 'SuperAdmin', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 401 when caller identity is missing', async () => {
    const res = await PUT(makePutReq({ name: 'Jane', role: 'Member' }), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when user not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makePutReq({ name: 'Jane', role: 'Member', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 and calls writeAudit on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])  // SELECT current
    mockExecute.mockResolvedValueOnce([{}])         // UPDATE
    const res = await PUT(makePutReq({ name: 'New Name', role: 'Admin', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      tableName: 'users',
      action: 'UPDATE',
      oldValues: { name: 'Old Name', role: 'Member' },
      newValues: { name: 'New Name', role: 'Admin' },
    }))
  })
})

describe('DELETE /api/users/[id]', () => {
  it('returns 400 when deleting own account', async () => {
    const res = await DELETE(makeDeleteReq({ userId: 'target-user', userName: 'Self' }), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('cannot delete') })
  })

  it('returns 404 when user not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeDeleteReq({ userId: 'other-user', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 and calls writeAudit with DELETE action', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await DELETE(makeDeleteReq({ userId: 'other-user', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'DELETE',
      newValues: null,
    }))
  })
})
```

- [ ] **Step 3: Run and verify**

```bash
npm test -- --testPathPattern="users"
```

Expected: `PASS` on both files, all tests green.

- [ ] **Step 4: Commit**

```bash
git add __tests__/unit/api/users/
git commit -m "test(unit): users routes"
```

---

### Task 5: Unit tests — roles routes

**Files:**
- Create: `__tests__/unit/api/roles/route.test.ts`
- Create: `__tests__/unit/api/roles/id.test.ts`
- Test: `app/api/roles/route.ts`, `app/api/roles/[id]/route.ts`

- [ ] **Step 1: Write `route.test.ts`**

```ts
// __tests__/unit/api/roles/route.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/roles/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/roles', () => {
  it('returns roles list', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'r1', name: 'Editor', permission_level: 'member' }]])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.roles).toHaveLength(1)
  })
})

describe('POST /api/roles', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ permissionLevel: 'member', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid permissionLevel', async () => {
    const res = await POST(makeReq({ name: 'X', permissionLevel: 'superuser', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Auditor', permissionLevel: 'read-only', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Write `id.test.ts`**

```ts
// __tests__/unit/api/roles/id.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/roles/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: { id: 'role-1' } }
const dbRole = { id: 'role-1', name: 'Editor', description: null, permission_level: 'member' }

function makeReq(method: string, body: object) {
  return new NextRequest('http://localhost/api/roles/role-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/roles/[id]', () => {
  it('returns 401 when caller identity missing', async () => {
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when role not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 when users are assigned to the role', async () => {
    mockExecute.mockResolvedValueOnce([[dbRole]])          // SELECT role
    mockExecute.mockResolvedValueOnce([[{ id: 'u1' }]])   // SELECT users with role_id
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('assigned to users') })
  })

  it('returns 200 when no users assigned', async () => {
    mockExecute.mockResolvedValueOnce([[dbRole]])  // SELECT role
    mockExecute.mockResolvedValueOnce([[]])         // SELECT users — empty
    mockExecute.mockResolvedValueOnce([{}])         // DELETE
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('PUT /api/roles/[id]', () => {
  it('returns 404 when role not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'X', permissionLevel: 'admin', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbRole]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq('PUT', { name: 'Senior Editor', permissionLevel: 'admin', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run and verify**

```bash
npm test -- --testPathPattern="roles"
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/unit/api/roles/
git commit -m "test(unit): roles routes"
```

---

### Task 6: Unit tests — assets routes

**Files:**
- Create: `__tests__/unit/api/assets/route.test.ts`
- Create: `__tests__/unit/api/assets/id.test.ts`
- Create: `__tests__/unit/api/assets/history.test.ts`
- Test: `app/api/assets/route.ts`, `app/api/assets/[id]/route.ts`, `app/api/assets/[id]/history/route.ts`

- [ ] **Step 1: Write `route.test.ts`**

```ts
// __tests__/unit/api/assets/route.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/assets/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const dbAssetRow = {
  id: 'a1', name: 'MyApp', short_code: null, description: null,
  type: 'SaaS', category: 'Application', icon: 'Server',
  lifecycle_status: 'Production', department_ids: 'd1', department_names: 'IT',
  architect_ids: null, architect_names: null,
  capability_ids: null, capability_names: null,
  tier_id: null, tier_name: null, strategy_id: null, strategy_name: null,
  complexity_id: null, complexity_name: null, domain_id: null, domain_name: null,
  vendor_id: null, vendor_name: null, business_owner: null, technical_owner: null,
  sla_availability: null, sla_rto: null, sla_rpo: null,
  go_live_date: null, retirement_date: null, app_url: null, doc_url: null,
  contract_end_date: null, contract_amount: null, notes: null,
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date(), updated_at: new Date(),
}

describe('GET /api/assets', () => {
  it('returns mapped asset list', async () => {
    mockExecute.mockResolvedValueOnce([[dbAssetRow]])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assets).toHaveLength(1)
    expect(body.assets[0].id).toBe('a1')
    expect(body.assets[0].departmentNames).toEqual(['IT'])
  })
})

describe('POST /api/assets', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const valid = {
    name: 'MyApp', type: 'SaaS', lifecycleStatus: 'Production',
    departmentIds: ['d1'], userId: 'u1', userName: 'Admin',
  }

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ ...valid, name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when departmentIds is empty', async () => {
    const res = await POST(makeReq({ ...valid, departmentIds: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid type', async () => {
    const res = await POST(makeReq({ ...valid, type: 'Unknown' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid lifecycleStatus', async () => {
    const res = await POST(makeReq({ ...valid, lifecycleStatus: 'Unknown' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with id on success', async () => {
    mockExecute.mockResolvedValue([{}])  // INSERT + junction inserts
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
  })
})
```

- [ ] **Step 2: Write `id.test.ts`**

```ts
// __tests__/unit/api/assets/id.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, PUT, DELETE } from '@/app/api/assets/[id]/route'

const mockExecute = jest.fn()
const params = { params: { id: 'asset-1' } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const dbAsset = {
  id: 'asset-1', name: 'MyApp', type: 'SaaS', category: 'Application',
  lifecycle_status: 'Production', icon: 'Server', created_by_id: 'u1',
  created_by_name: 'Admin', created_at: new Date(), updated_at: new Date(),
}

describe('GET /api/assets/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 with asset', async () => {
    mockExecute.mockResolvedValueOnce([[dbAsset]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    expect((await res.json()).asset.id).toBe('asset-1')
  })
})

describe('DELETE /api/assets/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const req = new NextRequest('http://localhost/', {
      method: 'DELETE',
      body: JSON.stringify({ userId: 'u1', userName: 'Admin' }),
    })
    const res = await DELETE(req, params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbAsset]])
    mockExecute.mockResolvedValue([{}])
    const req = new NextRequest('http://localhost/', {
      method: 'DELETE',
      body: JSON.stringify({ userId: 'u1', userName: 'Admin' }),
    })
    const res = await DELETE(req, params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Write `history.test.ts`**

```ts
// __tests__/unit/api/assets/history.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { GET } from '@/app/api/assets/[id]/history/route'

const mockExecute = jest.fn()
const params = { params: { id: 'asset-1' } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/assets/[id]/history', () => {
  it('returns audit log entries for the asset', async () => {
    const logRow = {
      id: 'log-1', table_name: 'assets', record_id: 'asset-1',
      action: 'UPDATE', performed_by_id: 'u1', performed_by_name: 'Admin',
      performed_at: new Date(), old_values: null, new_values: null,
    }
    mockExecute.mockResolvedValueOnce([[logRow]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.history).toHaveLength(1)
    expect(body.history[0].id).toBe('log-1')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'))
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 4: Run and verify**

```bash
npm test -- --testPathPattern="assets"
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add __tests__/unit/api/assets/
git commit -m "test(unit): assets routes"
```

---

### Task 7: Unit tests — vendors routes

**Files:**
- Create: `__tests__/unit/api/vendors/route.test.ts`
- Create: `__tests__/unit/api/vendors/id.test.ts`
- Test: `app/api/vendors/route.ts`, `app/api/vendors/[id]/route.ts`

- [ ] **Step 1: Write both files**

```ts
// __tests__/unit/api/vendors/route.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/vendors/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/vendors', () => {
  it('returns vendor list', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'v1', name: 'Acme' }]])
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).vendors).toHaveLength(1)
  })
})

describe('POST /api/vendors', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/vendors', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Acme Corp', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })
})
```

```ts
// __tests__/unit/api/vendors/id.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { DELETE } from '@/app/api/vendors/[id]/route'

const mockExecute = jest.fn()
const params = { params: { id: 'vendor-1' } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const dbVendor = { id: 'vendor-1', name: 'Acme', email: null, country: null }

describe('DELETE /api/vendors/[id]', () => {
  const makeReq = () => new NextRequest('http://localhost/', {
    method: 'DELETE', body: JSON.stringify({ userId: 'u1', userName: 'Admin' }),
  })

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq(), params)
    expect(res.status).toBe(404)
  })

  it('nulls vendor_id on assets before deleting the vendor', async () => {
    mockExecute.mockResolvedValueOnce([[dbVendor]])
    mockExecute.mockResolvedValueOnce([{}])  // UPDATE assets SET vendor_id = NULL
    mockExecute.mockResolvedValueOnce([{}])  // DELETE vendor
    await DELETE(makeReq(), params)
    const calls = mockExecute.mock.calls
    expect(calls[1][0]).toMatch(/UPDATE assets SET vendor_id = NULL/)
    expect(calls[2][0]).toMatch(/DELETE FROM vendors/)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbVendor]])
    mockExecute.mockResolvedValue([{}])
    const res = await DELETE(makeReq(), params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run and verify**

```bash
npm test -- --testPathPattern="vendors"
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add __tests__/unit/api/vendors/
git commit -m "test(unit): vendors routes"
```

---

### Task 8: Unit tests — organisations, domains, asset-strategy, tiers

All four entity pairs follow the same pattern: GET list, POST create (name required), PUT update (name required + not found), DELETE (not found, success with writeAudit). One file per entity pair.

**Files:**
- Create: `__tests__/unit/api/organisations/route.test.ts`
- Create: `__tests__/unit/api/organisations/id.test.ts`
- Create: `__tests__/unit/api/domains/route.test.ts`
- Create: `__tests__/unit/api/domains/id.test.ts`
- Create: `__tests__/unit/api/asset-strategy/route.test.ts`
- Create: `__tests__/unit/api/asset-strategy/id.test.ts`
- Create: `__tests__/unit/api/tiers/route.test.ts`
- Create: `__tests__/unit/api/tiers/id.test.ts`

- [ ] **Step 1: Write the shared helper pattern**

Each file follows this exact template (substitute entity name, route path, and required fields accordingly):

```ts
// __tests__/unit/api/organisations/route.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/organisations/route'

const mockExecute = jest.fn()
beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

describe('GET /api/organisations', () => {
  it('returns 200 with departments list', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'd1', name: 'IT' }]])
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).departments).toHaveLength(1)
  })
})

describe('POST /api/organisations', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/organisations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  it('returns 400 when name missing', async () => {
    const res = await POST(makeReq({ userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })
  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Finance', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })
})
```

```ts
// __tests__/unit/api/organisations/id.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/organisations/[id]/route'

const mockExecute = jest.fn()
const params = { params: { id: 'dept-1' } }
const dbDept = { id: 'dept-1', name: 'IT', description: null, status: 'Published' }

beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PUT /api/organisations/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'Finance', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })
  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbDept]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq('PUT', { name: 'Finance', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/organisations/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })
  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbDept]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Write `domains/route.test.ts` and `domains/id.test.ts`**

Same pattern as organisations above. Replace:
- Import path: `@/app/api/domains/route` and `@/app/api/domains/[id]/route`
- `departments` → `domains` in GET response key
- `dbDept` → `dbDomain = { id: 'dom-1', name: 'Infrastructure', description: null }`
- `params = { params: { id: 'dom-1' } }`

- [ ] **Step 3: Write `asset-strategy/route.test.ts` and `asset-strategy/id.test.ts`**

Same pattern. Replace:
- Import path: `@/app/api/asset-strategy/route` and `@/app/api/asset-strategy/[id]/route`
- Response key: `strategies`
- POST body: `{ name: 'Emerging', sortOrder: 1, userId: 'u1', userName: 'Admin' }`
- `params = { params: { id: 'strat-1' } }`

- [ ] **Step 4: Write `tiers/route.test.ts` and `tiers/id.test.ts`**

Same pattern. Replace:
- Import path: `@/app/api/tiers/route` and `@/app/api/tiers/[id]/route`
- Response key: `tiers`
- POST body: `{ name: 'Tier 1', userId: 'u1', userName: 'Admin' }`
- `params = { params: { id: 'tier-1' } }`

- [ ] **Step 5: Run and verify**

```bash
npm test -- --testPathPattern="organisations|domains|asset-strategy|tiers"
```

Expected: all 32 tests pass across 8 files.

- [ ] **Step 6: Commit**

```bash
git add __tests__/unit/api/organisations/ __tests__/unit/api/domains/ __tests__/unit/api/asset-strategy/ __tests__/unit/api/tiers/
git commit -m "test(unit): organisations, domains, asset-strategy, tiers routes"
```

---

### Task 9: Unit tests — support, dashboard, projects

**Files:**
- Create: `__tests__/unit/api/support/route.test.ts`
- Create: `__tests__/unit/api/support/id.test.ts`
- Create: `__tests__/unit/api/dashboard/stats.test.ts`
- Create: `__tests__/unit/api/projects/route.test.ts`
- Create: `__tests__/unit/api/projects/id.test.ts`
- Create: `__tests__/unit/api/projects/assets.test.ts`
- Create: `__tests__/unit/api/projects/assetId.test.ts`

- [ ] **Step 1: Write `support/route.test.ts`**

```ts
// __tests__/unit/api/support/route.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/support/route'

const mockExecute = jest.fn()
beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

describe('GET /api/support', () => {
  it('returns submissions', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 's1', type: 'Bug', status: 'New' }]])
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/support', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/support', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when subject is missing', async () => {
    const res = await POST(makeReq({ type: 'Bug', userId: 'u1', userName: 'Jane' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ type: 'Bug', subject: 'Login broken', userId: 'u1', userName: 'Jane' }))
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Write `support/id.test.ts`**

```ts
// __tests__/unit/api/support/id.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { PATCH } from '@/app/api/support/[id]/route'

const mockExecute = jest.fn()
const params = { params: { id: 'sub-1' } }
beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

const makeReq = (body: object) => new NextRequest('http://localhost/', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PATCH /api/support/[id]', () => {
  it('returns 400 for invalid status', async () => {
    const res = await PATCH(makeReq({ status: 'Deleted', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PATCH(makeReq({ status: 'Acknowledged', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'sub-1', status: 'New' }]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PATCH(makeReq({ status: 'Acknowledged', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Write `dashboard/stats.test.ts`**

```ts
// __tests__/unit/api/dashboard/stats.test.ts
jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { GET } from '@/app/api/dashboard/stats/route'

const mockExecute = jest.fn()
beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

describe('GET /api/dashboard/stats', () => {
  it('returns departmentCount and assetsByTier', async () => {
    mockExecute.mockResolvedValueOnce([[{ count: 4 }]])            // departments count
    mockExecute.mockResolvedValueOnce([[{ tier: 'Tier 1', count: 3 }]])  // assets by tier
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('departmentCount')
    expect(body).toHaveProperty('assetsByTier')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 4: Write `projects/route.test.ts`**

```ts
// __tests__/unit/api/projects/route.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/projects/route'

const mockExecute = jest.fn()
beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

describe('GET /api/projects', () => {
  it('returns projects list with asset count', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'p1', name: 'Migration', asset_count: 2 }]])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.projects[0].id).toBe('p1')
  })
})

describe('POST /api/projects', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Migration Project', status: 'Active', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 5: Write `projects/id.test.ts`**

```ts
// __tests__/unit/api/projects/id.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/projects/[id]/route'

const mockExecute = jest.fn()
const params = { params: { id: 'proj-1' } }
const dbProject = { id: 'proj-1', name: 'Migration', status: 'Active', description: null }

beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PUT /api/projects/[id]', () => {
  it('returns 404 when project not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'Updated', status: 'Active', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbProject]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq('PUT', { name: 'Updated', status: 'On Hold', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('returns 404 when project not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbProject]])
    mockExecute.mockResolvedValue([{}])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 6: Write `projects/assets.test.ts`**

```ts
// __tests__/unit/api/projects/assets.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/projects/[id]/assets/route'

const mockExecute = jest.fn()
const params = { params: { id: 'proj-1' } }

beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

const makeReq = (body: object) => new NextRequest('http://localhost/', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('GET /api/projects/[id]/assets', () => {
  it('returns linked assets', async () => {
    mockExecute.mockResolvedValueOnce([[{ asset_id: 'a1', asset_name: 'MyApp', dependency_type: 'upstream' }]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.assets)).toBe(true)
  })
})

describe('POST /api/projects/[id]/assets', () => {
  it('returns 400 when assetId is missing', async () => {
    const res = await POST(makeReq({ dependencyType: 'upstream', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 400 when dependencyType is invalid', async () => {
    const res = await POST(makeReq({ assetId: 'a1', dependencyType: 'sideways', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ assetId: 'a1', dependencyType: 'upstream', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 7: Write `projects/assetId.test.ts`**

```ts
// __tests__/unit/api/projects/assetId.test.ts
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { PATCH, DELETE } from '@/app/api/projects/[id]/assets/[assetId]/route'

const mockExecute = jest.fn()
const params = { params: { id: 'proj-1', assetId: 'asset-1' } }

beforeEach(() => { jest.clearAllMocks(); (getDb as jest.Mock).mockReturnValue({ execute: mockExecute }) })

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PATCH /api/projects/[id]/assets/[assetId]', () => {
  it('returns 400 when dependencyType is invalid', async () => {
    const res = await PATCH(makeReq('PATCH', { dependencyType: 'sideways', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[{ project_id: 'proj-1', asset_id: 'asset-1' }]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PATCH(makeReq('PATCH', { dependencyType: 'downstream', notes: 'Added note', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/projects/[id]/assets/[assetId]', () => {
  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

- [ ] **Step 8: Run and verify**

```bash
npm test -- --testPathPattern="support|dashboard|projects"
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add __tests__/unit/api/support/ __tests__/unit/api/dashboard/ __tests__/unit/api/projects/
git commit -m "test(unit): support, dashboard, projects routes"
```

---

### Task 10: Unit tests — lib/audit.ts and lib/auth.ts

**Files:**
- Create: `__tests__/unit/lib/audit.test.ts`
- Create: `__tests__/unit/lib/auth.test.ts`

- [ ] **Step 1: Write `audit.test.ts`**

```ts
// __tests__/unit/lib/audit.test.ts
jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
  setupDatabase: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { writeAudit } from '@/lib/audit'

const mockExecute = jest.fn().mockResolvedValue([{}])
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('writeAudit', () => {
  it('inserts a row into audit_log with correct column order', async () => {
    await writeAudit({
      tableName: 'assets', recordId: 'a1', action: 'CREATE',
      performedById: 'u1', performedByName: 'Admin',
      oldValues: null, newValues: { name: 'MyApp' },
    })
    expect(mockExecute).toHaveBeenCalledTimes(1)
    const [sql, params] = mockExecute.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO audit_log/)
    expect(params[1]).toBe('assets')          // table_name
    expect(params[2]).toBe('a1')              // record_id
    expect(params[3]).toBe('CREATE')          // action
    expect(params[4]).toBe('u1')              // performed_by_id
    expect(params[5]).toBe('Admin')           // performed_by_name
    expect(params[6]).toBeNull()              // old_values — null for CREATE
    expect(params[7]).toBe(JSON.stringify({ name: 'MyApp' }))  // new_values
  })

  it('generates a UUID for each call', async () => {
    await writeAudit({ tableName: 'users', recordId: 'u1', action: 'DELETE',
      performedById: 'u2', performedByName: 'Admin', oldValues: null, newValues: null })
    await writeAudit({ tableName: 'users', recordId: 'u1', action: 'DELETE',
      performedById: 'u2', performedByName: 'Admin', oldValues: null, newValues: null })
    const id1 = mockExecute.mock.calls[0][1][0]
    const id2 = mockExecute.mock.calls[1][1][0]
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('passes null (not "null") for missing oldValues on CREATE', async () => {
    await writeAudit({ tableName: 'assets', recordId: 'a1', action: 'CREATE',
      performedById: 'u1', performedByName: 'Admin', oldValues: null, newValues: {} })
    const params = mockExecute.mock.calls[0][1]
    expect(params[6]).toBeNull()
  })

  it('serialises both oldValues and newValues for UPDATE', async () => {
    const old = { name: 'Old' }
    const next = { name: 'New' }
    await writeAudit({ tableName: 'assets', recordId: 'a1', action: 'UPDATE',
      performedById: 'u1', performedByName: 'Admin', oldValues: old, newValues: next })
    const params = mockExecute.mock.calls[0][1]
    expect(params[6]).toBe(JSON.stringify(old))
    expect(params[7]).toBe(JSON.stringify(next))
  })
})
```

- [ ] **Step 2: Write `auth.test.ts`**

`lib/auth.ts` calls `localStorage` and `fetch`, both available in jsdom. This file needs `@jest-environment jsdom` which we configure via a docblock override:

```ts
// __tests__/unit/lib/auth.test.ts
/**
 * @jest-environment jsdom
 */

global.fetch = jest.fn()

import { getStoredUser, storeUser, clearStoredUser, loginUser, registerUser } from '@/lib/auth'
import { User } from '@/types'

const mockUser: User = {
  id: 'u1', name: 'Jane Smith', email: 'jane@example.com',
  avatarInitials: 'JS', role: 'Member', createdAt: '2025-01-01T00:00:00.000Z',
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

describe('localStorage helpers', () => {
  it('storeUser writes JSON to saas_auth_user key', () => {
    storeUser(mockUser)
    expect(localStorage.getItem('saas_auth_user')).toBe(JSON.stringify(mockUser))
  })

  it('getStoredUser returns parsed user', () => {
    localStorage.setItem('saas_auth_user', JSON.stringify(mockUser))
    expect(getStoredUser()).toEqual(mockUser)
  })

  it('getStoredUser returns null when key is absent', () => {
    expect(getStoredUser()).toBeNull()
  })

  it('getStoredUser returns null when JSON is malformed', () => {
    localStorage.setItem('saas_auth_user', 'not-json{{{')
    expect(getStoredUser()).toBeNull()
  })

  it('clearStoredUser removes the key', () => {
    storeUser(mockUser)
    clearStoredUser()
    expect(localStorage.getItem('saas_auth_user')).toBeNull()
  })
})

describe('loginUser', () => {
  it('calls fetch with correct method and body', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    })
    const result = await loginUser('jane@example.com', 'password123')
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'jane@example.com', password: 'password123' }),
    }))
    expect(result).toEqual(mockUser)
  })

  it('throws when response is not ok', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid email or password.' }),
    })
    await expect(loginUser('a@b.com', 'wrong')).rejects.toThrow('Invalid email or password.')
  })
})

describe('registerUser', () => {
  it('calls fetch with name, email, password', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    })
    await registerUser('Jane Smith', 'jane@example.com', 'password123')
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Jane Smith', email: 'jane@example.com', password: 'password123' }),
    }))
  })
})
```

- [ ] **Step 3: Run and verify**

```bash
npm test -- --testPathPattern="unit/lib"
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/unit/lib/
git commit -m "test(unit): lib/audit and lib/auth"
```

---

### Task 11: Integration tests — setup and auth

**Files:**
- Create: `.env.test` (not committed)
- Create: `__tests__/integration/api/auth.test.ts`

**Interfaces:**
- Consumes: real `pixel_dev` MariaDB database
- Produces: verified register + login round-trip against actual DB

- [ ] **Step 1: Create `.env.test`**

Create this file manually (it is gitignored — never commit it):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<same password as your .env.local>
DB_NAME=pixel_dev
```

- [ ] **Step 2: Write `auth.test.ts`**

```ts
// __tests__/integration/api/auth.test.ts
import { NextRequest } from 'next/server'
import { config } from 'dotenv'

config({ path: '.env.test' })

import { resetPool, setupDatabase } from '@/lib/db'

beforeAll(async () => {
  resetPool()
  await setupDatabase()
})

afterAll(() => resetPool())

function makeReq(path: string, body: object) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const testEmail = `test_${Date.now()}@pixel.test`
const testPassword = 'TestPass123!'
const testName = 'Integration Tester'

describe('POST /api/auth/register + login (integration)', () => {
  afterAll(async () => {
    const { getDb } = await import('@/lib/db')
    await getDb().execute('DELETE FROM users WHERE email = ?', [testEmail])
  })

  it('registers a new user and returns 201', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(makeReq('/api/auth/register', {
      name: testName, email: testEmail, password: testPassword,
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.email).toBe(testEmail)
    expect(body.user.role).toBe('Member')
  })

  it('returns 409 when registering the same email again', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(makeReq('/api/auth/register', {
      name: testName, email: testEmail, password: testPassword,
    }))
    expect(res.status).toBe(409)
  })

  it('logs in with the registered credentials and returns user', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(makeReq('/api/auth/login', {
      email: testEmail, password: testPassword,
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe(testEmail)
    expect(body.user.password).toBeUndefined()
  })

  it('returns 401 with wrong password', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(makeReq('/api/auth/login', {
      email: testEmail, password: 'wrongpassword',
    }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run and verify (Docker container must be running)**

```bash
npm run test:integration -- --testPathPattern="integration/api/auth"
```

Expected: 4 tests pass. If the DB isn't running you'll see a connection error — start the MariaDB Docker container first.

- [ ] **Step 4: Commit**

```bash
git add __tests__/integration/api/auth.test.ts
git commit -m "test(integration): auth register + login round-trip"
```

---

### Task 12: Integration tests — users, roles, vendors, assets

**Files:**
- Create: `__tests__/integration/api/users.test.ts`
- Create: `__tests__/integration/api/roles.test.ts`
- Create: `__tests__/integration/api/vendors.test.ts`
- Create: `__tests__/integration/api/assets.test.ts`

- [ ] **Step 1: Write `users.test.ts`**

```ts
// __tests__/integration/api/users.test.ts
import { NextRequest } from 'next/server'
import { config } from 'dotenv'

config({ path: '.env.test' })

import { resetPool, setupDatabase, getDb } from '@/lib/db'

beforeAll(async () => { resetPool(); await setupDatabase() })
afterAll(() => resetPool())

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

let createdUserId: string

describe('User CRUD (integration)', () => {
  afterAll(async () => {
    if (createdUserId) {
      await getDb().execute('DELETE FROM users WHERE id = ?', [createdUserId])
    }
  })

  it('creates a user via POST /api/users', async () => {
    const { POST } = await import('@/app/api/users/route')
    const res = await POST(makeReq('POST', {
      name: 'Test User', email: `tu_${Date.now()}@pixel.test`,
      password: 'TestPass1!', role: 'Member', userId: 'system', userName: 'System',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    createdUserId = body.id
    expect(createdUserId).toBeDefined()
  })

  it('blocks self-delete via DELETE /api/users/[id]', async () => {
    const { DELETE } = await import('@/app/api/users/[id]/route')
    const res = await DELETE(
      makeReq('DELETE', { userId: createdUserId, userName: 'Test User' }),
      { params: { id: createdUserId } }
    )
    expect(res.status).toBe(400)
  })

  it('updates name and role via PUT /api/users/[id]', async () => {
    const { PUT } = await import('@/app/api/users/[id]/route')
    const res = await PUT(
      makeReq('PUT', { name: 'Updated Name', role: 'Viewer', userId: 'system', userName: 'System' }),
      { params: { id: createdUserId } }
    )
    expect(res.status).toBe(200)
    const [rows] = await getDb().execute<any[]>('SELECT name, role FROM users WHERE id = ?', [createdUserId])
    expect((rows as any[])[0].name).toBe('Updated Name')
    expect((rows as any[])[0].role).toBe('Viewer')
  })

  it('deletes user via DELETE /api/users/[id] by another user', async () => {
    const { DELETE } = await import('@/app/api/users/[id]/route')
    const res = await DELETE(
      makeReq('DELETE', { userId: 'system', userName: 'System' }),
      { params: { id: createdUserId } }
    )
    expect(res.status).toBe(200)
    createdUserId = '' // already deleted
  })
})
```

- [ ] **Step 2: Write `roles.test.ts`**

```ts
// __tests__/integration/api/roles.test.ts
import { NextRequest } from 'next/server'
import { config } from 'dotenv'

config({ path: '.env.test' })

import { resetPool, setupDatabase, getDb } from '@/lib/db'

beforeAll(async () => { resetPool(); await setupDatabase() })
afterAll(() => resetPool())

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

let createdRoleId: string

describe('Role CRUD (integration)', () => {
  afterAll(async () => {
    if (createdRoleId) {
      await getDb().execute('DELETE FROM roles WHERE id = ?', [createdRoleId])
    }
  })

  it('creates a role', async () => {
    const { POST } = await import('@/app/api/roles/route')
    const res = await POST(makeReq('POST', {
      name: `TestRole_${Date.now()}`, permissionLevel: 'read-only',
      userId: 'system', userName: 'System',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    createdRoleId = body.id
  })

  it('deletes the role when no users are assigned', async () => {
    const { DELETE } = await import('@/app/api/roles/[id]/route')
    const res = await DELETE(
      makeReq('DELETE', { userId: 'system', userName: 'System' }),
      { params: { id: createdRoleId } }
    )
    expect(res.status).toBe(200)
    createdRoleId = ''
  })
})
```

- [ ] **Step 3: Write `vendors.test.ts`**

```ts
// __tests__/integration/api/vendors.test.ts
import { NextRequest } from 'next/server'
import { config } from 'dotenv'
import { randomUUID } from 'crypto'

config({ path: '.env.test' })

import { resetPool, setupDatabase, getDb } from '@/lib/db'

beforeAll(async () => { resetPool(); await setupDatabase() })
afterAll(() => resetPool())

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('Vendor delete nulls asset vendor_id (integration)', () => {
  let vendorId: string
  let assetId: string
  const deptId = randomUUID()

  beforeAll(async () => {
    const db = getDb()
    vendorId = randomUUID()
    assetId  = randomUUID()
    await db.execute(
      `INSERT INTO vendors (id, name, created_by_id, created_by_name) VALUES (?, ?, 'system', 'System')`,
      [vendorId, `TestVendor_${Date.now()}`]
    )
    await db.execute(
      `INSERT INTO departments (id, name, status, created_by_id, created_by_name) VALUES (?, 'TestDept', 'Published', 'system', 'System')`,
      [deptId]
    )
    await db.execute(
      `INSERT INTO assets (id, name, type, category, icon, lifecycle_status, vendor_id, created_by_id, created_by_name)
       VALUES (?, 'TestAsset', 'SaaS', 'Application', 'Server', 'Production', ?, 'system', 'System')`,
      [assetId, vendorId]
    )
    await db.execute('INSERT INTO asset_departments (asset_id, department_id) VALUES (?, ?)', [assetId, deptId])
  })

  afterAll(async () => {
    const db = getDb()
    await db.execute('DELETE FROM asset_departments WHERE asset_id = ?', [assetId])
    await db.execute('DELETE FROM assets WHERE id = ?', [assetId])
    await db.execute('DELETE FROM departments WHERE id = ?', [deptId])
    await db.execute('DELETE FROM vendors WHERE id = ?', [vendorId])
  })

  it('nulls vendor_id on linked assets when vendor is deleted', async () => {
    const { DELETE } = await import('@/app/api/vendors/[id]/route')
    const res = await DELETE(
      makeReq('DELETE', { userId: 'system', userName: 'System' }),
      { params: { id: vendorId } }
    )
    expect(res.status).toBe(200)
    const [rows] = await getDb().execute<any[]>('SELECT vendor_id FROM assets WHERE id = ?', [assetId])
    expect((rows as any[])[0].vendor_id).toBeNull()
  })
})
```

- [ ] **Step 4: Write `assets.test.ts`**

```ts
// __tests__/integration/api/assets.test.ts
import { NextRequest } from 'next/server'
import { config } from 'dotenv'
import { randomUUID } from 'crypto'

config({ path: '.env.test' })

import { resetPool, setupDatabase, getDb } from '@/lib/db'

beforeAll(async () => { resetPool(); await setupDatabase() })
afterAll(() => resetPool())

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('Asset CRUD (integration)', () => {
  const deptId = randomUUID()
  let createdAssetId: string

  beforeAll(async () => {
    await getDb().execute(
      `INSERT INTO departments (id, name, status, created_by_id, created_by_name) VALUES (?, 'IntTestDept', 'Published', 'system', 'System')`,
      [deptId]
    )
  })

  afterAll(async () => {
    const db = getDb()
    if (createdAssetId) {
      await db.execute('DELETE FROM asset_departments WHERE asset_id = ?', [createdAssetId])
      await db.execute('DELETE FROM assets WHERE id = ?', [createdAssetId])
    }
    await db.execute('DELETE FROM departments WHERE id = ?', [deptId])
  })

  it('creates an asset and returns 201 with id', async () => {
    const { POST } = await import('@/app/api/assets/route')
    const res = await POST(makeReq('POST', {
      name: `IntAsset_${Date.now()}`, type: 'SaaS', lifecycleStatus: 'Production',
      departmentIds: [deptId], userId: 'system', userName: 'System',
    }))
    expect(res.status).toBe(201)
    createdAssetId = (await res.json()).id
    expect(createdAssetId).toBeDefined()
  })

  it('GET /api/assets returns the created asset with department name', async () => {
    const { GET } = await import('@/app/api/assets/route')
    const res = await GET()
    const body = await res.json()
    const found = body.assets.find((a: any) => a.id === createdAssetId)
    expect(found).toBeDefined()
    expect(found.departmentNames).toContain('IntTestDept')
  })

  it('deletes the asset', async () => {
    const { DELETE } = await import('@/app/api/assets/[id]/route')
    const res = await DELETE(
      makeReq('DELETE', { userId: 'system', userName: 'System' }),
      { params: { id: createdAssetId } }
    )
    expect(res.status).toBe(200)
    createdAssetId = ''
  })
})
```

- [ ] **Step 5: Run and verify (Docker container must be running)**

```bash
npm run test:integration
```

Expected: all integration tests pass. Check `pixel_dev` is clean after each suite.

- [ ] **Step 6: Commit**

```bash
git add __tests__/integration/
git commit -m "test(integration): users, roles, vendors, assets round-trips"
```

---

### Task 13: UI tests — Button, Input, Modal

**Files:**
- Create: `__tests__/ui/components/ui/Button.test.tsx`
- Create: `__tests__/ui/components/ui/Input.test.tsx`
- Create: `__tests__/ui/components/ui/Modal.test.tsx`

- [ ] **Step 1: Write `Button.test.tsx`**

```tsx
// __tests__/ui/components/ui/Button.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies primary variant classes by default', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-brand-600')
  })

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Cancel</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-slate-100')
  })

  it('applies danger variant classes', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-600')
  })

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">More</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-slate-600')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies w-full when fullWidth is true', () => {
    render(<Button fullWidth>Full</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })
})
```

- [ ] **Step 2: Write `Input.test.tsx`**

```tsx
// __tests__/ui/components/ui/Input.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/Input'

describe('Input', () => {
  it('renders label text', () => {
    render(<Input label="Email address" />)
    expect(screen.getByText('Email address')).toBeInTheDocument()
  })

  it('renders error message', () => {
    render(<Input error="This field is required." />)
    expect(screen.getByText('This field is required.')).toBeInTheDocument()
  })

  it('renders hint text when no error', () => {
    render(<Input hint="We will never share your email." />)
    expect(screen.getByText('We will never share your email.')).toBeInTheDocument()
  })

  it('does not render hint when error is present', () => {
    render(<Input hint="Hint text" error="Error text" />)
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument()
  })

  it('toggles password visibility when showToggle is used', async () => {
    const user = userEvent.setup()
    render(<Input type="password" showToggle label="Password" />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
  })
})
```

- [ ] **Step 3: Write `Modal.test.tsx`**

```tsx
// __tests__/ui/components/ui/Modal.test.tsx
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/ui/Modal'

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={jest.fn()} title="Test"><p>Content</p></Modal>)
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders title and children when isOpen is true', () => {
    render(<Modal isOpen onClose={jest.fn()} title="My Modal"><p>Modal body</p></Modal>)
    expect(screen.getByText('My Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal body')).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn()
    render(<Modal isOpen onClose={onClose} title="Test"><p>body</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(<Modal isOpen onClose={onClose} title="Test"><p>body</p></Modal>)
    // The backdrop is the absolute-positioned div before the panel
    const backdrop = document.querySelector('.absolute.inset-0') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sets body overflow to hidden when open', () => {
    render(<Modal isOpen onClose={jest.fn()} title="Test"><p>body</p></Modal>)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('calls onClose when the X button is clicked', () => {
    const onClose = jest.fn()
    render(<Modal isOpen onClose={onClose} title="Test"><p>body</p></Modal>)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 4: Run and verify**

```bash
npm test -- --testPathPattern="ui/components/ui"
```

Expected: all 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add __tests__/ui/components/ui/
git commit -m "test(ui): Button, Input, Modal components"
```

---

### Task 14: UI tests — LoginForm and RegisterForm

**Files:**
- Create: `__tests__/ui/components/auth/LoginForm.test.tsx`
- Create: `__tests__/ui/components/auth/RegisterForm.test.tsx`

Both forms use `useAuth()` which calls `useRouter()` — both must be mocked.

- [ ] **Step 1: Write `LoginForm.test.tsx`**

```tsx
// __tests__/ui/components/auth/LoginForm.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: any) => <a href={href}>{children}</a> }))
jest.mock('@/lib/auth', () => ({
  getStoredUser: jest.fn().mockReturnValue(null),
  storeUser: jest.fn(),
  clearStoredUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
}))

import { AuthProvider } from '@/context/AuthContext'
import LoginForm from '@/components/auth/LoginForm'
import { loginUser } from '@/lib/auth'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('LoginForm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows email error when submitted empty', async () => {
    const user = userEvent.setup()
    render(<LoginForm />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
  })

  it('shows password error when password is empty', async () => {
    const user = userEvent.setup()
    render(<LoginForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Password is required.')).toBeInTheDocument()
  })

  it('shows email format error for invalid email', async () => {
    const user = userEvent.setup()
    render(<LoginForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
  })

  it('calls loginUser with email and password on valid submit', async () => {
    const user = userEvent.setup()
    ;(loginUser as jest.Mock).mockResolvedValueOnce({
      id: 'u1', name: 'Jane', email: 'jane@example.com',
      avatarInitials: 'JA', role: 'Member', createdAt: '',
    })
    render(<LoginForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(loginUser).toHaveBeenCalledWith('jane@example.com', 'password1'))
  })

  it('shows general error when loginUser throws', async () => {
    const user = userEvent.setup()
    ;(loginUser as jest.Mock).mockRejectedValueOnce(new Error('Invalid email or password.'))
    render(<LoginForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write `RegisterForm.test.tsx`**

```tsx
// __tests__/ui/components/auth/RegisterForm.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: any) => <a href={href}>{children}</a> }))
jest.mock('@/lib/auth', () => ({
  getStoredUser: jest.fn().mockReturnValue(null),
  storeUser: jest.fn(),
  clearStoredUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
}))

import { AuthProvider } from '@/context/AuthContext'
import RegisterForm from '@/components/auth/RegisterForm'
import { registerUser } from '@/lib/auth'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('RegisterForm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows name error when name is empty', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Full name is required.')).toBeInTheDocument()
  })

  it('shows password length error when password is too short', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/full name/i), 'Jane')
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('shows confirm error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith')
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different1')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('calls registerUser with name, email, password on valid submit', async () => {
    const user = userEvent.setup()
    ;(registerUser as jest.Mock).mockResolvedValueOnce({
      id: 'u1', name: 'Jane Smith', email: 'jane@example.com',
      avatarInitials: 'JS', role: 'Member', createdAt: '',
    })
    render(<RegisterForm />, { wrapper: Wrapper })
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith')
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(registerUser).toHaveBeenCalledWith('Jane Smith', 'jane@example.com', 'password123'))
  })
})
```

- [ ] **Step 3: Run and verify**

```bash
npm test -- --testPathPattern="ui/components/auth"
```

Expected: all 9 tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/ui/components/auth/
git commit -m "test(ui): LoginForm, RegisterForm components"
```

---

### Task 15: UI tests — AuthContext and ThemeContext

**Files:**
- Create: `__tests__/ui/context/AuthContext.test.tsx`
- Create: `__tests__/ui/context/ThemeContext.test.tsx`

- [ ] **Step 1: Write `AuthContext.test.tsx`**

```tsx
// __tests__/ui/context/AuthContext.test.tsx
import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/auth', () => ({
  getStoredUser: jest.fn(),
  storeUser: jest.fn(),
  clearStoredUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
}))

import { AuthProvider, useAuth } from '@/context/AuthContext'
import { getStoredUser, clearStoredUser } from '@/lib/auth'

const mockUser = {
  id: 'u1', name: 'Jane', email: 'jane@example.com',
  avatarInitials: 'JA', role: 'Member', createdAt: '2025-01-01T00:00:00.000Z',
}

function TestConsumer() {
  const { user, isAuthenticated, logout } = useAuth()
  return (
    <div>
      <span data-testid="name">{user?.name ?? 'none'}</span>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rehydrates user from localStorage on mount', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Jane'))
    expect(screen.getByTestId('auth').textContent).toBe('yes')
  })

  it('user is null when localStorage is empty', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(null)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('none'))
    expect(screen.getByTestId('auth').textContent).toBe('no')
  })

  it('logout calls clearStoredUser and sets user to null', async () => {
    ;(getStoredUser as jest.Mock).mockReturnValue(mockUser)
    const user = userEvent.setup()
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => screen.getByText('Logout'))
    await user.click(screen.getByRole('button', { name: 'Logout' }))
    expect(clearStoredUser).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('none'))
  })
})
```

- [ ] **Step 2: Write `ThemeContext.test.tsx`**

```tsx
// __tests__/ui/context/ThemeContext.test.tsx
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'

function TestConsumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to light theme', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('reads persisted dark theme from localStorage on mount', async () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    await act(async () => {})
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggleTheme switches light to dark and adds dark class to <html>', async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('toggleTheme switches dark to light and removes dark class', async () => {
    localStorage.setItem('theme', 'dark')
    const user = userEvent.setup()
    render(<ThemeProvider><TestConsumer /></ThemeProvider>)
    await act(async () => {})
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
  })
})
```

- [ ] **Step 3: Run and verify**

```bash
npm test -- --testPathPattern="ui/context"
```

Expected: all 7 tests pass.

- [ ] **Step 4: Run the full non-integration suite**

```bash
npm test
```

Expected: all unit + ui tests pass. Note total count in the output — it should be 100+ tests.

- [ ] **Step 5: Commit**

```bash
git add __tests__/ui/context/
git commit -m "test(ui): AuthContext, ThemeContext"
```

---

### Task 16: Final wiring and verification

**Files:**
- Modify: `jest.config.ts` (fix `setupFilesAfterFramework` typo → `setupFilesAfterFramework`)

- [ ] **Step 1: Fix typo in `jest.config.ts`**

The correct key is `setupFilesAfterFramework`. Verify it reads exactly:

```ts
setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
```

If it reads `setupFilesAfterEachTest` or any other variant, correct it now.

- [ ] **Step 2: Run the complete unit + UI suite and check coverage**

```bash
npm test -- --coverage
```

Expected: passes with no failures. Review the coverage table — aim for >80% on `app/api/**` and `lib/**`.

- [ ] **Step 3: Run the integration suite (Docker must be up)**

```bash
npm run test:integration
```

Expected: all integration tests pass against `pixel_dev`.

- [ ] **Step 4: Final commit**

```bash
git add jest.config.ts
git commit -m "test: wire up complete test suite — unit, integration, ui"
```
