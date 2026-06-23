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
