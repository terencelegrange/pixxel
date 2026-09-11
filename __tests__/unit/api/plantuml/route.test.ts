import { NextRequest } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import { requireUser } from '@/lib/require-user'
import { GET, POST } from '@/app/api/plantuml/route'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } })
})

describe('GET /api/plantuml', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/plantuml'))
    expect(res.status).toBe(401)
  })

  it('returns the list of diagrams', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'd1', name: 'Diagram One' }]])
    const res = await GET(new NextRequest('http://localhost/api/plantuml'))
    expect(await res.json()).toEqual({ diagrams: [{ id: 'd1', name: 'Diagram One' }] })
  })

  it('returns 500 when the DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const res = await GET(new NextRequest('http://localhost/api/plantuml'))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/plantuml', () => {
  it('returns 403 for a Viewer', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'You do not have permission to perform this action.' }), { status: 403 }) })
    const req = new NextRequest('http://localhost/api/plantuml', { method: 'POST', body: JSON.stringify({ name: 'New Diagram' }) })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('creates a diagram + its first version, and writes a CREATE audit entry', async () => {
    mockExecute.mockResolvedValue([{}])
    const req = new NextRequest('http://localhost/api/plantuml', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Diagram', description: 'a desc' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.versionNumber).toBe(1)
    expect(writeAudit).toHaveBeenCalledWith({
      tableName: 'plantuml_diagrams', recordId: body.id, action: 'CREATE',
      performedById: 'u1', performedByName: 'Test User',
      oldValues: null,
      newValues: { name: 'New Diagram', description: 'a desc' },
    })
  })

  it('returns 500 when the DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('db error'))
    const req = new NextRequest('http://localhost/api/plantuml', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Diagram' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
