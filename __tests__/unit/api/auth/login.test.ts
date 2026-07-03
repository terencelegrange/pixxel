import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))
jest.mock('@/lib/jwt', () => ({
  signJwt: jest.fn().mockReturnValue('mock-token'),
  verifyJwt: jest.fn(),
}))

import { getDb } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { POST } from '@/app/api/auth/login/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const dbUser = {
  id: 'user-1',
  name: 'Jane Smith',
  email: 'jane@example.com',
  password: '$2a$12$hashedpassword',
  role: 'Member',
  created_at: new Date('2025-01-01'),
  token_version: 3,
}

describe('POST /api/auth/login', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeReq({ password: 'secret' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.any(String) })
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeReq({ email: 'jane@example.com' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.any(String) })
  })

  it('returns 401 when email not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeReq({ email: 'nobody@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Invalid email or password.' })
  })

  it('runs bcrypt.compare even when user not found (prevents enumeration)', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
    await POST(makeReq({ email: 'nobody@example.com', password: 'x' }))
    expect(bcrypt.compare).toHaveBeenCalledWith('x', '$2a$12$invalidhashforenumerationprevention')
  })

  it('returns 401 when password is wrong', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(false)
    const res = await POST(makeReq({ email: 'jane@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 200 with User object on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
    const res = await POST(makeReq({ email: 'jane@example.com', password: 'correct' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toMatchObject({
      id: 'user-1',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'Member',
      avatarInitials: 'JS',
    })
    expect(body.user.password).toBeUndefined()
  })

  it('embeds the user\'s current token_version in the signed JWT', async () => {
    const { signJwt } = jest.requireMock('@/lib/jwt')
    mockExecute.mockResolvedValueOnce([[dbUser]])
    ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
    await POST(makeReq({ email: 'jane@example.com', password: 'correct' }))
    expect(signJwt).toHaveBeenCalledWith(expect.objectContaining({ tokenVersion: 3 }))
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB down'))
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    const res = await POST(makeReq({ email: 'jane@example.com', password: 'x' }))
    expect(res.status).toBe(500)
  })
})
