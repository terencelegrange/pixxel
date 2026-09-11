import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/projects/[id]/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'proj-1' }) }
const dbProject = { id: 'proj-1', name: 'Migration', status: 'Active', description: null }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PUT /api/projects/[id]', () => {
  it('returns 404 when project not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'Updated', status: 'Active', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbProject]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PUT(makeReq('PUT', { name: 'Updated', status: 'On Hold', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('returns 404 when project not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success (cascades project_assets first)', async () => {
    mockExecute.mockResolvedValueOnce([[dbProject]])
    mockExecute.mockResolvedValueOnce([{}])  // DELETE FROM project_assets
    mockExecute.mockResolvedValueOnce([{}])  // DELETE FROM projects
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    const calls = mockExecute.mock.calls
    expect(calls[1][0]).toMatch(/DELETE FROM project_assets/)
    expect(calls[2][0]).toMatch(/DELETE FROM projects/)
  })
})
