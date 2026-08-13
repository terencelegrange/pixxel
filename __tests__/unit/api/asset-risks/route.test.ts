import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, POST } from '@/app/api/asset-risks/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } })
})

const ROW = {
  id: 'r1', asset_id: 'a1', asset_name: 'Payments API', title: 'Single vendor dependency',
  description: null, category: 'Operational', likelihood: 'High', impact: 'High', status: 'Open',
  owner: 'Jane', created_by_id: 'u1', created_by_name: 'Test User',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
}

describe('GET /api/asset-risks', () => {
  it('returns the risk list', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    const res = await GET(new NextRequest('http://localhost/api/asset-risks'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.risks).toHaveLength(1)
    expect(body.risks[0].assetName).toBe('Payments API')
  })

  it('filters by asset/status/category query params', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    await GET(new NextRequest('http://localhost/api/asset-risks?asset=a1&status=Open&category=Operational'))
    const [sql, params] = mockExecute.mock.calls[0]
    expect(sql).toMatch(/r\.asset_id\s*=\s*\?/)
    expect(sql).toMatch(/r\.status\s*=\s*\?/)
    expect(sql).toMatch(/r\.category\s*=\s*\?/)
    expect(params).toEqual(['a1', 'Open', 'Operational'])
  })
})

describe('POST /api/asset-risks', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/asset-risks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when assetId is missing', async () => {
    const res = await POST(makeReq({ title: 'X' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when title is missing', async () => {
    const res = await POST(makeReq({ assetId: 'a1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when category is invalid', async () => {
    const res = await POST(makeReq({ assetId: 'a1', title: 'X', category: 'Bogus' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when likelihood/impact is invalid', async () => {
    const res = await POST(makeReq({ assetId: 'a1', title: 'X', likelihood: 'Extreme' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when caller lacks a permitted role', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    })
    const res = await POST(makeReq({ assetId: 'a1', title: 'X' }))
    expect(res.status).toBe(403)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValue([{}])
    const res = await POST(makeReq({ assetId: 'a1', title: 'Single vendor dependency', category: 'Operational', likelihood: 'High', impact: 'High' }))
    expect(res.status).toBe(201)
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })
})
