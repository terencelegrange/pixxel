import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, PUT } from '@/app/api/feature-tier/active/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'Admin' } })
})

describe('GET /api/feature-tier/active', () => {
  it('falls back to the default tier when no explicit setting exists', async () => {
    mockExecute.mockResolvedValueOnce([[]])                                   // no app_settings row
    mockExecute.mockResolvedValueOnce([[{ id: 't1', name: 'Basic' }]])        // SELECT ... is_default = 1
    mockExecute.mockResolvedValueOnce([[]])                                   // features
    const res = await GET(new NextRequest('http://localhost/api/feature-tier/active'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tierId).toBe('t1')
    expect(body.features).toEqual([])
  })

  it('resolves the explicitly assigned tier and its features', async () => {
    mockExecute.mockResolvedValueOnce([[{ value: 't2' }]])                              // app_settings row
    mockExecute.mockResolvedValueOnce([[{ id: 't2', name: 'Advanced' }]])               // SELECT by id
    mockExecute.mockResolvedValueOnce([[{ feature_key: 'diagrams' }, { feature_key: 'plantuml' }]])
    const res = await GET(new NextRequest('http://localhost/api/feature-tier/active'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tierName).toBe('Advanced')
    expect(body.features).toEqual(['diagrams', 'plantuml'])
  })
})

describe('PUT /api/feature-tier/active', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/feature-tier/active', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when tierId missing', async () => {
    const res = await PUT(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 403 when caller lacks a permitted role', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    })
    const res = await PUT(makeReq({ tierId: 't1' }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when tier does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq({ tierId: 'nope' }))
    expect(res.status).toBe(404)
  })

  it('returns 200 and upserts app_settings on success', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 't1' }]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ tierId: 't1' }))
    expect(res.status).toBe(200)
  })
})
