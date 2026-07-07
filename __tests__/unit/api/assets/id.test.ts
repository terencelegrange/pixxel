import { NextRequest, NextResponse } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
  withTransaction: jest.fn((cb: (tx: { execute: jest.Mock }) => unknown) => cb({ execute: mockExecute })),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb, getDbDialect } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, PUT, DELETE } from '@/app/api/assets/[id]/route'

const params = { params: Promise.resolve({ id: 'asset-1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

// Full DB row matching the inline mapping in [id]/route.ts GET
const dbAsset = {
  id: 'asset-1', name: 'MyApp', short_code: null, description: null,
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
  vendor: null,
  business_owner: null, technical_owner: null,
  sla_availability: null, sla_rto: null, sla_rpo: null,
  go_live_date: null, retirement_date: null, app_url: null, doc_url: null,
  contract_end_date: null, contract_amount: null, notes: null,
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date(), updated_at: new Date(),
}

// Minimal DB row used for SELECT * FROM assets in PUT/DELETE (no GROUP_CONCAT fields)
const dbAssetRaw = {
  id: 'asset-1', name: 'MyApp', short_code: null, description: null,
  type: 'SaaS', category: 'Application', icon: 'Server',
  lifecycle_status: 'Production',
  tier_id: null, strategy_id: null, complexity_id: null, domain_id: null, vendor_id: null,
  business_owner: null, technical_owner: null,
  sla_availability: null, sla_rto: null, sla_rpo: null,
  go_live_date: null, retirement_date: null, app_url: null, doc_url: null,
  contract_end_date: null, contract_amount: null, notes: null,
  created_by_id: 'u1', created_by_name: 'Admin',
  created_at: new Date(), updated_at: new Date(),
}

describe('GET /api/assets/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 with asset', async () => {
    mockExecute.mockResolvedValueOnce([[dbAsset]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.asset.id).toBe('asset-1')
    expect(body.asset.name).toBe('MyApp')
    expect(body.asset.lifecycleStatus).toBe('Production')
  })

  it('maps GROUP_CONCAT fields correctly', async () => {
    const row = {
      ...dbAsset,
      department_ids: 'd1,d2',
      department_names: 'Finance|IT',
    }
    mockExecute.mockResolvedValueOnce([[row]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    const body = await res.json()
    expect(body.asset.departmentIds).toEqual(['d1', 'd2'])
    expect(body.asset.departmentNames).toEqual(['Finance', 'IT'])
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/assets/[id]', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const valid = {
    name: 'Updated App', type: 'SaaS', lifecycleStatus: 'Production',
    departmentIds: ['d1'], userId: 'u1', userName: 'Admin',
  }

  // PUT does 4 parallel queries via Promise.all before checking existence
  const setupFoundMocks = () => {
    // Promise.all([SELECT assets, SELECT depts, SELECT architects, SELECT capabilities])
    mockExecute.mockResolvedValueOnce([[dbAssetRaw]])  // assets row
    mockExecute.mockResolvedValueOnce([[]])             // depts
    mockExecute.mockResolvedValueOnce([[]])             // architects
    mockExecute.mockResolvedValueOnce([[]])             // capabilities
    mockExecute.mockResolvedValue([{}])                // all subsequent writes
  }

  it('returns 400 when name is missing', async () => {
    const res = await PUT(makeReq({ ...valid, name: '' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 400 when departmentIds is empty', async () => {
    const res = await PUT(makeReq({ ...valid, departmentIds: [] }), params)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid type', async () => {
    const res = await PUT(makeReq({ ...valid, type: 'Unknown' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid lifecycleStatus', async () => {
    const res = await PUT(makeReq({ ...valid, lifecycleStatus: 'Unknown' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await PUT(makeReq(valid), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when asset not found', async () => {
    // Promise.all returns empty for all 4 queries
    mockExecute.mockResolvedValueOnce([[]])  // assets — not found
    mockExecute.mockResolvedValueOnce([[]])  // depts
    mockExecute.mockResolvedValueOnce([[]])  // architects
    mockExecute.mockResolvedValueOnce([[]])  // capabilities
    const res = await PUT(makeReq(valid), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    setupFoundMocks()
    const res = await PUT(makeReq(valid), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await PUT(makeReq(valid), params)
    expect(res.status).toBe(500)
  })

  it('uses INSERT OR IGNORE for junction rows when dialect is sqlite', async () => {
    ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
    setupFoundMocks()
    const res = await PUT(makeReq(valid), params)
    expect(res.status).toBe(200)
    const junctionCall = mockExecute.mock.calls.find(([sql]) => sql.includes('asset_departments') && sql.startsWith('INSERT'))
    expect(junctionCall?.[0]).toBe('INSERT OR IGNORE INTO asset_departments (asset_id, department_id) VALUES (?, ?)')
  })
})

describe('DELETE /api/assets/[id]', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await DELETE(makeReq({ userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when asset not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq({ userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbAssetRaw]])  // SELECT to check existence
    mockExecute.mockResolvedValue([{}])                // cascading DELETEs + DELETE asset
    const res = await DELETE(makeReq({ userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('cascades deletion across junction tables', async () => {
    mockExecute.mockResolvedValueOnce([[dbAssetRaw]])
    mockExecute.mockResolvedValue([{}])
    await DELETE(makeReq({ userId: 'u1', userName: 'Admin' }), params)
    // SELECT + 3 junction deletes + 1 asset delete = 5 calls minimum
    expect(mockExecute).toHaveBeenCalledTimes(5)
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await DELETE(makeReq({ userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(500)
  })
})
