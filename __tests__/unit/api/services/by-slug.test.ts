import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn(),
}))
jest.mock('@/lib/services', () => ({ getComposedService: jest.fn() }))

import { requireUser } from '@/lib/require-user'
import { getComposedService } from '@/lib/services'
import { GET } from '@/app/api/services/by-slug/[slug]/route'

const params = { params: Promise.resolve({ slug: 'billing' }) }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/services/by-slug/[slug]', () => {
  it('is auth-gated: returns auth.response when requireUser fails', async () => {
    const authResponse = new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) as any
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: authResponse })
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(401)
    expect(getComposedService).not.toHaveBeenCalled()
  })

  it('returns 404 when service not found', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: true, user: { id: 'u1', name: 'Test User', email: 't@example.com', role: 'Admin' } })
    ;(getComposedService as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 with composed service', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: true, user: { id: 'u1', name: 'Test User', email: 't@example.com', role: 'Admin' } })
    ;(getComposedService as jest.Mock).mockResolvedValueOnce({ id: 'svc-1', slug: 'billing', members: [] })
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slug).toBe('billing')
  })
})
