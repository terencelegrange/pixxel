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
import { PATCH, DELETE } from '@/app/api/projects/[id]/assets/[assetId]/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'proj-1', assetId: 'asset-1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PATCH /api/projects/[id]/assets/[assetId]', () => {
  it('returns 400 when dependencyType is invalid', async () => {
    const res = await PATCH(makeReq('PATCH', { dependencyType: 'sideways', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PATCH(makeReq('PATCH', { dependencyType: 'downstream', notes: 'Added note', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/projects/[id]/assets/[assetId]', () => {
  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
