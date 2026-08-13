import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { GET } from '@/app/api/risk-assessments/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/risk-assessments', () => {
  it('returns 200 with all assessment rows', async () => {
    mockExecute.mockResolvedValueOnce([[
      { asset_id: 'a1', risk_factor_id: 'rf1', status: 'Met' },
      { asset_id: 'a1', risk_factor_id: 'rf2', status: 'Not Met' },
    ]])
    const res = await GET(new NextRequest('http://localhost/api/risk-assessments'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assessments).toEqual([
      { assetId: 'a1', riskFactorId: 'rf1', status: 'Met' },
      { assetId: 'a1', riskFactorId: 'rf2', status: 'Not Met' },
    ])
  })
})
