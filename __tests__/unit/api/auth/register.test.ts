import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'),
}))
jest.mock('@/lib/jwt', () => ({
  signJwt: jest.fn().mockReturnValue('mock-token'),
  verifyJwt: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { POST } from '@/app/api/auth/register/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const valid = { name: 'Jane Smith', email: 'jane@example.com', password: 'password123' }

describe('POST /api/auth/register', () => {
  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ email: valid.email, password: valid.password }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.any(String) })
  })

  it('returns 400 when name is only whitespace', async () => {
    const res = await POST(makeReq({ name: '   ', email: valid.email, password: valid.password }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeReq({ name: valid.name, email: valid.email }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is shorter than 8 characters', async () => {
    const res = await POST(makeReq({ ...valid, password: 'short' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('8 characters') })
  })

  it('returns 409 when email already exists', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'existing' }]])
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('already exists') })
  })

  it('returns 201 with User object on success', async () => {
    mockExecute.mockResolvedValueOnce([[]])   // no existing user
    mockExecute.mockResolvedValueOnce([{}])   // INSERT
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user).toMatchObject({
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'Member',
      avatarInitials: 'JS',
    })
    expect(body.user.password).toBeUndefined()
  })

  it('normalises email to lowercase', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await POST(makeReq({ ...valid, email: 'JANE@EXAMPLE.COM' }))
    const body = await res.json()
    expect(body.user.email).toBe('jane@example.com')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB down'))
    const res = await POST(makeReq(valid))
    expect(res.status).toBe(500)
  })
})
