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
jest.mock('@/lib/services', () => ({ getComposedService: jest.fn() }))

import { getDb } from '@/lib/db'
import { getComposedService } from '@/lib/services'
import { GET, PUT, DELETE } from '@/app/api/services/[id]/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'svc-1' }) }
const dbService = { id: 'svc-1', name: 'Billing', slug: 'billing', status: 'Active', description: null }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('GET /api/services/[id]', () => {
  it('returns 404 when service not found', async () => {
    ;(getComposedService as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 with composed service', async () => {
    ;(getComposedService as jest.Mock).mockResolvedValueOnce({ id: 'svc-1', name: 'Billing', slug: 'billing', members: [] })
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('svc-1')
  })
})

describe('PUT /api/services/[id]', () => {
  it('returns 404 when service not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makeReq('PUT', { name: 'Updated', status: 'Active' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid status', async () => {
    const res = await PUT(makeReq('PUT', { name: 'Updated', status: 'Bogus' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 200 on success without changing slug when slug not supplied', async () => {
    mockExecute.mockResolvedValueOnce([[dbService]])  // current lookup
    mockExecute.mockResolvedValueOnce([{}])           // UPDATE
    const res = await PUT(makeReq('PUT', { name: 'Renamed Billing', status: 'Active' }), params)
    expect(res.status).toBe(200)
    const updateCall = mockExecute.mock.calls[1]
    expect(updateCall[0]).toMatch(/UPDATE services/)
    // slug should remain the current one
    expect(updateCall[1]).toContain('billing')
    expect(updateCall[1]).not.toContain('renamed-billing')
  })

  it('changes slug when an explicit new slug is supplied', async () => {
    mockExecute.mockResolvedValueOnce([[dbService]])  // current lookup
    mockExecute.mockResolvedValueOnce([[]])           // slug collision check - free
    mockExecute.mockResolvedValueOnce([{}])           // UPDATE
    const res = await PUT(makeReq('PUT', { name: 'Billing', status: 'Active', slug: 'new-billing-slug' }), params)
    expect(res.status).toBe(200)
    const updateCall = mockExecute.mock.calls[2]
    expect(updateCall[1]).toContain('new-billing-slug')
  })

  it('applies -2 suffix on explicit slug collision', async () => {
    mockExecute.mockResolvedValueOnce([[dbService]])           // current lookup
    mockExecute.mockResolvedValueOnce([[{ 1: 1 }]])            // slug collision - taken
    mockExecute.mockResolvedValueOnce([[]])                    // second check - free
    mockExecute.mockResolvedValueOnce([{}])                    // UPDATE
    const res = await PUT(makeReq('PUT', { name: 'Billing', status: 'Active', slug: 'taken-slug' }), params)
    expect(res.status).toBe(200)
    const updateCall = mockExecute.mock.calls[3]
    expect(updateCall[1]).toContain('taken-slug-2')
  })
})

describe('DELETE /api/services/[id]', () => {
  it('returns 404 when service not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success (cascades service_assets first)', async () => {
    mockExecute.mockResolvedValueOnce([[dbService]])
    mockExecute.mockResolvedValueOnce([{}])  // DELETE FROM service_assets
    mockExecute.mockResolvedValueOnce([{}])  // DELETE FROM services
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(200)
    const calls = mockExecute.mock.calls
    expect(calls[1][0]).toMatch(/DELETE FROM service_assets/)
    expect(calls[2][0]).toMatch(/DELETE FROM services/)
  })
})
