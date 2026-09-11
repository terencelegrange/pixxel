import { NextRequest } from 'next/server'

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
import { GET, POST } from '@/app/api/domains/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/domains', () => {
  it('returns 200 with domains list', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'dom-1', name: 'Infrastructure', description: null, created_by_id: 'u1', created_by_name: 'Admin', created_at: new Date(), updated_at: new Date() }]])
    const res = await GET(new NextRequest('http://localhost/'))
    expect(res.status).toBe(200)
    expect((await res.json()).domains).toHaveLength(1)
  })
})

describe('POST /api/domains', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/domains', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when name missing', async () => {
    const res = await POST(makeReq({ userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Infrastructure', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })
})
