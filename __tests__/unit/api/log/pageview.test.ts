import { NextRequest } from 'next/server'

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn(),
}))

import logger from '@/lib/logger'
import { requireUser } from '@/lib/require-user'
import { POST } from '@/app/api/log/pageview/route'

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } })
})

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/log/pageview', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/log/pageview', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) })
    const res = await POST(makeReq({ path: '/dashboard' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when path is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('logs a "page_view" line with the path, user id, and role', async () => {
    const res = await POST(makeReq({ path: '/assets' }))
    expect(res.status).toBe(200)
    expect(logger.info).toHaveBeenCalledWith(
      { path: '/assets', userId: 'u1', role: 'Member' },
      'page_view'
    )
  })
})
