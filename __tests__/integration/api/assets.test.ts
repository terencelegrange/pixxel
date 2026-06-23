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
