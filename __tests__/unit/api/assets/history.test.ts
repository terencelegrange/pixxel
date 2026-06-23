import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { GET } from '@/app/api/assets/[id]/history/route'

const mockExecute = jest.fn()
const params = { params: { id: 'asset-1' } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/assets/[id]/history', () => {
  it('returns audit log entries for the asset', async () => {
    const logRow = {
      id: 'log-1', table_name: 'assets', record_id: 'asset-1',
      action: 'UPDATE', performed_by_id: 'u1', performed_by_name: 'Admin',
      performed_at: new Date(), old_values: null, new_values: null,
    }
    mockExecute.mockResolvedValueOnce([[logRow]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.history).toHaveLength(1)
    expect(body.history[0].id).toBe('log-1')
  })

  it('returns empty history array when no entries', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.history).toHaveLength(0)
  })

  it('maps audit log fields correctly', async () => {
    const performedAt = new Date('2024-01-15T10:30:00Z')
    const logRow = {
      id: 'log-2', table_name: 'assets', record_id: 'asset-1',
      action: 'CREATE', performed_by_id: 'u2', performed_by_name: 'Bob',
      performed_at: performedAt,
      old_values: null,
      new_values: JSON.stringify({ name: 'MyApp', type: 'SaaS' }),
    }
    mockExecute.mockResolvedValueOnce([[logRow]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    const body = await res.json()
    const entry = body.history[0]
    expect(entry.tableName).toBe('assets')
    expect(entry.recordId).toBe('asset-1')
    expect(entry.action).toBe('CREATE')
    expect(entry.performedById).toBe('u2')
    expect(entry.performedByName).toBe('Bob')
    expect(entry.performedAt).toBe(performedAt.toISOString())
    expect(entry.oldValues).toBeNull()
    expect(entry.newValues).toEqual({ name: 'MyApp', type: 'SaaS' })
  })

  it('handles JSON old_values/new_values as objects (already parsed)', async () => {
    const logRow = {
      id: 'log-3', table_name: 'assets', record_id: 'asset-1',
      action: 'UPDATE', performed_by_id: 'u1', performed_by_name: 'Admin',
      performed_at: new Date(),
      old_values: { name: 'OldName' },
      new_values: { name: 'NewName' },
    }
    mockExecute.mockResolvedValueOnce([[logRow]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    const body = await res.json()
    expect(body.history[0].oldValues).toEqual({ name: 'OldName' })
    expect(body.history[0].newValues).toEqual({ name: 'NewName' })
  })

  it('returns multiple entries in order', async () => {
    const rows = [
      { id: 'log-3', table_name: 'assets', record_id: 'asset-1', action: 'DELETE',
        performed_by_id: 'u1', performed_by_name: 'Admin', performed_at: new Date(),
        old_values: null, new_values: null },
      { id: 'log-1', table_name: 'assets', record_id: 'asset-1', action: 'CREATE',
        performed_by_id: 'u1', performed_by_name: 'Admin', performed_at: new Date(),
        old_values: null, new_values: null },
    ]
    mockExecute.mockResolvedValueOnce([rows])
    const res = await GET(new NextRequest('http://localhost/'), params)
    const body = await res.json()
    expect(body.history).toHaveLength(2)
    expect(body.history[0].id).toBe('log-3')
    expect(body.history[1].id).toBe('log-1')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'))
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(500)
  })
})
