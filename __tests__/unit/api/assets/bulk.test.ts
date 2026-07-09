import { NextRequest, NextResponse } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
  withTransaction: jest.fn((cb: (tx: { execute: jest.Mock }) => unknown) => cb({ execute: mockExecute })),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({
    ok: true,
    user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' },
  }),
}))

import { getDb, getDbDialect } from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import { requireUser } from '@/lib/require-user'
import { POST } from '@/app/api/assets/bulk/route'

const DEPARTMENTS = [{ id: 'd1', name: 'IT' }]
const TIERS = [{ id: 't1', name: 'Gold' }]
const EMPTY: unknown[] = []

function setupExecuteDefaults() {
  mockExecute.mockImplementation((sql: string) => {
    if (/SELECT.*FROM departments/is.test(sql)) return Promise.resolve([DEPARTMENTS])
    if (/SELECT.*FROM domains/is.test(sql)) return Promise.resolve([EMPTY])
    if (/SELECT.*FROM vendors/is.test(sql)) return Promise.resolve([EMPTY])
    if (/SELECT.*FROM tiers/is.test(sql)) return Promise.resolve([TIERS])
    if (/SELECT.*FROM asset_strategies/is.test(sql)) return Promise.resolve([EMPTY])
    if (/SELECT.*FROM asset_complexities/is.test(sql)) return Promise.resolve([EMPTY])
    if (/SELECT.*FROM diagrams/is.test(sql)) return Promise.resolve([EMPTY])
    if (/SELECT.*FROM users/is.test(sql)) return Promise.resolve([EMPTY])
    if (/SELECT.*FROM business_capabilities/is.test(sql)) return Promise.resolve([EMPTY])
    // INSERT statements (departments, assets, junctions)
    return Promise.resolve([{}])
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(getDbDialect as jest.Mock).mockReturnValue('mysql')
  setupExecuteDefaults()
})

const makeReq = (rows: Record<string, string>[]) => new NextRequest('http://localhost/api/assets/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rows }),
})

describe('POST /api/assets/bulk', () => {
  it('creates all rows in an all-valid 2-row CSV', async () => {
    const res = await POST(makeReq([
      { name: 'App One', department: 'IT' },
      { name: 'App Two', department: 'IT' },
    ]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.total).toBe(2)
    expect(body.summary.created).toBe(2)
    expect(body.summary.failed).toBe(0)
    expect(writeAudit).toHaveBeenCalledTimes(2)
  })

  it('fails a row missing name but still creates the others', async () => {
    const res = await POST(makeReq([
      { name: '', department: 'IT' },
      { name: 'App Two', department: 'IT' },
    ]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.created).toBe(1)
    expect(body.summary.failed).toBe(1)
    expect(body.results[0].status).toBe('failed')
    expect(body.results[0].error).toMatch(/name/i)
    expect(body.results[1].status).toBe('created')
  })

  it('isolates a per-row DB transaction failure without rolling back the other rows', async () => {
    mockExecute.mockImplementation((sql: string, params?: unknown[]) => {
      if (/SELECT.*FROM departments/is.test(sql)) return Promise.resolve([DEPARTMENTS])
      if (/SELECT.*FROM domains/is.test(sql)) return Promise.resolve([EMPTY])
      if (/SELECT.*FROM vendors/is.test(sql)) return Promise.resolve([EMPTY])
      if (/SELECT.*FROM tiers/is.test(sql)) return Promise.resolve([TIERS])
      if (/SELECT.*FROM asset_strategies/is.test(sql)) return Promise.resolve([EMPTY])
      if (/SELECT.*FROM asset_complexities/is.test(sql)) return Promise.resolve([EMPTY])
      if (/SELECT.*FROM diagrams/is.test(sql)) return Promise.resolve([EMPTY])
      if (/SELECT.*FROM users/is.test(sql)) return Promise.resolve([EMPTY])
      if (/SELECT.*FROM business_capabilities/is.test(sql)) return Promise.resolve([EMPTY])
      // Simulate a genuine DB failure (e.g. connection lost) for the second row's insert only.
      if (/INSERT INTO assets/i.test(sql) && params?.[1] === 'App Two') {
        return Promise.reject(new Error('DB connection lost'))
      }
      return Promise.resolve([{}])
    })

    const res = await POST(makeReq([
      { name: 'App One', department: 'IT' },
      { name: 'App Two', department: 'IT' },
      { name: 'App Three', department: 'IT' },
    ]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.total).toBe(3)
    expect(body.summary.created).toBe(2)
    expect(body.summary.failed).toBe(1)
    expect(body.results[0].status).toBe('created')
    expect(body.results[1].status).toBe('failed')
    expect(body.results[1].error).toBe('Failed to create asset.')
    expect(body.results[2].status).toBe('created')

    // The other rows' inserts still fired despite the middle row's transaction throwing.
    const insertAssetCalls = mockExecute.mock.calls.filter(([sql]: [string]) => /INSERT INTO assets/i.test(sql))
    expect(insertAssetCalls).toHaveLength(3)
    expect(writeAudit).toHaveBeenCalledTimes(2)
  })

  it('creates a new department once and dedupes across rows referencing it', async () => {
    const res = await POST(makeReq([
      { name: 'App One', department: 'Finance' },
      { name: 'App Two', department: 'Finance' },
    ]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.departmentsCreated).toEqual(['Finance'])
    const insertDeptCalls = mockExecute.mock.calls.filter(([sql]: [string]) => /INSERT.*INTO departments/is.test(sql))
    expect(insertDeptCalls).toHaveLength(1)
  })

  it('warns on unknown tier but still creates the row with a null tier_id', async () => {
    const res = await POST(makeReq([
      { name: 'App One', department: 'IT', tier: 'Nonexistent' },
    ]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe('created')
    expect(body.results[0].warnings.some((w: string) => /tier/i.test(w))).toBe(true)
    const insertAssetCall = mockExecute.mock.calls.find(([sql]: [string]) => /INSERT INTO assets/i.test(sql))
    expect(insertAssetCall).toBeDefined()
    // Column order: id, name, short_code, description, type, category, icon,
    // hero_diagram_id, tier_id, ... — tier_id is params[8]
    expect(insertAssetCall![1][8]).toBeNull()
  })

  it('returns 400 when the department column is missing from the header entirely', async () => {
    const res = await POST(makeReq([{ name: 'App One' }]))
    expect(res.status).toBe(400)
  })

  it('returns auth.response when not authorized', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await POST(makeReq([{ name: 'App One', department: 'IT' }]))
    expect(res.status).toBe(401)
  })
})
