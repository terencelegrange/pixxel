import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test Admin', email: 'admin@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { writeAudit } from '@/lib/audit'
import { GET, POST } from '@/app/api/api-keys/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test Admin', email: 'admin@example.com', role: 'Admin' } })
})

const dbRow = {
  id: 'k1', name: 'Reporting', contact: 'ops@example.com', key_prefix: 'pxk_abcdef',
  created_by_id: 'u1', created_by_name: 'Test Admin', expires_at: null, last_used_at: null,
  use_count: 3, revoked_at: null, created_at: new Date('2026-01-01'),
}

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/api-keys', () => {
  it('returns 401 when not authenticated', async () => {
    (requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/api-keys'))
    expect(res.status).toBe(401)
  })

  it('returns the key list without keyHash', async () => {
    mockExecute.mockResolvedValueOnce([[dbRow]])
    const res = await GET(new NextRequest('http://localhost/api/api-keys'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.apiKeys).toHaveLength(1)
    expect(body.apiKeys[0]).not.toHaveProperty('keyHash')
    expect(body.apiKeys[0]).not.toHaveProperty('key_hash')
    expect(body.apiKeys[0].useCount).toBe(3)
  })
})

describe('POST /api/api-keys', () => {
  it('returns 401 when not authenticated', async () => {
    (requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await POST(makeReq({ name: 'X' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid expiresInDays', async () => {
    const res = await POST(makeReq({ name: 'X', expiresInDays: 14 }))
    expect(res.status).toBe(400)
  })

  it('creates a key, returns rawKey only in this response, and audits without the raw key/hash', async () => {
    mockExecute.mockResolvedValueOnce([{}]) // INSERT
    const res = await POST(makeReq({ name: 'Reporting', contact: 'ops@example.com', expiresInDays: 90 }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(typeof body.rawKey).toBe('string')
    expect(body.rawKey.startsWith('pxk_')).toBe(true)
    expect(body.name).toBe('Reporting')

    expect(writeAudit).toHaveBeenCalledTimes(1)
    const auditCall = (writeAudit as jest.Mock).mock.calls[0][0]
    expect(JSON.stringify(auditCall)).not.toContain(body.rawKey)
    expect(auditCall.newValues).not.toHaveProperty('keyHash')
    expect(auditCall.newValues).not.toHaveProperty('rawKey')
  })

  it('accepts expiresInDays: null (never expires)', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Never expires', expiresInDays: null }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.expiresAt).toBeNull()
  })
})
