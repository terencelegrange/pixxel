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
import { PATCH, DELETE } from '@/app/api/services/[id]/assets/[assetId]/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'svc-1', assetId: 'asset-1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PATCH /api/services/[id]/assets/[assetId]', () => {
  it('returns 400 when role is invalid', async () => {
    const res = await PATCH(makeReq('PATCH', { role: 'Sideways' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 404 when membership does not exist', async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }])
    const res = await PATCH(makeReq('PATCH', { role: 'Core', notes: 'Added note' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }])
    const res = await PATCH(makeReq('PATCH', { role: 'Dependency', notes: 'Added note' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/services/[id]/assets/[assetId]', () => {
  it('returns 404 when membership does not exist', async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }])
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }])
    const res = await DELETE(makeReq('DELETE', {}), params)
    expect(res.status).toBe(200)
  })
})
