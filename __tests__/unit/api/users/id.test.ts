import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import { requireUser } from '@/lib/require-user'
import { PUT, DELETE } from '@/app/api/users/[id]/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const params = { params: Promise.resolve({ id: 'target-user' }) }
const dbUser = { id: 'target-user', name: 'Old Name', email: 'old@b.com', role: 'Member' }

function makePutReq(body: object) {
  return new NextRequest('http://localhost/api/users/target-user', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function makeDeleteReq(body: object) {
  return new NextRequest('http://localhost/api/users/target-user', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/users/[id]', () => {
  it('returns 400 when name is missing', async () => {
    const res = await PUT(makePutReq({ role: 'Member', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 400 when role is invalid', async () => {
    const res = await PUT(makePutReq({ name: 'Jane', role: 'SuperAdmin', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 401 }) })
    const res = await PUT(makePutReq({ name: 'Jane', role: 'Member' }), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when user not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await PUT(makePutReq({ name: 'Jane', role: 'Member', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 and calls writeAudit on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])  // SELECT current
    mockExecute.mockResolvedValueOnce([{}])         // UPDATE
    const res = await PUT(makePutReq({ name: 'New Name', role: 'Admin', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      tableName: 'users',
      action: 'UPDATE',
      oldValues: { name: 'Old Name', role: 'Member' },
      newValues: { name: 'New Name', role: 'Admin' },
    }))
  })

  it('bumps token_version when the role changes, invalidating existing sessions', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])  // SELECT current (role: Member)
    mockExecute.mockResolvedValueOnce([{}])         // UPDATE
    await PUT(makePutReq({ name: 'New Name', role: 'Admin', userId: 'u1', userName: 'Admin' }), params)
    const updateCall = mockExecute.mock.calls[1]
    expect(updateCall[0]).toContain('token_version = token_version + 1')
  })

  it('does not bump token_version when the role is unchanged', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])  // SELECT current (role: Member)
    mockExecute.mockResolvedValueOnce([{}])         // UPDATE
    await PUT(makePutReq({ name: 'New Name', role: 'Member', userId: 'u1', userName: 'Admin' }), params)
    const updateCall = mockExecute.mock.calls[1]
    expect(updateCall[0]).not.toContain('token_version')
  })
})

describe('DELETE /api/users/[id]', () => {
  it('returns 400 when deleting own account', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: true, user: { id: 'target-user', name: 'Self', email: 'self@b.com', role: 'Admin' } })
    const res = await DELETE(makeDeleteReq({ userId: 'target-user', userName: 'Self' }), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('cannot delete') })
  })

  it('returns 404 when user not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeDeleteReq({ userId: 'other-user', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 and calls writeAudit with DELETE action', async () => {
    mockExecute.mockResolvedValueOnce([[dbUser]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await DELETE(makeDeleteReq({ userId: 'other-user', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'DELETE',
      newValues: null,
    }))
  })
})
