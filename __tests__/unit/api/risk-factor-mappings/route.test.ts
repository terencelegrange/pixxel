import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, PUT } from '@/app/api/risk-factor-mappings/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/risk-factor-mappings', () => {
  it('returns 400 when category missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/risk-factor-mappings'))
    expect(res.status).toBe(400)
  })

  it('returns 200 with mapped risk factor ids', async () => {
    mockExecute.mockResolvedValueOnce([[{ risk_factor_id: 'rf-1' }, { risk_factor_id: 'rf-2' }]])
    const res = await GET(new NextRequest('http://localhost/api/risk-factor-mappings?category=Application'))
    expect(res.status).toBe(200)
    expect((await res.json()).riskFactorIds).toEqual(['rf-1', 'rf-2'])
  })
})

describe('PUT /api/risk-factor-mappings', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/risk-factor-mappings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when category missing', async () => {
    const res = await PUT(makeReq({ riskFactorIds: [], userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when riskFactorIds is not an array', async () => {
    const res = await PUT(makeReq({ category: 'Application', riskFactorIds: 'rf-1', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when caller identity missing', async () => {
    const res = await PUT(makeReq({ category: 'Application', riskFactorIds: [] }))
    expect(res.status).toBe(401)
  })

  it('returns 200 and replaces the mapping', async () => {
    mockExecute.mockResolvedValueOnce([[{ risk_factor_id: 'rf-old' }]]) // SELECT before
    mockExecute.mockResolvedValue([{}])                                 // DELETE + INSERTs
    const res = await PUT(makeReq({ category: 'Application', riskFactorIds: ['rf-1', 'rf-2'], userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(200)
  })
})
