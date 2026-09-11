import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import {
  getSqliteDb, setupSqliteDatabase, withSqliteTransaction, resetSqlitePool,
} from '@/lib/db-sqlite'

describe('lib/db-sqlite', () => {
  let dbFile: string

  beforeEach(() => {
    dbFile = path.join(os.tmpdir(), `pixxel-test-${randomUUID()}.db`)
  })

  afterEach(() => {
    resetSqlitePool()
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile)
  })

  it('applies migrations and seeds reference data on first setup', async () => {
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const [types] = await db.execute<{ name: string }[]>('SELECT name FROM diagram_types ORDER BY sort_order')
    expect(types.map((t) => t.name)).toEqual(['Domain', 'Program', 'Solution', 'Detailed'])

    const [classifications] = await db.execute<{ name: string }[]>('SELECT name FROM investment_classifications ORDER BY sort_order')
    expect(classifications.map((c) => c.name)).toEqual(['Invest', 'Experiment', 'Contain', 'Decommission'])
  })

  it('is idempotent — running setup twice does not duplicate seed rows or re-run migrations', async () => {
    await setupSqliteDatabase(dbFile)
    resetSqlitePool()
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const [rows] = await db.execute<{ n: number }[]>('SELECT COUNT(*) AS n FROM diagram_types')
    expect(rows[0].n).toBe(4)
  })

  it('inserts and reads rows via execute()', async () => {
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const id = randomUUID()
    await db.execute('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [id, 'Jane', 'jane@example.com', 'hashed'])
    const [rows] = await db.execute<{ name: string }[]>('SELECT name FROM users WHERE id = ?', [id])
    expect(rows[0].name).toBe('Jane')
  })

  it('fires the updated_at trigger on UPDATE', async () => {
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const id = randomUUID()
    await db.execute('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [id, 'Jane', 'jane@example.com', 'hashed'])
    const [[before]] = [(await db.execute<{ updated_at: string }[]>('SELECT updated_at FROM users WHERE id = ?', [id]))[0]]
    await new Promise((r) => setTimeout(r, 1100))
    await db.execute('UPDATE users SET name = ? WHERE id = ?', ['Jane Doe', id])
    const [[after]] = [(await db.execute<{ updated_at: string }[]>('SELECT updated_at FROM users WHERE id = ?', [id]))[0]]
    expect(after.updated_at).not.toBe(before.updated_at)
  })

  // Regression test: node:sqlite's DatabaseSync only accepts
  // null/number/bigint/string/Uint8Array as bind values. mysql2 silently
  // coerces JS booleans to 0/1, so route code (e.g. contracts.auto_renews)
  // writes real booleans without ever hitting this in MySQL mode. Without
  // coercion in execute(), this throws "Provided value cannot be bound to
  // SQLite parameter N".
  it('coerces boolean bind params to 0/1 instead of throwing', async () => {
    await setupSqliteDatabase(dbFile)
    const db = getSqliteDb(dbFile)
    const id = randomUUID()
    await expect(db.execute(
      `INSERT INTO contracts (id, title, status, auto_renews, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, 'Test Contract', 'Active', true, 'u1', 'Admin']
    )).resolves.toBeDefined()

    const [rows] = await db.execute<{ auto_renews: number }[]>(
      'SELECT auto_renews FROM contracts WHERE id = ?', [id]
    )
    expect(rows[0].auto_renews).toBe(1)
  })

  it('commits a successful transaction and rolls back a failed one', async () => {
    await setupSqliteDatabase(dbFile)
    const okId = randomUUID()
    await withSqliteTransaction(dbFile, async (tx) => {
      await tx.execute('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [okId, 'A', 'a@example.com', 'x'])
    })

    const failId = randomUUID()
    await expect(withSqliteTransaction(dbFile, async (tx) => {
      await tx.execute('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [failId, 'B', 'b@example.com', 'x'])
      throw new Error('boom')
    })).rejects.toThrow('boom')

    const db = getSqliteDb(dbFile)
    const [okRows] = await db.execute<unknown[]>('SELECT id FROM users WHERE id = ?', [okId])
    const [failRows] = await db.execute<unknown[]>('SELECT id FROM users WHERE id = ?', [failId])
    expect(okRows).toHaveLength(1)
    expect(failRows).toHaveLength(0)
  })
})
