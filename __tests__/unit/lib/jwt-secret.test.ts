import fs from 'fs'

jest.mock('fs')

import { getOrCreateJwtSecret } from '@/lib/jwt-secret'

describe('getOrCreateJwtSecret', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('generates and persists a new secret when none exists on disk', () => {
    ;(fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const secret = getOrCreateJwtSecret()

    expect(secret.length).toBeGreaterThanOrEqual(32)
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
    const [writtenPath, writtenValue, opts] = (fs.writeFileSync as jest.Mock).mock.calls[0]
    expect(String(writtenPath)).toContain('.jwt-secret')
    expect(writtenValue).toBe(secret)
    expect(opts).toMatchObject({ mode: 0o600 })
  })

  it('reuses an existing persisted secret without writing a new one', () => {
    const persisted = 'a'.repeat(44)
    ;(fs.readFileSync as jest.Mock).mockReturnValue(persisted)

    const secret = getOrCreateJwtSecret()

    expect(secret).toBe(persisted)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('regenerates if the persisted file exists but is too short to be a valid secret', () => {
    ;(fs.readFileSync as jest.Mock).mockReturnValue('short')

    const secret = getOrCreateJwtSecret()

    expect(secret.length).toBeGreaterThanOrEqual(32)
    expect(secret).not.toBe('short')
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
  })

  it('generates a different secret on each call when nothing is persisted (no hardcoded fallback)', () => {
    ;(fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const a = getOrCreateJwtSecret()
    const b = getOrCreateJwtSecret()

    expect(a).not.toBe(b)
  })
})
