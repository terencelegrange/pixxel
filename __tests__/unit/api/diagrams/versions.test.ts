import { NextRequest, NextResponse } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb, getDbDialect } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, POST } from '@/app/api/diagrams/[id]/versions/route'

const params = { params: Promise.resolve({ id: 'diagram-1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(getDbDialect as jest.Mock).mockReturnValue('mysql')
})

const dbVersionRow = {
  id: 'v1', diagram_id: 'diagram-1', version_number: 1,
  created_by_id: 'u1', created_by_name: 'Admin', created_at: new Date(),
}

describe('GET /api/diagrams/[id]/versions', () => {
  it('returns mapped version list', async () => {
    mockExecute.mockResolvedValueOnce([[dbVersionRow]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.versions).toHaveLength(1)
    expect(body.versions[0].id).toBe('v1')
    expect(body.versions[0].versionNumber).toBe(1)
  })

  it('returns empty list when no versions', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.versions).toHaveLength(0)
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/diagrams/[id]/versions', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const valid = { content: '{"nodes":[]}', assetIds: ['a1'] }

  it('returns 400 when content is missing', async () => {
    const res = await POST(makeReq({ content: '' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await POST(makeReq(valid), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when diagram not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await POST(makeReq(valid), params)
    expect(res.status).toBe(404)
  })

  it('returns 201 with versionId on success', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'diagram-1' }]]) // diagram exists check
    mockExecute.mockResolvedValueOnce([[{ max_ver: 0 }]])       // next version
    mockExecute.mockResolvedValue([{}])                          // remaining writes
    const res = await POST(makeReq(valid), params)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.versionId).toBeDefined()
    expect(body.versionNumber).toBe(1)
  })

  it('uses NOW() and INSERT IGNORE for mysql dialect', async () => {
    ;(getDbDialect as jest.Mock).mockReturnValue('mysql')
    mockExecute.mockResolvedValueOnce([[{ id: 'diagram-1' }]])
    mockExecute.mockResolvedValueOnce([[{ max_ver: 0 }]])
    mockExecute.mockResolvedValue([{}])
    const res = await POST(makeReq(valid), params)
    expect(res.status).toBe(201)
    const updateCall = mockExecute.mock.calls.find(([sql]) => sql.includes('UPDATE diagrams'))
    expect(updateCall?.[0]).toBe('UPDATE diagrams SET updated_at = NOW() WHERE id = ?')
    const junctionCall = mockExecute.mock.calls.find(([sql]) => sql.includes('diagram_assets') && sql.startsWith('INSERT'))
    expect(junctionCall?.[0]).toBe('INSERT IGNORE INTO diagram_assets (diagram_id, asset_id) VALUES (?, ?)')
  })

  it('uses CURRENT_TIMESTAMP and INSERT OR IGNORE for sqlite dialect', async () => {
    ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
    mockExecute.mockResolvedValueOnce([[{ id: 'diagram-1' }]])
    mockExecute.mockResolvedValueOnce([[{ max_ver: 0 }]])
    mockExecute.mockResolvedValue([{}])
    const res = await POST(makeReq(valid), params)
    expect(res.status).toBe(201)
    const updateCall = mockExecute.mock.calls.find(([sql]) => sql.includes('UPDATE diagrams'))
    expect(updateCall?.[0]).toBe('UPDATE diagrams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const junctionCall = mockExecute.mock.calls.find(([sql]) => sql.includes('diagram_assets') && sql.startsWith('INSERT'))
    expect(junctionCall?.[0]).toBe('INSERT OR IGNORE INTO diagram_assets (diagram_id, asset_id) VALUES (?, ?)')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await POST(makeReq(valid), params)
    expect(res.status).toBe(500)
  })
})
