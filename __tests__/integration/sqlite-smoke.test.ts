// __tests__/integration/sqlite-smoke.test.ts
import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'

jest.mock('@/lib/setup', () => {
  const actual = jest.requireActual('@/lib/setup')
  return { ...actual, getSiteConfig: jest.fn() }
})
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Admin User', email: 'admin@example.com', role: 'Admin' } }),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/observability/config', () => ({ refreshObservabilityConfig: jest.fn() }))

import { getSiteConfig } from '@/lib/setup'
import { resetPool } from '@/lib/db'
import { GET as getAssets, POST as createAsset } from '@/app/api/assets/route'
import { PUT as putSettings } from '@/app/api/settings/route'

describe('SQLite trial mode smoke test', () => {
  let dbFile: string

  beforeAll(() => {
    dbFile = path.join(os.tmpdir(), `pixxel-smoke-${randomUUID()}.db`)
    ;(getSiteConfig as jest.Mock).mockReturnValue({
      setupComplete: true, appName: 'Pixxel', orgName: 'Acme',
      db: { dialect: 'sqlite', file: dbFile },
    })
  })

  afterAll(() => {
    resetPool()
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile)
  })

  it('creates an asset and lists it back with aggregated department/architect/capability fields', async () => {
    // Seed a department directly so the created asset can reference it.
    const { getDb, setupDatabase } = await import('@/lib/db')
    await setupDatabase()
    const db = getDb()
    const deptId = randomUUID()
    await db.execute('INSERT INTO departments (id, name, status, created_by_id, created_by_name) VALUES (?, ?, ?, ?, ?)', [deptId, 'Engineering', 'Published', 'u1', 'Admin User'])

    const createReq = new NextRequest('http://localhost/api/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Asset', type: 'SaaS', lifecycleStatus: 'Proposed', departmentIds: [deptId] }),
    })
    const createRes = await createAsset(createReq)
    expect(createRes.status).toBe(201)

    const listRes = await getAssets(new NextRequest('http://localhost/api/assets'))
    expect(listRes.status).toBe(200)
    const { assets } = await listRes.json()
    const created = assets.find((a: { name: string }) => a.name === 'Test Asset')
    expect(created).toBeDefined()
    expect(created.departmentNames).toEqual(['Engineering'])
  })

  it('upserts a setting twice via ON CONFLICT without erroring', async () => {
    const first = await putSettings(new NextRequest('http://localhost/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { 'confluence.base_url': 'https://one.example' } }),
    }))
    expect(first.status).toBe(200)

    const second = await putSettings(new NextRequest('http://localhost/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { 'confluence.base_url': 'https://two.example' } }),
    }))
    expect(second.status).toBe(200)

    const { getDb } = await import('@/lib/db')
    const [rows] = await getDb().execute<{ value: string }[]>("SELECT value FROM app_settings WHERE key = 'confluence.base_url'")
    expect(rows[0].value).toBe('https://two.example')
  })
})
