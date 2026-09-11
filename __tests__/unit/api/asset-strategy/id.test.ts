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
import { PUT, DELETE } from '@/app/api/asset-strategy/[id]/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'strat-1' }) }
const dbStrategy = { id: 'strat-1', name: 'Emerging', description: null, sort_order: 1 }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PUT /api/asset-strategy/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'Adopting', sortOrder: 2, userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbStrategy]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq('PUT', { name: 'Adopting', sortOrder: 2, userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/asset-strategy/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success (nulls strategy_id on assets first)', async () => {
    mockExecute.mockResolvedValueOnce([[dbStrategy]])
    mockExecute.mockResolvedValueOnce([{}])  // UPDATE assets SET strategy_id = NULL
    mockExecute.mockResolvedValueOnce([{}])  // DELETE FROM asset_strategies
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    const calls = mockExecute.mock.calls
    expect(calls[1][0]).toMatch(/UPDATE assets SET strategy_id = NULL/)
    expect(calls[2][0]).toMatch(/DELETE FROM asset_strategies/)
  })
})
