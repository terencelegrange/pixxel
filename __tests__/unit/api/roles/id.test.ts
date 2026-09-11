import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { PUT, DELETE } from '@/app/api/roles/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: Promise.resolve({ id: 'role-1' }) }
const dbRole = { id: 'role-1', name: 'Editor', description: null, permission_level: 'member' }

function makeReq(method: string, body: object) {
  return new NextRequest('http://localhost/api/roles/role-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/roles/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
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
