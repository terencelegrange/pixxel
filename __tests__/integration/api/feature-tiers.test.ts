// __tests__/integration/api/feature-tiers.test.ts
//
// Runs the real GET/POST/DELETE handlers against a real database (no mocked
// db.execute), so a raw-SQL bug that only a real SQL engine would catch —
// e.g. the "Unknown column 'ft.id' in 'WHERE'" MariaDB error from an
// unaliased/correlated derived table — actually fails this test instead of
// passing silently the way the mocked unit tests do.
import { NextRequest } from 'next/server'
import { config } from 'dotenv'

jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

config({ path: '.env.test' })

import { resetPool, setupDatabase, getDb } from '@/lib/db'

beforeAll(async () => { resetPool(); await setupDatabase() })
afterAll(() => resetPool())

const makeReq = (method: string, body?: object) => new NextRequest('http://localhost/api/feature-tiers', {
  method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
})

let createdTierId: string

describe('Feature Tiers (integration)', () => {
  afterAll(async () => {
    if (createdTierId) {
      await getDb().execute('DELETE FROM feature_tier_features WHERE tier_id = ?', [createdTierId])
      await getDb().execute('DELETE FROM feature_tiers WHERE id = ?', [createdTierId])
    }
  })

  it('creates a tier with features', async () => {
    const { POST } = await import('@/app/api/feature-tiers/route')
    const res = await POST(makeReq('POST', {
      name: `TestTier_${Date.now()}`, sortOrder: 999, features: ['diagrams', 'plantuml'],
    }))
    expect(res.status).toBe(201)
    createdTierId = (await res.json()).id
  })

  it('lists tiers with a real GROUP_CONCAT query, including the new tier\'s features', async () => {
    const { GET } = await import('@/app/api/feature-tiers/route')
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const tier = body.tiers.find((t: { id: string }) => t.id === createdTierId)
    expect(tier).toBeDefined()
    expect(tier.features.sort()).toEqual(['diagrams', 'plantuml'])
  })

  it('deletes the tier', async () => {
    const { DELETE } = await import('@/app/api/feature-tiers/[id]/route')
    const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: createdTierId }) })
    expect(res.status).toBe(200)
    createdTierId = ''
  })
})
