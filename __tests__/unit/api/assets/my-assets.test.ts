import { NextRequest, NextResponse } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb, getDbDialect } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET } from '@/app/api/assets/my-assets/route'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const dbAssetRow = {
  id: 'a1', name: 'MyApp', short_code: null, description: null,
  type: 'SaaS', category: 'Application', icon: 'Server',
  lifecycle_status: 'Production',
  department_ids: 'd1', department_names: 'IT',
  architect_ids: 'u1', architect_names: 'Admin',
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

describe('GET /api/assets/my-assets', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/assets/my-assets'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/assets/my-assets?userId=u1'))
    expect(res.status).toBe(401)
  })

  it('returns mapped asset list', async () => {
    mockExecute.mockResolvedValueOnce([[dbAssetRow]])
    const res = await GET(new NextRequest('http://localhost/api/assets/my-assets?userId=u1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assets).toHaveLength(1)
    expect(body.assets[0].id).toBe('a1')
    expect(body.assets[0].departmentNames).toEqual(['IT'])
    expect(body.assets[0].architectNames).toEqual(['Admin'])
  })

  it('returns empty list when no assets', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/api/assets/my-assets?userId=u1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assets).toHaveLength(0)
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await GET(new NextRequest('http://localhost/api/assets/my-assets?userId=u1'))
    expect(res.status).toBe(500)
  })

  it('uses correlated-subquery GROUP_CONCAT (no DISTINCT/SEPARATOR) for sqlite dialect', async () => {
    ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/api/assets/my-assets?userId=u1'))
    expect(res.status).toBe(200)
    const sql = mockExecute.mock.calls[0][0] as string
    expect(sql).not.toMatch(/SEPARATOR/)
    expect(sql).not.toMatch(/DISTINCT/)
    expect(sql).toMatch(/GROUP_CONCAT\(department_id, ','\)/)
  })
})
