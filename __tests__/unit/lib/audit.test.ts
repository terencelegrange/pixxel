jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
  setupDatabase: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { writeAudit } from '@/lib/audit'

const mockExecute = jest.fn().mockResolvedValue([{}])
beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue([{}])
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('writeAudit', () => {
  it('inserts a row into audit_log with correct column order', async () => {
    await writeAudit({
      tableName: 'assets', recordId: 'a1', action: 'CREATE',
      performedById: 'u1', performedByName: 'Admin',
      oldValues: null, newValues: { name: 'MyApp' },
    })
    expect(mockExecute).toHaveBeenCalledTimes(1)
    const [sql, params] = mockExecute.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO audit_log/)
    expect(params[1]).toBe('assets')                              // table_name
    expect(params[2]).toBe('a1')                                  // record_id
    expect(params[3]).toBe('CREATE')                              // action
    expect(params[4]).toBe('u1')                                  // performed_by_id
    expect(params[5]).toBe('Admin')                               // performed_by_name
    expect(params[6]).toBeNull()                                  // old_values — null for CREATE
    expect(params[7]).toBe(JSON.stringify({ name: 'MyApp' }))    // new_values
  })

  it('generates a UUID for each call', async () => {
    await writeAudit({ tableName: 'users', recordId: 'u1', action: 'DELETE',
      performedById: 'u2', performedByName: 'Admin', oldValues: null, newValues: null })
    await writeAudit({ tableName: 'users', recordId: 'u1', action: 'DELETE',
      performedById: 'u2', performedByName: 'Admin', oldValues: null, newValues: null })
    const id1 = mockExecute.mock.calls[0][1][0]
    const id2 = mockExecute.mock.calls[1][1][0]
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('passes null (not "null") for missing oldValues on CREATE', async () => {
    await writeAudit({ tableName: 'assets', recordId: 'a1', action: 'CREATE',
      performedById: 'u1', performedByName: 'Admin', oldValues: null, newValues: {} })
    const params = mockExecute.mock.calls[0][1]
    expect(params[6]).toBeNull()
  })

  it('serialises both oldValues and newValues for UPDATE', async () => {
    const old = { name: 'Old' }
    const next = { name: 'New' }
    await writeAudit({ tableName: 'assets', recordId: 'a1', action: 'UPDATE',
      performedById: 'u1', performedByName: 'Admin', oldValues: old, newValues: next })
    const params = mockExecute.mock.calls[0][1]
    expect(params[6]).toBe(JSON.stringify(old))
    expect(params[7]).toBe(JSON.stringify(next))
  })
})
