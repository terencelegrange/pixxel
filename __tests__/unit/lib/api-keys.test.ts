import { generateApiKey, hashApiKey, keyPrefixFor, looksLikeApiKey } from '@/lib/api-keys'

describe('lib/api-keys', () => {
  it('generates keys with the "pxk_" prefix', () => {
    const key = generateApiKey()
    expect(key.startsWith('pxk_')).toBe(true)
    expect(key.length).toBeGreaterThan(40)
  })

  it('generates unique keys across calls', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateApiKey()))
    expect(keys.size).toBe(20)
  })

  it('hashes deterministically to a 64-char hex digest', () => {
    const key = generateApiKey()
    const hash1 = hashApiKey(key)
    const hash2 = hashApiKey(key)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different hashes for different keys', () => {
    expect(hashApiKey(generateApiKey())).not.toBe(hashApiKey(generateApiKey()))
  })

  it('derives a short display prefix from the raw key', () => {
    const key = generateApiKey()
    const prefix = keyPrefixFor(key)
    expect(prefix).toBe(key.slice(0, 10))
    expect(key.startsWith(prefix)).toBe(true)
  })

  it('recognizes well-formed keys', () => {
    expect(looksLikeApiKey(generateApiKey())).toBe(true)
  })

  it('rejects malformed or short values without a DB hit', () => {
    expect(looksLikeApiKey('not-a-key')).toBe(false)
    expect(looksLikeApiKey('pxk_short')).toBe(false)
    expect(looksLikeApiKey('')).toBe(false)
  })
})
