import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/feature-tiers/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: { id: 'tier-1' } }
const dbTier = { id: 'tier-1', name: 'Advanced', description: null, sort_order: 2, is_default: 0 }

function makeReq(method: string, body: object) {
  return new NextRequest('http://localhost/api/feature-tiers/tier-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/feature-tiers/[id]', () => {
  it('returns 404 when tier not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'X', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success and replaces feature rows', async () => {
    mockExecute.mockResolvedValueOnce([[dbTier]]) // SELECT existing
    mockExecute.mockResolvedValue([{}])           // UPDATE + DELETE + INSERTs
    const res = await PUT(makeReq('PUT', {
      name: 'Advanced', features: ['diagrams'], userId: 'u1', userName: 'Admin',
    }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/feature-tiers/[id]', () => {
  it('returns 401 when caller identity missing', async () => {
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when tier not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 when it is the last remaining tier', async () => {
    mockExecute.mockResolvedValueOnce([[dbTier]])          // SELECT existing
    mockExecute.mockResolvedValueOnce([[{ count: 1 }]])    // COUNT(*)
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('last remaining') })
  })

  it('returns 400 when it is the active tier', async () => {
    mockExecute.mockResolvedValueOnce([[dbTier]])                    // SELECT existing
    mockExecute.mockResolvedValueOnce([[{ count: 2 }]])              // COUNT(*)
    mockExecute.mockResolvedValueOnce([[{ value: 'tier-1' }]])       // active tier setting
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('active feature tier') })
  })

  it('returns 200 when safe to delete', async () => {
    mockExecute.mockResolvedValueOnce([[dbTier]])                    // SELECT existing
    mockExecute.mockResolvedValueOnce([[{ count: 2 }]])              // COUNT(*)
    mockExecute.mockResolvedValueOnce([[{ value: 'tier-2' }]])       // active tier setting (different)
    mockExecute.mockResolvedValue([{}])                              // DELETEs
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
