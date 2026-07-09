import { NextRequest } from 'next/server'

jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
  resetPool: jest.fn(),
}))

jest.mock('@/lib/services', () => ({ getComposedService: jest.fn() }))

import { getDb } from '@/lib/db'
import { getComposedService } from '@/lib/services'
import { GET, POST } from '@/app/api/services/[id]/assets/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'svc-1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (body: object) => new NextRequest('http://localhost/', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('GET /api/services/[id]/assets', () => {
  it('returns 404 when service not found', async () => {
    ;(getComposedService as jest.Mock).mockResolvedValueOnce(null)
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(404)
  })

  it('returns linked assets', async () => {
    ;(getComposedService as jest.Mock).mockResolvedValueOnce({
      id: 'svc-1',
      members: [{ assetId: 'a1', assetName: 'MyApp', assetType: 'SaaS', assetIcon: 'Server', lifecycleStatus: 'Production', tierName: 'Tier 1', role: 'Core', notes: null }],
    })
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.assets)).toBe(true)
    expect(body.assets[0].assetId).toBe('a1')
  })
})

describe('POST /api/services/[id]/assets', () => {
  it('returns 400 when assetId is missing', async () => {
    const res = await POST(makeReq({ role: 'Core' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 400 when role is invalid', async () => {
    const res = await POST(makeReq({ assetId: 'a1', role: 'Sideways' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 404 when service not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])  // service check
    const res = await POST(makeReq({ assetId: 'a1', role: 'Core' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 404 when asset not found', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'svc-1' }]])  // service check
    mockExecute.mockResolvedValueOnce([[]])                 // asset check
    const res = await POST(makeReq({ assetId: 'a1', role: 'Core' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 201 on success, defaulting role to Supporting', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'svc-1' }]])  // service check
    mockExecute.mockResolvedValueOnce([[{ id: 'a1' }]])     // asset check
    mockExecute.mockResolvedValueOnce([[]])                 // existing link check - none
    mockExecute.mockResolvedValueOnce([{}])                 // INSERT
    const res = await POST(makeReq({ assetId: 'a1' }), params)
    expect(res.status).toBe(201)
    const insertCall = mockExecute.mock.calls[3]
    expect(insertCall[1]).toContain('Supporting')
  })

  it('returns 409 when asset already linked', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'svc-1' }]])         // service check
    mockExecute.mockResolvedValueOnce([[{ id: 'a1' }]])            // asset check
    mockExecute.mockResolvedValueOnce([[{ asset_id: 'a1' }]])      // existing link - found
    const res = await POST(makeReq({ assetId: 'a1', role: 'Core' }), params)
    expect(res.status).toBe(409)
  })
})
