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
    createdUserId = ''
  })
})
