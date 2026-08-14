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
})
