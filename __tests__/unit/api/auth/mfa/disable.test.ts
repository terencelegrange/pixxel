import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } }),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('bcryptjs', () => ({ compare: jest.fn() }))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import bcrypt from 'bcryptjs'
import { POST } from '@/app/api/auth/mfa/disable/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } })
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/auth/mfa/disable', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/auth/mfa/disable', () => {
  it('returns 400 when password is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when MFA is not enabled', async () => {
    mockExecute.mockResolvedValueOnce([[{ password: 'hash', mfa_enabled: 0 }]])
    const res = await POST(makeReq({ password: 'x' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when the password is incorrect', async () => {
    mockExecute.mockResolvedValueOnce([[{ password: 'hash', mfa_enabled: 1 }]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeReq({ password: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('clears MFA fields and deletes recovery codes on success', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ password: 'hash', mfa_enabled: 1 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

    const res = await POST(makeReq({ password: 'correct' }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE users SET mfa_enabled = ?, mfa_secret = NULL, mfa_pending_secret = NULL WHERE id = ?',
      [false, 'u1']
    )
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM user_mfa_recovery_codes WHERE user_id = ?', ['u1'])

    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ tableName: 'users', action: 'UPDATE' }))
  })
})
