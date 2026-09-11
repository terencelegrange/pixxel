import { NextRequest } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET } from '@/app/api/auth/me/route'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/auth/me', () => {
  it('returns 401 when the session is invalid/expired/revoked', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Session expired. Please log in again.' }), { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/auth/me'))
    expect(res.status).toBe(401)
  })

  it('returns the current user, freshly read from the DB', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: true, user: { id: 'u1', name: 'Jane Doe', email: 'jane@example.com', role: 'Member' } })
    mockExecute.mockResolvedValueOnce([[{
      id: 'u1', name: 'Jane Doe', email: 'jane@example.com', role: 'Member',
      created_at: new Date('2025-01-01T00:00:00.000Z'),
    }]])
    const res = await GET(new NextRequest('http://localhost/api/auth/me'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      user: {
        id: 'u1', name: 'Jane Doe', email: 'jane@example.com',
        avatarInitials: 'JD', role: 'Member', createdAt: '2025-01-01T00:00:00.000Z',
      },
    })
  })

  it('returns 401 if the user row is gone (e.g. deleted after the token was issued)', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: true, user: { id: 'u1', name: 'Jane Doe', email: 'jane@example.com', role: 'Member' } })
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/api/auth/me'))
    expect(res.status).toBe(401)
  })

  it('returns 500 when the DB throws', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: true, user: { id: 'u1', name: 'Jane Doe', email: 'jane@example.com', role: 'Member' } })
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await GET(new NextRequest('http://localhost/api/auth/me'))
    expect(res.status).toBe(500)
  })
})
