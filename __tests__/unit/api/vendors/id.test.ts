import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { DELETE } from '@/app/api/vendors/[id]/route'

const mockExecute = jest.fn()
const params = { params: { id: 'vendor-1' } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const dbVendor = { id: 'vendor-1', name: 'Acme', email: null, country: null }

describe('DELETE /api/vendors/[id]', () => {
  const makeReq = () => new NextRequest('http://localhost/', {
    method: 'DELETE', body: JSON.stringify({ userId: 'u1', userName: 'Admin' }),
  })

  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq(), params)
    expect(res.status).toBe(404)
  })

  it('nulls vendor_id on assets before deleting the vendor', async () => {
    mockExecute.mockResolvedValueOnce([[dbVendor]])
    mockExecute.mockResolvedValueOnce([{}])  // UPDATE assets SET vendor_id = NULL
    mockExecute.mockResolvedValueOnce([{}])  // DELETE vendor
    await DELETE(makeReq(), params)
    const calls = mockExecute.mock.calls
    expect(calls[1][0]).toMatch(/UPDATE assets SET vendor_id = NULL/)
    expect(calls[2][0]).toMatch(/DELETE FROM vendors/)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbVendor]])
    mockExecute.mockResolvedValue([{}])
    const res = await DELETE(makeReq(), params)
    expect(res.status).toBe(200)
  })
})
