import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/vendors/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/vendors', () => {
  it('returns vendor list', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'v1', name: 'Acme' }]])
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).vendors).toHaveLength(1)
  })
})

describe('POST /api/vendors', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/vendors', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ name: 'Acme Corp', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })
})
