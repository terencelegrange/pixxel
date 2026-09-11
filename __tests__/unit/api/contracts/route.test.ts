import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/contracts/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const ROW = {
  id: 'c1', vendor_id: 'v1', vendor_name: 'Acme', asset_id: null, asset_name: null,
  title: 'Acme SaaS', value: '1000.00', start_date: '2026-01-01', end_date: daysFromNow(200),
  notice_period_days: null, auto_renews: 0, owner: 'Jane', status: 'Active',
  doc_url: null, notes: null,
  created_by_id: 'u1', created_by_name: 'Test User',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
}

describe('GET /api/contracts', () => {
  it('returns the contract list', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    const res = await GET(new NextRequest('http://localhost/api/contracts'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contracts).toHaveLength(1)
    expect(body.contracts[0].id).toBe('c1')
    expect(body.contracts[0].value).toBe(1000)
  })

  it('filters by vendor query param', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    await GET(new NextRequest('http://localhost/api/contracts?vendor=v1'))
    const [sql, params] = mockExecute.mock.calls[0]
    expect(sql).toMatch(/vendor_id\s*=\s*\?/)
    expect(params).toContain('v1')
  })

  it('filters by asset query param', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    await GET(new NextRequest('http://localhost/api/contracts?asset=a1'))
    const [sql, params] = mockExecute.mock.calls[0]
    expect(sql).toMatch(/asset_id\s*=\s*\?/)
    expect(params).toContain('a1')
  })

  it('filters out non-expiring contracts when ?expiring=N is set', async () => {
    const soon = { ...ROW, id: 'c2', end_date: daysFromNow(10) }
    mockExecute.mockResolvedValueOnce([[ROW, soon]])
    const res = await GET(new NextRequest('http://localhost/api/contracts?expiring=30'))
    const body = await res.json()
    expect(body.contracts).toHaveLength(1)
    expect(body.contracts[0].id).toBe('c2')
  })
})

describe('POST /api/contracts', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/contracts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when title is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid status', async () => {
    const res = await POST(makeReq({ title: 'Test', status: 'Bogus' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success and writes an audit entry', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ title: 'Acme SaaS', vendorId: 'v1' }))
    expect(res.status).toBe(201)
    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit).toHaveBeenCalledTimes(1)
    expect(writeAudit.mock.calls[0][0]).toMatchObject({ tableName: 'contracts', action: 'CREATE' })
  })
})
