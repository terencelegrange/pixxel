import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('$hashed') }))

import { getDb } from '@/lib/db'
import { GET, POST } from '@/app/api/users/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const dbUsers = [{ id: 'u1', name: 'Jane', email: 'jane@example.com', role: 'Admin', created_at: new Date() }]

describe('GET /api/users', () => {
  it('returns users list', async () => {
    mockExecute.mockResolvedValueOnce([dbUsers])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toHaveLength(1)
    expect(body.users[0].id).toBe('u1')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/users', () => {
  const makeReq = (body: object) => new NextRequest('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ email: 'a@b.com', password: 'password1', role: 'Member', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when role is invalid', async () => {
    const res = await POST(makeReq({ name: 'New', email: 'a@b.com', password: 'password1', role: 'SuperAdmin', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when email already exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'existing' }]])
    const res = await POST(makeReq({ name: 'New', email: 'a@b.com', password: 'password1', role: 'Member', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(409)
  })

  it('returns 201 on success', async () => {
    mockExecute.mockResolvedValueOnce([[]])   // no existing
    mockExecute.mockResolvedValueOnce([{}])   // INSERT
    const res = await POST(makeReq({ name: 'New User', email: 'new@b.com', password: 'password1', role: 'Member', userId: 'u1', userName: 'Admin' }))
    expect(res.status).toBe(201)
  })
})
