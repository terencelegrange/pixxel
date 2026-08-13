import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, POST } from '@/app/api/feature-tiers/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'Admin' } })
})

describe('GET /api/feature-tiers', () => {
  it('returns 200 with joined features split from GROUP_CONCAT', async () => {
    mockExecute.mockResolvedValueOnce([[{
      id: 't1', name: 'Advanced', description: null, sort_order: 2, is_default: 0,
      features: 'diagrams,plantuml',
      created_by_id: 'u1', created_by_name: 'Admin', created_at: new Date(), updated_at: new Date(),
    }]])
    const res = await GET(new NextRequest('http://localhost/api/feature-tiers'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tiers[0].features).toEqual(['diagrams', 'plantuml'])
    expect(body.tiers[0].isDefault).toBe(false)
  })
})

describe('POST /api/feature-tiers', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/feature-tiers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when name missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 403 when caller lacks a permitted role', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    })
    const res = await POST(makeReq({ name: 'Basic' }))
    expect(res.status).toBe(403)
  })

  it('clears other defaults before inserting when isDefault is true', async () => {
    mockExecute.mockResolvedValue([{}])
    const res = await POST(makeReq({
      name: 'Basic', isDefault: true, features: ['diagrams'],
    }))
    expect(res.status).toBe(201)
    expect(mockExecute).toHaveBeenCalledWith('UPDATE feature_tiers SET is_default = 0')
  })

  it('returns 201 on success and inserts feature rows', async () => {
    mockExecute.mockResolvedValue([{}])
    const res = await POST(makeReq({
      name: 'Advanced', features: ['diagrams', 'plantuml'],
    }))
    expect(res.status).toBe(201)
  })
})
