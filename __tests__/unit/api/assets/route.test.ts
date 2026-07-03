import { NextRequest, NextResponse } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
  withTransaction: jest.fn((cb: (tx: { execute: jest.Mock }) => unknown) => cb({ execute: mockExecute })),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, POST } from '@/app/api/assets/route'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const dbAssetRow = {
  id: 'a1', name: 'MyApp', short_code: null, description: null,
  type: 'SaaS', category: 'Application', icon: 'Server',
  lifecycle_status: 'Production',
  department_ids: 'd1', department_names: 'IT',
  architect_ids: null, architect_names: null,
  capability_ids: null, capability_names: null,
  tier_id: null, tier_name: null,
  strategy_id: null, strategy_name: null,
  complexity_id: null, complexity_name: null,
  domain_id: null, domain_name: null,
  vendor_id: null, vendor_name: null,
  business_owner: null, technical_owner: null,
  vendor: null,
  sla_availability: null, sla_rto: null, sla_rpo: null,
  go_live_date: null, retirement_date: null, app_url: null, doc_url: null,
  contract_end_date: null, contract_amount: null, notes: null,
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date(), updated_at: new Date(),
}

describe('GET /api/assets', () => {
  it('returns mapped asset list', async () => {
    mockExecute.mockResolvedValueOnce([[dbAssetRow]])
    const res = await GET(new NextRequest('http://localhost/'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assets).toHaveLength(1)
    expect(body.assets[0].id).toBe('a1')
    expect(body.assets[0].departmentNames).toEqual(['IT'])
  })

  it('returns empty list when no assets', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assets).toHaveLength(0)
  })

  it('maps GROUP_CONCAT fields correctly', async () => {
    const row = {
      ...dbAssetRow,
      department_ids: 'd1,d2',
      department_names: 'Finance|IT',
      architect_ids: 'u1,u2',
      architect_names: 'Alice|Bob',
      capability_ids: 'c1',
      capability_names: 'Hosting',
    }
    mockExecute.mockResolvedValueOnce([[row]])
    const res = await GET(new NextRequest('http://localhost/'))
    const body = await res.json()
    const asset = body.assets[0]
    expect(asset.departmentIds).toEqual(['d1', 'd2'])
    expect(asset.departmentNames).toEqual(['Finance', 'IT'])
    expect(asset.architectIds).toEqual(['u1', 'u2'])
    expect(asset.architectNames).toEqual(['Alice', 'Bob'])
    expect(asset.capabilityIds).toEqual(['c1'])
    expect(asset.capabilityNames).toEqual(['Hosting'])
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await GET(new NextRequest('http://localhost/'))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/assets', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const valid = {
    name: 'MyApp', type: 'SaaS', lifecycleStatus: 'Production',
    departmentIds: ['d1'], userId: 'u1', userName: 'Admin',
  }

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ ...valid, name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when departmentIds is empty array', async () => {
    const res = await POST(makeReq({ ...valid, departmentIds: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when departmentIds is not an array', async () => {
    const res = await POST(makeReq({ ...valid, departmentIds: 'd1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid type', async () => {
    const res = await POST(makeReq({ ...valid, type: 'Unknown' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid lifecycleStatus', async () => {
    const res = await POST(makeReq({ ...valid, lifecycleStatus: 'Unknown' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(401)
  })

  it('returns 201 with id on success', async () => {
    mockExecute.mockResolvedValue([{}])  // INSERT + junction inserts
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
  })

  it('accepts all valid types', async () => {
    const validTypes = ['SaaS', 'On-Premise', 'Hybrid', 'Cloud', 'Open Source', 'Other']
    for (const type of validTypes) {
      mockExecute.mockResolvedValue([{}])
      const res = await POST(makeReq({ ...valid, type }))
      expect(res.status).toBe(201)
    }
  })

  it('accepts all valid lifecycle statuses', async () => {
    const validStatuses = ['Proposed', 'Approved', 'In Development', 'Production', 'Sunset', 'Retired']
    for (const lifecycleStatus of validStatuses) {
      mockExecute.mockResolvedValue([{}])
      const res = await POST(makeReq({ ...valid, lifecycleStatus }))
      expect(res.status).toBe(201)
    }
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(500)
  })
})
