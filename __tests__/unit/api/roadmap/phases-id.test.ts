import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/roadmap/phases/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: { id: 'p1' } }
const dbPhase = {
  id: 'p1', asset_id: 'a1', classification_id: 'c1',
  start_quarter: '2026-Q3', end_quarter: '2027-Q2', notes: null,
}

function makeReq(method: string, body: object) {
  return new NextRequest('http://localhost/api/roadmap/phases/p1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validPutBody = {
  classificationId: 'c1', startQuarter: '2026-Q3', endQuarter: '2027-Q2',
  userId: 'u1', userName: 'Admin',
}

describe('PUT /api/roadmap/phases/[id]', () => {
  it('returns 404 when phase not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', validPutBody), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 when quarter format invalid', async () => {
    const res = await PUT(makeReq('PUT', { ...validPutBody, startQuarter: '2026-03' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 409 when update would cause overlap', async () => {
    mockExecute.mockResolvedValueOnce([[dbPhase]])           // SELECT current phase
    mockExecute.mockResolvedValueOnce([[{ id: 'p-other' }]]) // overlap check
    const res = await PUT(makeReq('PUT', { ...validPutBody, startQuarter: '2025-Q1', endQuarter: '2027-Q4' }), params)
    expect(res.status).toBe(409)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbPhase]]) // SELECT current
    mockExecute.mockResolvedValueOnce([[]])        // overlap check - none
    mockExecute.mockResolvedValueOnce([{}])        // UPDATE
    const res = await PUT(makeReq('PUT', validPutBody), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/roadmap/phases/[id]', () => {
  it('returns 401 when userId missing', async () => {
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbPhase]]) // SELECT
    mockExecute.mockResolvedValueOnce([{}])        // DELETE
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
