const ORIGINAL_ENV = process.env.JWT_SECRET

beforeAll(() => {
  process.env.JWT_SECRET = 'a'.repeat(32)
})
afterAll(() => {
  process.env.JWT_SECRET = ORIGINAL_ENV
})

import { encryptSecret, decryptSecret } from '@/lib/mfa-crypto'

describe('mfa-crypto', () => {
  it('round-trips a secret through encrypt/decrypt', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP'
    const encrypted = encryptSecret(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(decryptSecret(encrypted)).toBe(plaintext)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP'
    const a = encryptSecret(plaintext)
    const b = encryptSecret(plaintext)
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe(plaintext)
    expect(decryptSecret(b)).toBe(plaintext)
  })

  it('throws when the ciphertext has been tampered with', () => {
    const encrypted = encryptSecret('JBSWY3DPEHPK3PXP')
    const [iv, authTag, ciphertext] = encrypted.split(':')
    const tampered = [iv, authTag, Buffer.from('tampered-ciphertext').toString('base64')].join(':')
    void ciphertext
    expect(() => decryptSecret(tampered)).toThrow()
  })

  describe('MFA_ENCRYPTION_KEY', () => {
    const ORIGINAL_MFA_KEY = process.env.MFA_ENCRYPTION_KEY

    afterEach(() => {
      process.env.MFA_ENCRYPTION_KEY = ORIGINAL_MFA_KEY
    })

    it('uses MFA_ENCRYPTION_KEY over JWT_SECRET when set, and still round-trips', () => {
      process.env.MFA_ENCRYPTION_KEY = 'b'.repeat(32)
      const plaintext = 'JBSWY3DPEHPK3PXP'
      const encrypted = encryptSecret(plaintext)
      expect(decryptSecret(encrypted)).toBe(plaintext)
    })

    it('produces ciphertext undecryptable by the JWT_SECRET-derived key alone (keys are actually independent)', () => {
      process.env.MFA_ENCRYPTION_KEY = 'b'.repeat(32)
      const encryptedWithMfaKey = encryptSecret('JBSWY3DPEHPK3PXP')

      delete process.env.MFA_ENCRYPTION_KEY
      expect(() => decryptSecret(encryptedWithMfaKey)).toThrow()
    })

    it('falls back to the JWT_SECRET derivation, unchanged, when MFA_ENCRYPTION_KEY is unset', () => {
      delete process.env.MFA_ENCRYPTION_KEY
      const plaintext = 'JBSWY3DPEHPK3PXP'
      const encrypted = encryptSecret(plaintext)
      expect(decryptSecret(encrypted)).toBe(plaintext)
    })
  })
})
