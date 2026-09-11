import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } }),
}))
jest.mock('@/lib/mfa', () => ({
  generateMfaSecret: jest.fn().mockResolvedValue('SECRET123'),
  getOtpAuthUri: jest.fn().mockReturnValue('otpauth://totp/Pixxel:test@example.com?secret=SECRET123&issuer=Pixxel'),
  getQrCodeDataUrl: jest.fn().mockResolvedValue('data:image/png;base64,abc'),
}))
jest.mock('@/lib/mfa-crypto', () => ({
  encryptSecret: jest.fn().mockReturnValue('encrypted-secret'),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { POST } from '@/app/api/auth/mfa/setup/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } })
})

describe('POST /api/auth/mfa/setup', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) })
    const res = await POST(new NextRequest('http://localhost/api/auth/mfa/setup', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when MFA is already enabled', async () => {
    mockExecute.mockResolvedValueOnce([[{ mfa_enabled: 1 }]])
    const res = await POST(new NextRequest('http://localhost/api/auth/mfa/setup', { method: 'POST' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with secret, otpauthUri, qrCodeDataUrl and stores the encrypted pending secret', async () => {
    mockExecute.mockResolvedValueOnce([[{ mfa_enabled: 0 }]]).mockResolvedValueOnce([{}])
    const res = await POST(new NextRequest('http://localhost/api/auth/mfa/setup', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      secret: 'SECRET123',
      otpauthUri: 'otpauth://totp/Pixxel:test@example.com?secret=SECRET123&issuer=Pixxel',
      qrCodeDataUrl: 'data:image/png;base64,abc',
    })
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE users SET mfa_pending_secret = ? WHERE id = ?',
      ['encrypted-secret', 'u1']
    )
  })
})
