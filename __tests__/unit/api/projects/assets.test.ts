import { NextRequest } from 'next/server'

jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))


jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/projects/[id]/assets/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'proj-1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (body: object) => new NextRequest('http://localhost/', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('GET /api/projects/[id]/assets', () => {
  it('returns 404 when project not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(404)
  })

  it('returns linked assets', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'proj-1' }]])  // project check
    mockExecute.mockResolvedValueOnce([[{ asset_id: 'a1', asset_name: 'MyApp', asset_type: 'SaaS', asset_icon: 'Server', lifecycle_status: 'Production', tier_name: 'Tier 1', dependency_type: 'upstream', notes: null }]])
    const res = await GET(new NextRequest('http://localhost/'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.assets)).toBe(true)
    expect(body.assets[0].assetId).toBe('a1')
  })
})

describe('POST /api/projects/[id]/assets', () => {
  it('returns 400 when assetId is missing', async () => {
    const res = await POST(makeReq({ dependencyType: 'upstream', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 400 when dependencyType is invalid', async () => {
    const res = await POST(makeReq({ assetId: 'a1', dependencyType: 'sideways', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'proj-1' }]])  // project check
    mockExecute.mockResolvedValueOnce([[{ id: 'a1' }]])      // asset check
    mockExecute.mockResolvedValueOnce([[]])                  // existing link check - none
    mockExecute.mockResolvedValueOnce([{}])                  // INSERT
    const res = await POST(makeReq({ assetId: 'a1', dependencyType: 'upstream', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(201)
  })

  it('returns 409 when asset already linked', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'proj-1' }]])           // project check
    mockExecute.mockResolvedValueOnce([[{ id: 'a1' }]])               // asset check
    mockExecute.mockResolvedValueOnce([[{ asset_id: 'a1' }]])         // existing link - found
    const res = await POST(makeReq({ assetId: 'a1', dependencyType: 'downstream', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(409)
  })
})
