import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/roadmap/phases/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/roadmap/phases', () => {
  it('returns grouped structure', async () => {
    mockExecute.mockResolvedValueOnce([[
      {
        domain_id: 'd1', domain_name: 'CRM', asset_id: 'a1', asset_name: 'Salesforce',
        phase_id: 'p1', classification_id: 'c1', classification_name: 'Invest',
        classification_color: '#22c55e', start_quarter: '2026-Q3', end_quarter: '2027-Q2',
        notes: null, created_by_id: 'u1', created_by_name: 'Admin',
        phase_created_at: new Date(), phase_updated_at: new Date(),
      },
    ]])
    const req = new NextRequest('http://localhost/api/roadmap/phases?from=2026-Q1&to=2028-Q4')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groups).toHaveLength(1)
    expect(body.groups[0].domainName).toBe('CRM')
    expect(body.groups[0].assets[0].phases).toHaveLength(1)
  })

  it('includes assets with no phases', async () => {
    mockExecute.mockResolvedValueOnce([[
      {
        domain_id: 'd1', domain_name: 'CRM', asset_id: 'a1', asset_name: 'Salesforce',
        phase_id: null, classification_id: null, classification_name: null,
        classification_color: null, start_quarter: null, end_quarter: null,
        notes: null, created_by_id: null, created_by_name: null,
        phase_created_at: null, phase_updated_at: null,
      },
    ]])
    const req = new NextRequest('http://localhost/api/roadmap/phases?from=2026-Q1&to=2028-Q4')
    const res = await GET(req)
    const body = await res.json()
    expect(body.groups[0].assets[0].phases).toHaveLength(0)
  })
})

describe('POST /api/roadmap/phases', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/roadmap/phases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const validBody = {
    assetId: 'a1', classificationId: 'c1',
    startQuarter: '2026-Q3', endQuarter: '2027-Q2',
    userId: 'u1', userName: 'Admin',
  }

  it('returns 400 when assetId missing', async () => {
    const res = await POST(makeReq({ ...validBody, assetId: undefined }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when quarter format invalid', async () => {
    const res = await POST(makeReq({ ...validBody, startQuarter: '2026-03' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when end before start', async () => {
    const res = await POST(makeReq({ ...validBody, startQuarter: '2027-Q2', endQuarter: '2026-Q3' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when overlap exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'p-existing' }]])
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(409)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([[]])  // overlap check - none
    mockExecute.mockResolvedValueOnce([{}]) // INSERT
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBeDefined()
  })
})
