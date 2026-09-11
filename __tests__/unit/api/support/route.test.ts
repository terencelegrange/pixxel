import { NextRequest } from 'next/server'

jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))


jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/support/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/support', () => {
  it('returns submissions', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 's1', user_id: 'u1', user_name: 'Jane', type: 'Bug', subject: 'Login broken', description: null, status: 'New', created_at: new Date() }]])
    const res = await GET(new NextRequest('http://localhost/'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requests).toHaveLength(1)
  })
})

describe('POST /api/support', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/support', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when type is invalid', async () => {
    const res = await POST(makeReq({ type: 'InvalidType', subject: 'Test', userId: 'u1', userName: 'Jane' }))
    expect(res.status).toBe(400)
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
