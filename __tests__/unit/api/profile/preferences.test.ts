import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, PUT } from '@/app/api/profile/preferences/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } })
})

describe('GET /api/profile/preferences', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/profile/preferences'))
    expect(res.status).toBe(401)
  })

  it('returns defaults when no row is found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/api/profile/preferences'))
    expect(await res.json()).toEqual({
      timezone: null, language: 'en', notifyNewFeedback: false, notifyContractsExpiring: false,
      tourEnabled: true, tourSeenAt: null,
    })
  })

  it('returns the stored preferences', async () => {
    mockExecute.mockResolvedValueOnce([[{
      timezone: 'Australia/Sydney', language: 'en', notify_new_feedback: 1, notify_contracts_expiring: 0,
      tour_enabled: 0, tour_seen_at: '2026-01-01T00:00:00.000Z',
    }]])
    const res = await GET(new NextRequest('http://localhost/api/profile/preferences'))
    expect(await res.json()).toEqual({
      timezone: 'Australia/Sydney', language: 'en', notifyNewFeedback: true, notifyContractsExpiring: false,
      tourEnabled: false, tourSeenAt: '2026-01-01T00:00:00.000Z',
    })
  })
})

describe('PUT /api/profile/preferences', () => {
  function makeReq(body: object) {
    return new NextRequest('http://localhost/api/profile/preferences', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  }

  it('returns 400 when no fields are given', async () => {
    const res = await PUT(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('only updates the fields present in the body (partial update)', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ timezone: 'Europe/London', language: 'fr' }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE users SET timezone = ?, language = ? WHERE id = ?',
      ['Europe/London', 'fr', 'u1']
    )
  })

  it('updates only notification toggles when that is all that is given, without touching timezone/language', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ notifyNewFeedback: false, notifyContractsExpiring: true }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE users SET notify_new_feedback = ?, notify_contracts_expiring = ? WHERE id = ?',
      [false, true, 'u1']
    )
  })

  it('updates tourEnabled independently of other fields', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ tourEnabled: false }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE users SET tour_enabled = ? WHERE id = ?',
      [false, 'u1']
    )
  })

  it('marks the tour seen (server-set NOW(), never a client-supplied timestamp) when tourSeen: true', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ tourSeen: true }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE users SET tour_seen_at = NOW() WHERE id = ?',
      ['u1']
    )
  })

  it('clears the tour seen-at timestamp when tourSeen: false (Replay)', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ tourSeen: false }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE users SET tour_seen_at = NULL WHERE id = ?',
      ['u1']
    )
  })
})
