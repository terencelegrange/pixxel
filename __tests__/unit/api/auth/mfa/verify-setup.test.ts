import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } }),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/mfa', () => ({
  verifyTotp: jest.fn(),
  generateRecoveryCodes: jest.fn().mockReturnValue(['AAAAA-11111', 'BBBBB-22222']),
  hashRecoveryCode: jest.fn().mockImplementation((code: string) => Promise.resolve(`hashed-${code}`)),
}))
jest.mock('@/lib/mfa-crypto', () => ({
  decryptSecret: jest.fn().mockReturnValue('decrypted-secret'),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { verifyTotp } from '@/lib/mfa'
import { POST } from '@/app/api/auth/mfa/verify-setup/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } })
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/auth/mfa/verify-setup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/auth/mfa/verify-setup', () => {
  it('returns 400 when code is missing', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when there is no pending secret', async () => {
    mockExecute.mockResolvedValueOnce([[{ mfa_pending_secret: null }]])
    const res = await POST(makeReq({ code: '123456' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the code is invalid', async () => {
    mockExecute.mockResolvedValueOnce([[{ mfa_pending_secret: 'encrypted' }]])
    ;(verifyTotp as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeReq({ code: '000000' }))
    expect(res.status).toBe(400)
  })

  it('enables MFA, replaces recovery codes, and returns them on success', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ mfa_pending_secret: 'encrypted' }]]) // SELECT pending
      .mockResolvedValueOnce([{}]) // UPDATE users
      .mockResolvedValueOnce([{}]) // DELETE old recovery codes
      .mockResolvedValueOnce([{}]) // INSERT code 1
      .mockResolvedValueOnce([{}]) // INSERT code 2
    ;(verifyTotp as jest.Mock).mockResolvedValueOnce(true)

    const res = await POST(makeReq({ code: '123456' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recoveryCodes).toEqual(['AAAAA-11111', 'BBBBB-22222'])

    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE users SET mfa_enabled = ?, mfa_secret = ?, mfa_pending_secret = NULL WHERE id = ?',
      [true, 'encrypted', 'u1']
    )
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM user_mfa_recovery_codes WHERE user_id = ?', ['u1'])

    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ tableName: 'users', action: 'UPDATE' }))
  })
})
