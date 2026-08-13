import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { PUT, DELETE } from '@/app/api/asset-risks/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } })
})

const params = Promise.resolve({ id: 'r1' })

const ROW = {
  id: 'r1', asset_id: 'a1', title: 'Single vendor dependency', description: null,
  category: 'Operational', likelihood: 'High', impact: 'High', status: 'Open',
  owner: 'Jane', created_by_id: 'u1', created_by_name: 'Test User',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
}

describe('PUT /api/asset-risks/[id]', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/asset-risks/r1', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns 400 when assetId is missing', async () => {
    const res = await PUT(makeReq({ title: 'X' }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 when title is missing', async () => {
    const res = await PUT(makeReq({ assetId: 'a1' }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the risk does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq({ assetId: 'a1', title: 'Updated' }), { params })
    expect(res.status).toBe(404)
  })

  it('returns success and writes an audit entry on update', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]]).mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ assetId: 'a1', title: 'Updated title', likelihood: 'Critical', impact: 'High', status: 'Mitigating' }), { params })
    expect(res.status).toBe(200)
    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit.mock.calls[0][0]).toMatchObject({ tableName: 'asset_risks', action: 'UPDATE' })
  })
})

describe('DELETE /api/asset-risks/[id]', () => {
  it('returns 403 when caller lacks a permitted role', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    })
    const res = await DELETE(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 when the risk does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(404)
  })

  it('returns success and writes an audit entry on delete', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]]).mockResolvedValueOnce([{}])
    const res = await DELETE(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(200)
    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit.mock.calls[0][0]).toMatchObject({ tableName: 'asset_risks', action: 'DELETE', newValues: null })
  })
})
