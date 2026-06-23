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
