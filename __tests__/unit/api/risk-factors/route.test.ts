import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'Admin' } }),
}))

import { getDb, getDbDialect } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, POST } from '@/app/api/risk-factors/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(getDbDialect as jest.Mock).mockReturnValue('mysql')
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'Admin' } })
})

describe('GET /api/risk-factors', () => {
  it('returns 200 with joined categories split from GROUP_CONCAT', async () => {
    mockExecute.mockResolvedValueOnce([[{
      id: 'rf1', name: 'Automated Patching', description: null, kind: 'Attribute',
      severity: 'High', likelihood: 'Medium', impact: 'High',
      categories: 'Application,Infrastructure',
      created_by_id: 'u1', created_by_name: 'Admin', created_at: new Date(), updated_at: new Date(),
    }]])
    const res = await GET(new NextRequest('http://localhost/api/risk-factors'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.riskFactors).toHaveLength(1)
    expect(body.riskFactors[0].categories).toEqual(['Application', 'Infrastructure'])
  })

  // Regression test for a real MariaDB parse/scope error this route hit in
  // production ("Unknown column 'rf.id' in 'WHERE'"): a correlated derived
  // table in the FROM clause can't reference the outer query. The
  // MySQL/MariaDB branch must use a plain GROUP_CONCAT + LEFT JOIN instead
  // — this only checks the query shape (a mocked db can't catch a real SQL
  // syntax error); an integration test against a live database is the real
  // guard, same as feature-tiers.
  it('uses a LEFT JOIN + GROUP_CONCAT (no correlated derived table) on MySQL', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    await GET(new NextRequest('http://localhost/api/risk-factors'))
    const sql = mockExecute.mock.calls[0][0] as string
    expect(sql).toMatch(/LEFT JOIN risk_factor_categories/i)
    expect(sql).toMatch(/GROUP BY rf\.id/i)
    expect(sql).not.toMatch(/WHERE rfc\.risk_factor_id = rf\.id/i)
  })

  it('uses the correlated-subquery form on SQLite', async () => {
    (getDbDialect as jest.Mock).mockReturnValue('sqlite')
    mockExecute.mockResolvedValueOnce([[]])
    await GET(new NextRequest('http://localhost/api/risk-factors'))
    const sql = mockExecute.mock.calls[0][0] as string
    expect(sql).toMatch(/WHERE rfc\.risk_factor_id = rf\.id/i)
  })
})

describe('POST /api/risk-factors', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/risk-factors', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when name missing', async () => {
    const res = await POST(makeReq({ kind: 'Attribute', severity: 'Low', likelihood: 'Low', impact: 'Low' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when kind is invalid', async () => {
    const res = await POST(makeReq({ name: 'PII Data', kind: 'Bogus', severity: 'Low', likelihood: 'Low', impact: 'Low' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when a level field is invalid', async () => {
    const res = await POST(makeReq({ name: 'PII Data', kind: 'Characteristic', severity: 'Extreme', likelihood: 'Low', impact: 'Low' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when caller lacks a permitted role', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    })
    const res = await POST(makeReq({ name: 'PII Data', kind: 'Characteristic', severity: 'Low', likelihood: 'Low', impact: 'Low' }))
    expect(res.status).toBe(403)
  })

  it('returns 201 on success and inserts category mappings', async () => {
    mockExecute.mockResolvedValue([{}])
    const res = await POST(makeReq({
      name: 'PII Data', kind: 'Characteristic', severity: 'High', likelihood: 'Medium', impact: 'High',
      categories: ['Application', 'Database'],
    }))
    expect(res.status).toBe(201)
    // 1 insert for the factor + 2 inserts for the category mappings
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })
})
