import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb, getDbDialect } from '@/lib/db'
import { GET, POST } from '@/app/api/services/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(getDbDialect as jest.Mock).mockReturnValue('mysql')
})

describe('GET /api/services', () => {
  it('returns services list with asset count', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 's1', name: 'Billing', slug: 'billing', description: null, status: 'Active', tier_id: null, tier_name: null, domain_id: null, domain_name: null, business_owner: null, technical_owner: null, asset_count: 2, created_by_id: 'u1', created_by_name: 'Admin', created_at: new Date(), updated_at: new Date() }]])
    const res = await GET(new NextRequest('http://localhost/'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.services[0].id).toBe('s1')
    expect(body.services[0].assetCount).toBe(2)
  })
})

describe('POST /api/services', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/services', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status', async () => {
    const res = await POST(makeReq({ name: 'Billing Service', status: 'Unknown' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success and defaults status to Planned', async () => {
    mockExecute.mockResolvedValueOnce([[]])  // slug collision check
    mockExecute.mockResolvedValueOnce([{}])  // INSERT
    const res = await POST(makeReq({ name: 'Billing Service' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.slug).toBe('billing-service')
  })

  it('auto-generates slug from name', async () => {
    mockExecute.mockResolvedValueOnce([[]])  // slug collision check
    mockExecute.mockResolvedValueOnce([{}])  // INSERT
    const res = await POST(makeReq({ name: 'Payment Gateway', status: 'Active' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.slug).toBe('payment-gateway')
  })

  it('appends -2 suffix when slug collides', async () => {
    mockExecute.mockResolvedValueOnce([[{ 1: 1 }]])  // slug collision check - collides
    mockExecute.mockResolvedValueOnce([[]])          // second check - free
    mockExecute.mockResolvedValueOnce([{}])          // INSERT
    const res = await POST(makeReq({ name: 'Billing Service' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.slug).toBe('billing-service-2')
  })

  it('uses CURRENT_TIMESTAMP instead of NOW() for sqlite dialect', async () => {
    ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
    mockExecute.mockResolvedValueOnce([[]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Test Service', status: 'Active' }))
    expect(res.status).toBe(201)
    const insertCall = mockExecute.mock.calls.find(([sql]) => sql.includes('INSERT INTO services'))
    expect(insertCall[0]).toContain('CURRENT_TIMESTAMP, CURRENT_TIMESTAMP')
    expect(insertCall[0]).not.toContain('NOW()')
  })
})
