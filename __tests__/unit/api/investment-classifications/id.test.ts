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
import { PUT, DELETE } from '@/app/api/investment-classifications/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: Promise.resolve({ id: 'c1' }) }
const dbRow = { id: 'c1', name: 'Invest', color: '#22c55e', sort_order: 1 }

function makeReq(method: string, body: object) {
  return new NextRequest('http://localhost/api/investment-classifications/c1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/investment-classifications/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'Invest', color: '#22c55e', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 when name missing', async () => {
    const res = await PUT(makeReq('PUT', { color: '#22c55e', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbRow]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq('PUT', { name: 'Invest Updated', color: '#16a34a', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/investment-classifications/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 409 when phases reference this classification', async () => {
    mockExecute.mockResolvedValueOnce([[dbRow]])       // SELECT classification
    mockExecute.mockResolvedValueOnce([[{ id: 'p1' }]]) // SELECT phases
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('in use') })
  })

  it('returns 200 when no phases reference it', async () => {
    mockExecute.mockResolvedValueOnce([[dbRow]]) // SELECT classification
    mockExecute.mockResolvedValueOnce([[]])      // SELECT phases - empty
    mockExecute.mockResolvedValueOnce([{}])      // DELETE
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
