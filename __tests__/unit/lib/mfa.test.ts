const ORIGINAL_ENV = process.env.JWT_SECRET

beforeAll(() => {
  process.env.JWT_SECRET = 'a'.repeat(32)
})
afterAll(() => {
  process.env.JWT_SECRET = ORIGINAL_ENV
})

import {
  generateMfaSecret, getOtpAuthUri, getQrCodeDataUrl, verifyTotp, generateTotp,
  generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode,
  signMfaChallengeToken, verifyMfaChallengeToken,
} from '@/lib/mfa'

describe('TOTP', () => {
  it('generates a base32-looking secret', async () => {
    const secret = await generateMfaSecret()
    expect(secret).toMatch(/^[A-Z2-7]+$/)
    expect(secret.length).toBeGreaterThanOrEqual(16)
  })

  it('builds an otpauth:// URI with the Pixxel issuer and the given email', () => {
    const uri = getOtpAuthUri('jane@example.com', 'JBSWY3DPEHPK3PXP')
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain('Pixxel')
    expect(uri).toContain(encodeURIComponent('jane@example.com'))
  })

  it('renders a data:image QR code from an otpauth URI', async () => {
    const uri = getOtpAuthUri('jane@example.com', 'JBSWY3DPEHPK3PXP')
    const dataUrl = await getQrCodeDataUrl(uri)
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('verifies a code generated from the same secret', async () => {
    const secret = await generateMfaSecret()
    const code = await generateTotp(secret)
    expect(await verifyTotp(secret, code)).toBe(true)
  })

  it('rejects a code generated from a different secret', async () => {
    const secretA = await generateMfaSecret()
    const secretB = await generateMfaSecret()
    const code = await generateTotp(secretA)
    expect(await verifyTotp(secretB, code)).toBe(false)
  })

  it('rejects non-6-digit input without throwing', async () => {
    const secret = await generateMfaSecret()
    expect(await verifyTotp(secret, '123')).toBe(false)
    expect(await verifyTotp(secret, 'abcdef')).toBe(false)
    expect(await verifyTotp(secret, '')).toBe(false)
  })
})

describe('recovery codes', () => {
  it('generates 10 unique codes by default, formatted XXXXX-XXXXX', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const c of codes) expect(c).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/)
  })

  it('supports a custom count', () => {
    expect(generateRecoveryCodes(3)).toHaveLength(3)
  })

  it('hashes and verifies a recovery code', async () => {
    const [code] = generateRecoveryCodes(1)
    const hash = await hashRecoveryCode(code)
    expect(hash).not.toBe(code)
    expect(await verifyRecoveryCode(code, hash)).toBe(true)
    expect(await verifyRecoveryCode('WRONG-CODE1', hash)).toBe(false)
  })
})

describe('MFA challenge token', () => {
  it('round-trips sub through sign/verify', () => {
    const token = signMfaChallengeToken('user-123')
    const result = verifyMfaChallengeToken(token)
    expect(result).toEqual({ sub: 'user-123' })
  })

  it('rejects a tampered token', () => {
    const token = signMfaChallengeToken('user-123')
    const tampered = token.slice(0, -4) + 'abcd'
    expect(verifyMfaChallengeToken(tampered)).toBeNull()
  })

  it('rejects a malformed token', () => {
    expect(verifyMfaChallengeToken('not-a-jwt')).toBeNull()
  })

  it('rejects an expired token', () => {
    jest.useFakeTimers().setSystemTime(new Date('2020-01-01T00:00:00Z'))
    const token = signMfaChallengeToken('user-123')
    jest.setSystemTime(new Date('2020-01-01T00:10:00Z')) // 10 min later, past the 5 min TTL
    expect(verifyMfaChallengeToken(token)).toBeNull()
    jest.useRealTimers()
  })
})
