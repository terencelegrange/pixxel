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
import { PATCH } from '@/app/api/support/[id]/route'

const mockExecute = jest.fn()
const params = { params: Promise.resolve({ id: 'sub-1' }) }
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (body: object) => new NextRequest('http://localhost/', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PATCH /api/support/[id]', () => {
  it('returns 400 for invalid status', async () => {
    const res = await PATCH(makeReq({ status: 'Deleted', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PATCH(makeReq({ status: 'Acknowledged', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'sub-1', status: 'New' }]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await PATCH(makeReq({ status: 'Acknowledged', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })

  it('accepts all valid statuses', async () => {
    const validStatuses = ['New', 'Acknowledged', 'Under Review', 'Will Fix', 'Will Not Implement', 'Completed']
    for (const status of validStatuses) {
      mockExecute.mockResolvedValueOnce([[{ id: 'sub-1' }]])
      mockExecute.mockResolvedValueOnce([{}])
      const res = await PATCH(makeReq({ status }), params)
      expect(res.status).toBe(200)
    }
  })
})
