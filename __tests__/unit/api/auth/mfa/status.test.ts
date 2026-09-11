import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET } from '@/app/api/auth/mfa/status/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } })
})

describe('GET /api/auth/mfa/status', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/auth/mfa/status'))
    expect(res.status).toBe(401)
  })

  it('returns enabled:false when mfa_enabled is 0', async () => {
    mockExecute.mockResolvedValueOnce([[{ mfa_enabled: 0 }]])
    const res = await GET(new NextRequest('http://localhost/api/auth/mfa/status'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enabled: false })
  })

  it('returns enabled:true when mfa_enabled is 1', async () => {
    mockExecute.mockResolvedValueOnce([[{ mfa_enabled: 1 }]])
    const res = await GET(new NextRequest('http://localhost/api/auth/mfa/status'))
    expect(await res.json()).toEqual({ enabled: true })
  })
})
