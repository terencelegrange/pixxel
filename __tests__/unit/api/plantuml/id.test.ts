import { NextRequest } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  withTransaction: jest.fn((cb: (tx: { execute: jest.Mock }) => unknown) => cb({ execute: mockExecute })),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, PUT, DELETE } from '@/app/api/plantuml/[id]/route'

const params = { params: Promise.resolve({ id: 'diagram-1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } })
})

describe('GET /api/plantuml/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/plantuml/diagram-1'), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when the diagram does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/api/plantuml/diagram-1'), params)
    expect(res.status).toBe(404)
  })

  it('returns the diagram with its latest version', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'diagram-1', name: 'My Diagram' }]])
      .mockResolvedValueOnce([[{ id: 'v1', version_number: 2 }]])
    const res = await GET(new NextRequest('http://localhost/api/plantuml/diagram-1'), params)
    expect(await res.json()).toEqual({ diagram: { id: 'diagram-1', name: 'My Diagram' }, latestVersion: { id: 'v1', version_number: 2 } })
  })
})

describe('PUT /api/plantuml/[id]', () => {
  it('returns 403 for a Viewer', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'You do not have permission to perform this action.' }), { status: 403 }) })
    const req = new NextRequest('http://localhost/api/plantuml/diagram-1', { method: 'PUT', body: JSON.stringify({ name: 'x' }) })
    const res = await PUT(req, params)
    expect(res.status).toBe(403)
  })

  it('updates the diagram name and description', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const req = new NextRequest('http://localhost/api/plantuml/diagram-1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Renamed', description: 'new desc' }),
    })
    const res = await PUT(req, params)
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'UPDATE plantuml_diagrams SET name = ?, description = ? WHERE id = ?',
      ['Renamed', 'new desc', 'diagram-1']
    )
  })
})

describe('DELETE /api/plantuml/[id]', () => {
  it('returns 403 for a Viewer', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'You do not have permission to perform this action.' }), { status: 403 }) })
    const res = await DELETE(new NextRequest('http://localhost/api/plantuml/diagram-1', { method: 'DELETE' }), params)
    expect(res.status).toBe(403)
  })

  it('deletes plantuml_diagram_assets, plantuml_versions, and plantuml_diagrams inside one transaction, in that order', async () => {
    mockExecute.mockResolvedValue([{}])
    const res = await DELETE(new NextRequest('http://localhost/api/plantuml/diagram-1', { method: 'DELETE' }), params)
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenNthCalledWith(1, 'DELETE FROM plantuml_diagram_assets WHERE diagram_id = ?', ['diagram-1'])
    expect(mockExecute).toHaveBeenNthCalledWith(2, 'DELETE FROM plantuml_versions WHERE diagram_id = ?', ['diagram-1'])
    expect(mockExecute).toHaveBeenNthCalledWith(3, 'DELETE FROM plantuml_diagrams WHERE id = ?', ['diagram-1'])
  })
})
