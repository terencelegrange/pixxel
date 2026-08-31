import { NextRequest } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET } from '@/app/api/tour/route'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } })
})

describe('GET /api/tour', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/tour'))
    expect(res.status).toBe(401)
  })

  it('returns an empty step list when nothing is configured', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/api/tour'))
    expect(await res.json()).toEqual({ steps: [] })
  })

  it('resolves configured hrefs against config/navigation.ts, in the configured order', async () => {
    mockExecute.mockResolvedValueOnce([[{ value: JSON.stringify(['/contracts', '/dashboard']) }]])
    const res = await GET(new NextRequest('http://localhost/api/tour'))
    const body = await res.json()
    expect(body.steps).toEqual([
      { href: '/contracts', label: 'Contracts', icon: 'FileText', featureKey: null },
      { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', featureKey: null },
    ])
  })

  it('silently drops a configured href that no longer exists in the nav config', async () => {
    mockExecute.mockResolvedValueOnce([[{ value: JSON.stringify(['/dashboard', '/this-page-was-removed']) }]])
    const res = await GET(new NextRequest('http://localhost/api/tour'))
    const body = await res.json()
    expect(body.steps).toHaveLength(1)
    expect(body.steps[0].href).toBe('/dashboard')
  })

  it('includes featureKey for a gated nav item, for client-side filtering', async () => {
    mockExecute.mockResolvedValueOnce([[{ value: JSON.stringify(['/projects']) }]])
    const res = await GET(new NextRequest('http://localhost/api/tour'))
    const body = await res.json()
    expect(body.steps[0]).toEqual({ href: '/projects', label: 'Projects', icon: 'FolderKanban', featureKey: 'projects' })
  })

  it('treats malformed stored JSON as unconfigured rather than erroring', async () => {
    mockExecute.mockResolvedValueOnce([[{ value: 'not-json{{' }]])
    const res = await GET(new NextRequest('http://localhost/api/tour'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ steps: [] })
  })

  it('returns 500 when the DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await GET(new NextRequest('http://localhost/api/tour'))
    expect(res.status).toBe(500)
  })
})
