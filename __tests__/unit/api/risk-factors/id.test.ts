import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/risk-factors/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: { id: 'rf-1' } }
const dbFactor = {
  id: 'rf-1', name: 'Automated Patching', description: null, kind: 'Attribute',
  severity: 'High', likelihood: 'Medium', impact: 'High',
}

function makeReq(method: string, body: object) {
  return new NextRequest('http://localhost/api/risk-factors/rf-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/risk-factors/[id]', () => {
  it('returns 404 when risk factor not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', {
      name: 'X', kind: 'Attribute', severity: 'Low', likelihood: 'Low', impact: 'Low', userId: 'u1', userName: 'Admin',
    }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success and replaces category mappings', async () => {
    mockExecute.mockResolvedValueOnce([[dbFactor]]) // SELECT existing
    mockExecute.mockResolvedValue([{}])             // UPDATE + DELETE + INSERTs
    const res = await PUT(makeReq('PUT', {
      name: 'Automated Patching', kind: 'Attribute', severity: 'Critical', likelihood: 'Medium', impact: 'High',
      categories: ['Application'], userId: 'u1', userName: 'Admin',
    }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/risk-factors/[id]', () => {
  it('returns 401 when caller identity missing', async () => {
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when risk factor not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 and cascades deletes to mappings and assessments', async () => {
    mockExecute.mockResolvedValueOnce([[dbFactor]]) // SELECT existing
    mockExecute.mockResolvedValue([{}])             // DELETEs
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    // SELECT + delete mappings + delete assessments + delete factor = 4 calls
    expect(mockExecute).toHaveBeenCalledTimes(4)
  })
})
