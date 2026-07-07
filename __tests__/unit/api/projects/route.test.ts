import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb, getDbDialect } from '@/lib/db'
import { GET, POST } from '@/app/api/projects/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/projects', () => {
  it('returns projects list with asset count', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'p1', name: 'Migration', description: null, status: 'Active', start_date: null, end_date: null, asset_count: 2, created_by_id: 'u1', created_by_name: 'Admin', created_at: new Date(), updated_at: new Date() }]])
    const res = await GET(new NextRequest('http://localhost/'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.projects[0].id).toBe('p1')
    expect(body.projects[0].assetCount).toBe(2)
  })
})

describe('POST /api/projects', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status', async () => {
    const res = await POST(makeReq({ name: 'Project X', status: 'Unknown', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Migration Project', status: 'Active', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })

  it('uses CURRENT_TIMESTAMP instead of NOW() for sqlite dialect', async () => {
    ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Test Project', status: 'Active' }))
    expect(res.status).toBe(201)
    const insertCall = mockExecute.mock.calls.find(([sql]) => sql.includes('INSERT INTO projects'))
    expect(insertCall[0]).toContain('CURRENT_TIMESTAMP, CURRENT_TIMESTAMP')
    expect(insertCall[0]).not.toContain('NOW()')
  })
})
