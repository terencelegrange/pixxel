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
import { PUT, DELETE } from '@/app/api/tiers/[id]/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'tier-1' }) }
const dbTier = { id: 'tier-1', name: 'Tier 1', description: null, sla_availability: '99.9%', support_hours: '24x7', response_time: '15 minutes', resolution_time: '4 hours' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PUT /api/tiers/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'Gold', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbTier]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq('PUT', { name: 'Gold', slaAvailability: '99.99%', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/tiers/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success (nulls tier_id on assets first)', async () => {
    mockExecute.mockResolvedValueOnce([[dbTier]])
    mockExecute.mockResolvedValueOnce([{}])  // UPDATE assets SET tier_id = NULL
    mockExecute.mockResolvedValueOnce([{}])  // DELETE FROM tiers
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    const calls = mockExecute.mock.calls
    expect(calls[1][0]).toMatch(/UPDATE assets SET tier_id = NULL/)
    expect(calls[2][0]).toMatch(/DELETE FROM tiers/)
  })
})
