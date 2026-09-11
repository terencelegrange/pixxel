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
import { GET, POST } from '@/app/api/investment-classifications/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/investment-classifications', () => {
  it('returns classifications list', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'c1', name: 'Invest', color: '#22c55e', sort_order: 1, created_by_id: 'u1', created_by_name: 'Admin', created_at: new Date(), updated_at: new Date() }]])
    const res = await GET(new NextRequest('http://localhost/'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classifications).toHaveLength(1)
    expect(body.classifications[0].name).toBe('Invest')
  })
})

describe('POST /api/investment-classifications', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/investment-classifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ color: '#22c55e', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when color is missing', async () => {
    const res = await POST(makeReq({ name: 'Invest', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await POST(makeReq({ name: 'Invest', color: '#22c55e' }))
    expect(res.status).toBe(401)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Invest', color: '#22c55e', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
  })
})
