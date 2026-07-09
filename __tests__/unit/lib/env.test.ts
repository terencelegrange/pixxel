import fs from 'fs'

jest.mock('fs')

import { validateEnv } from '@/lib/env'

const ORIGINAL_ENV = process.env

describe('validateEnv', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.JWT_SECRET
    delete process.env.DB_HOST
    delete process.env.DB_USER
    delete process.env.DB_PASSWORD
    delete process.env.DB_NAME
    // No site.config.json on disk by default — a brand-new instance.
    ;(fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('ENOENT')
    })
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('does not require DB env vars on a fresh, unconfigured instance', () => {
    process.env.JWT_SECRET = 'x'.repeat(32)

    expect(() => validateEnv()).not.toThrow()
  })

  it('still requires JWT_SECRET on a fresh instance', () => {
    expect(() => validateEnv()).toThrow(/JWT_SECRET is not set/)
  })

  it('rejects a JWT_SECRET shorter than 32 chars', () => {
    process.env.JWT_SECRET = 'too-short'

    expect(() => validateEnv()).toThrow(/JWT_SECRET is too short/)
  })

  it('requires the rest of the DB env vars once one is supplied (catches typos)', () => {
    process.env.JWT_SECRET = 'x'.repeat(32)
    process.env.DB_HOST = 'localhost'
    // DB_USER/DB_PASSWORD/DB_NAME intentionally left unset

    expect(() => validateEnv()).toThrow(/DB_USER is not set/)
    expect(() => validateEnv()).toThrow(/DB_PASSWORD is not set/)
    expect(() => validateEnv()).toThrow(/DB_NAME is not set/)
  })

  it('passes when all DB env vars are supplied (pre-configured docker-compose path)', () => {
    process.env.JWT_SECRET = 'x'.repeat(32)
    process.env.DB_HOST = 'localhost'
    process.env.DB_USER = 'root'
    process.env.DB_PASSWORD = 'secret'
    process.env.DB_NAME = 'pixxel'

    expect(() => validateEnv()).not.toThrow()
  })

  it('does not require DB env vars once setup has completed via site.config.json (sqlite)', () => {
    process.env.JWT_SECRET = 'x'.repeat(32)
    ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      setupComplete: true,
      appName: 'Pixxel',
      orgName: 'Acme',
      db: { dialect: 'sqlite', file: 'data/pixxel.db' },
    }))

    expect(() => validateEnv()).not.toThrow()
  })

  it('does not require DB env vars once setup has completed via site.config.json (mysql)', () => {
    process.env.JWT_SECRET = 'x'.repeat(32)
    ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      setupComplete: true,
      appName: 'Pixxel',
      orgName: 'Acme',
      db: { dialect: 'mysql', host: 'db', port: 3306, user: 'root', password: '', name: 'pixxel' },
    }))

    expect(() => validateEnv()).not.toThrow()
  })
})
