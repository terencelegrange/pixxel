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
import { GET, PUT, DELETE } from '@/app/api/contracts/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = Promise.resolve({ id: 'c1' })

const ROW = {
  id: 'c1', vendor_id: 'v1', vendor_name: 'Acme', asset_id: null, asset_name: null,
  title: 'Acme SaaS', value: '1000.00', start_date: '2026-01-01', end_date: '2026-12-31',
  notice_period_days: null, auto_renews: 0, owner: 'Jane', status: 'Active',
  doc_url: null, notes: null,
  created_by_id: 'u1', created_by_name: 'Test User',
  created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
}

describe('GET /api/contracts/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(404)
  })

  it('returns the contract when found', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]])
    const res = await GET(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('c1')
  })
})

describe('PUT /api/contracts/[id]', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/contracts/c1', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when title is missing', async () => {
    const res = await PUT(makeReq({}), { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the contract does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq({ title: 'Updated' }), { params })
    expect(res.status).toBe(404)
  })

  it('returns success and writes an audit entry on update', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]]).mockResolvedValueOnce([{}])
    const res = await PUT(makeReq({ title: 'Updated title' }), { params })
    expect(res.status).toBe(200)
    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit.mock.calls[0][0]).toMatchObject({ tableName: 'contracts', action: 'UPDATE' })
  })
})

describe('DELETE /api/contracts/[id]', () => {
  it('returns 404 when the contract does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(404)
  })

  it('returns success and writes an audit entry on delete', async () => {
    mockExecute.mockResolvedValueOnce([[ROW]]).mockResolvedValueOnce([{}])
    const res = await DELETE(new NextRequest('http://localhost/'), { params })
    expect(res.status).toBe(200)
    const { writeAudit } = jest.requireMock('@/lib/audit')
    expect(writeAudit.mock.calls[0][0]).toMatchObject({ tableName: 'contracts', action: 'DELETE', newValues: null })
  })
})
