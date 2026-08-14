import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/jwt', () => ({
  signJwt: jest.fn().mockReturnValue('session-token'),
}))
jest.mock('@/lib/mfa', () => ({
  verifyMfaChallengeToken: jest.fn(),
  verifyTotp: jest.fn(),
  verifyRecoveryCode: jest.fn(),
}))
jest.mock('@/lib/mfa-crypto', () => ({
  decryptSecret: jest.fn().mockReturnValue('decrypted-secret'),
}))

import { getDb } from '@/lib/db'
import { verifyMfaChallengeToken, verifyTotp, verifyRecoveryCode } from '@/lib/mfa'
import { POST } from '@/app/api/auth/mfa/challenge/route'

const mockExecute = jest.fn()
const dbUser = {
  id: 'u1', name: 'Jane Smith', email: 'jane@example.com', role: 'Member',
  created_at: new Date('2025-01-01'), token_version: 2, mfa_secret: 'encrypted-secret',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(verifyMfaChallengeToken as jest.Mock).mockReturnValue({ sub: 'u1' })
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/auth/mfa/challenge', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/auth/mfa/challenge', () => {
  it('returns 400 when mfaToken is missing', async () => {
    const res = await POST(makeReq({ code: '123456' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither code nor recoveryCode is given', async () => {
    const res = await POST(makeReq({ mfaToken: 't' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when the mfaToken is invalid or expired', async () => {
    ;(verifyMfaChallengeToken as jest.Mock).mockReturnValueOnce(null)
    const res = await POST(makeReq({ mfaToken: 'bad', code: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the user has no MFA secret', async () => {
    mockExecute.mockResolvedValueOnce([[{ ...dbUser, mfa_secret: null }]])
    const res = await POST(makeReq({ mfaToken: 't', code: '123456' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the TOTP code is invalid', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])
    ;(verifyTotp as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeReq({ mfaToken: 't', code: '000000' }))
    expect(res.status).toBe(401)
  })

  it('issues a session and sets the authToken cookie on a valid TOTP code', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])
    ;(verifyTotp as jest.Mock).mockResolvedValueOnce(true)
    const res = await POST(makeReq({ mfaToken: 't', code: '123456' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({ id: 'u1', email: 'jane@example.com' })
    expect(body.token).toBe('session-token')
    expect(res.cookies.get('authToken')?.value).toBe('session-token')
  })

  it('accepts a valid unused recovery code and marks it used', async () => {
    mockExecute
      .mockResolvedValueOnce([[dbUser]]) // SELECT user
      .mockResolvedValueOnce([[{ id: 'code-1', code_hash: 'hash1' }, { id: 'code-2', code_hash: 'hash2' }]]) // SELECT unused codes
      .mockResolvedValueOnce([{}]) // UPDATE used_at
    ;(verifyRecoveryCode as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    const res = await POST(makeReq({ mfaToken: 't', recoveryCode: 'BBBBB-22222' }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE user_mfa_recovery_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['code-2']
    )
  })

  it('returns 401 when the recovery code does not match any unused code', async () => {
    mockExecute
      .mockResolvedValueOnce([[dbUser]])
      .mockResolvedValueOnce([[{ id: 'code-1', code_hash: 'hash1' }]])
    ;(verifyRecoveryCode as jest.Mock).mockResolvedValueOnce(false)

    const res = await POST(makeReq({ mfaToken: 't', recoveryCode: 'WRONG-CODE0' }))
    expect(res.status).toBe(401)
  })

  it('returns 429 after exceeding the rate limit', async () => {
    mockExecute.mockResolvedValue([[dbUser]])
    ;(verifyTotp as jest.Mock).mockResolvedValue(false)
    let lastRes
    for (let i = 0; i < 9; i++) {
      lastRes = await POST(makeReq({ mfaToken: 't', code: '000000' }))
    }
    expect(lastRes!.status).toBe(429)
  })
})
