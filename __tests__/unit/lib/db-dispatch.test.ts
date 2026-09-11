jest.mock('@/lib/setup', () => ({ getSiteConfig: jest.fn() }))
jest.mock('@/lib/db-sqlite', () => ({
  getSqliteDb: jest.fn().mockReturnValue({ execute: jest.fn() }),
  setupSqliteDatabase: jest.fn().mockResolvedValue(undefined),
  withSqliteTransaction: jest.fn(),
  resetSqlitePool: jest.fn(),
}))
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn().mockReturnValue({ execute: jest.fn(), getConnection: jest.fn() }),
  createConnection: jest.fn(),
}))

import { getSiteConfig } from '@/lib/setup'
import { getSqliteDb, setupSqliteDatabase, resetSqlitePool } from '@/lib/db-sqlite'
import { getDb, setupDatabase, resetPool } from '@/lib/db'

describe('lib/db dialect dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetPool()
  })

  it('delegates getDb() to the sqlite driver when dialect is sqlite', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue({ db: { dialect: 'sqlite', file: 'data/pixxel.db' } })
    getDb()
    expect(getSqliteDb).toHaveBeenCalledWith('data/pixxel.db')
  })

  it('delegates setupDatabase() to the sqlite driver when dialect is sqlite', async () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue({ db: { dialect: 'sqlite', file: 'data/pixxel.db' } })
    await setupDatabase()
    expect(setupSqliteDatabase).toHaveBeenCalledWith('data/pixxel.db')
  })

  it('resetPool() also resets the sqlite pool', () => {
    resetPool()
    expect(resetSqlitePool).toHaveBeenCalled()
  })

  it('uses the mysql2 pool when dialect is mysql (default)', () => {
    ;(getSiteConfig as jest.Mock).mockReturnValue(null)
    process.env.DB_HOST = 'localhost'
    const db = getDb()
    expect(getSqliteDb).not.toHaveBeenCalled()
    expect(db).toBeDefined()
    delete process.env.DB_HOST
  })
})
