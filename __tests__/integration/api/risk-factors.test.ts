// __tests__/integration/api/risk-factors.test.ts
//
// Runs the real GET/POST/DELETE handlers against a real database (no
// mocked db.execute), so a raw-SQL bug that only a real SQL engine would
// catch — e.g. the "Unknown column 'rf.id' in 'WHERE'" MariaDB error from a
// correlated derived table — actually fails this test instead of passing
// silently the way the mocked unit tests do. See feature-tiers.test.ts for
// the same pattern; this route hit the identical bug in production.
import { NextRequest } from 'next/server'
import { config } from 'dotenv'

jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

config({ path: '.env.test' })

import { resetPool, setupDatabase, getDb } from '@/lib/db'

beforeAll(async () => { resetPool(); await setupDatabase() })
afterAll(() => resetPool())

const makeReq = (method: string, body?: object) => new NextRequest('http://localhost/api/risk-factors', {
  method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
})

let createdId: string

describe('Risk Factors (integration)', () => {
  afterAll(async () => {
    if (createdId) {
      await getDb().execute('DELETE FROM risk_factor_categories WHERE risk_factor_id = ?', [createdId])
      await getDb().execute('DELETE FROM risk_factors WHERE id = ?', [createdId])
    }
  })

  it('creates a risk factor with categories', async () => {
    const { POST } = await import('@/app/api/risk-factors/route')
    const res = await POST(makeReq('POST', {
      name: `TestRiskFactor_${Date.now()}`, kind: 'Attribute',
      severity: 'Low', likelihood: 'Low', impact: 'Low',
      categories: ['Application', 'Infrastructure'],
    }))
    expect(res.status).toBe(201)
    createdId = (await res.json()).id
  })

  it('lists risk factors with a real GROUP_CONCAT query, including the new one\'s categories', async () => {
    const { GET } = await import('@/app/api/risk-factors/route')
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const factor = body.riskFactors.find((r: { id: string }) => r.id === createdId)
    expect(factor).toBeDefined()
    expect(factor.categories.sort()).toEqual(['Application', 'Infrastructure'])
  })

  it('deletes the risk factor', async () => {
    const { DELETE } = await import('@/app/api/risk-factors/[id]/route')
    const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: createdId }) })
    expect(res.status).toBe(200)
    createdId = ''
  })
})
