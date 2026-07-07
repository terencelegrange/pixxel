jest.mock('@/lib/setup', () => ({
  getSiteConfig: jest.fn(),
}))

import { getSiteConfig } from '@/lib/setup'
import { getDbDialect, getSqliteFilePath } from '@/lib/db'

describe('getDbDialect', () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...OLD_ENV }
    delete process.env.DB_TYPE
  })
  afterAll(() => { process.env = OLD_ENV })

  it('defaults to mysql when no config or env is set', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue(null)
    expect(getDbDialect()).toBe('mysql')
  })

  it('reads dialect from site.config.json when present', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue({
      db: { dialect: 'sqlite', file: 'data/pixxel.db' },
    })
    expect(getDbDialect()).toBe('sqlite')
  })

  it('falls back to DB_TYPE env var when no site.config.json', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue(null)
    process.env.DB_TYPE = 'sqlite'
    expect(getDbDialect()).toBe('sqlite')
  })
})

describe('getSqliteFilePath', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reads the file path from site.config.json', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue({
      db: { dialect: 'sqlite', file: 'data/custom.db' },
    })
    expect(getSqliteFilePath()).toBe('data/custom.db')
  })

  it('falls back to DB_FILE env var, then a default path', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue(null)
    process.env.DB_FILE = 'data/from-env.db'
    expect(getSqliteFilePath()).toBe('data/from-env.db')
    delete process.env.DB_FILE
    expect(getSqliteFilePath()).toContain('pixxel.db')
  })
})
