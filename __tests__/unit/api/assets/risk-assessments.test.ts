import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET } from '@/app/api/assets/[id]/risk-assessments/route'
import { PUT } from '@/app/api/assets/[id]/risk-assessments/[riskFactorId]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/assets/[id]/risk-assessments', () => {
  const params = { params: { id: 'asset-1' } }

  it('returns 404 when asset not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/api/assets/asset-1/risk-assessments'), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 with mapped risk factors, defaulting unassessed status to Not Met', async () => {
    mockExecute.mockResolvedValueOnce([[{ category: 'Application' }]]) // SELECT asset
    mockExecute.mockResolvedValueOnce([[{
      id: 'rf-1', name: 'Automated Patching', description: null, kind: 'Attribute',
      severity: 'High', likelihood: 'Medium', impact: 'High',
      status: null, notes: null, assessed_by_id: null, assessed_by_name: null, assessed_at: null,
    }]])
    const res = await GET(new NextRequest('http://localhost/api/assets/asset-1/risk-assessments'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.riskFactors[0].status).toBe('Not Met')
  })
})

describe('PUT /api/assets/[id]/risk-assessments/[riskFactorId]', () => {
  const params = { params: { id: 'asset-1', riskFactorId: 'rf-1' } }
  const makeReq = (body: object) => new NextRequest('http://localhost/api/assets/asset-1/risk-assessments/rf-1', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when status is invalid', async () => {
    const res = await PUT(makeReq({ status: 'Nope', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 401 when caller identity missing', async () => {
    const res = await PUT(makeReq({ status: 'Met' }), params)
    expect(res.status).toBe(401)
  })

  it('inserts a new row when no existing assessment', async () => {
    mockExecute.mockResolvedValueOnce([[]]) // SELECT existing — none
    mockExecute.mockResolvedValueOnce([{}]) // INSERT
    const res = await PUT(makeReq({ status: 'Met', notes: 'Verified', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })

  it('updates the existing row when an assessment already exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'ara-1', status: 'Not Met', notes: null }]]) // SELECT existing
    mockExecute.mockResolvedValueOnce([{}])                                                // UPDATE
    const res = await PUT(makeReq({ status: 'Partial', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
