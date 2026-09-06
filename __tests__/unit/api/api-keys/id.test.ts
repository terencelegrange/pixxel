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
import { DELETE } from '@/app/api/api-keys/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test Admin', email: 'admin@example.com', role: 'Admin' } })
})

const params = { params: Promise.resolve({ id: 'k1' }) }
const dbRow = { id: 'k1', name: 'Reporting', key_prefix: 'pxk_abcdef', revoked_at: null }

function makeReq() {
  return new NextRequest('http://localhost/api/api-keys/k1', { method: 'DELETE' })
}

describe('DELETE /api/api-keys/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    (requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await DELETE(makeReq(), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when the key does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq(), params)
    expect(res.status).toBe(404)
  })

  it('revokes an active key and writes a sanitized audit entry', async () => {
    mockExecute.mockResolvedValueOnce([[dbRow]]) // SELECT
    mockExecute.mockResolvedValueOnce([{}])       // UPDATE revoked_at
    const res = await DELETE(makeReq(), params)
    expect(res.status).toBe(200)
    expect(writeAudit).toHaveBeenCalledTimes(1)
    const auditCall = (writeAudit as jest.Mock).mock.calls[0][0]
    expect(auditCall.oldValues).not.toHaveProperty('keyHash')
    expect(auditCall.oldValues).not.toHaveProperty('key_hash')
  })

  it('is idempotent on an already-revoked key (no duplicate audit entry)', async () => {
    mockExecute.mockResolvedValueOnce([[{ ...dbRow, revoked_at: new Date() }]])
    const res = await DELETE(makeReq(), params)
    expect(res.status).toBe(200)
    expect(writeAudit).not.toHaveBeenCalled()
  })
})
