import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { GET } from '@/app/api/contracts/expiring-count/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function row(id: string, endDateOffset: number, status = 'Active') {
  return {
    id, status, end_date: daysFromNow(endDateOffset),
    notice_period_days: null, auto_renews: 0,
  };
}

describe('GET /api/contracts/expiring-count', () => {
  it('defaults to a 90-day window', async () => {
    mockExecute.mockResolvedValueOnce([[row('c1', 10), row('c2', 200)]])
    const res = await GET(new NextRequest('http://localhost/api/contracts/expiring-count'))
    const body = await res.json()
    expect(body.count).toBe(1)
  })

  it('respects an explicit ?days= param', async () => {
    mockExecute.mockResolvedValueOnce([[row('c1', 10), row('c2', 60)]])
    const res = await GET(new NextRequest('http://localhost/api/contracts/expiring-count?days=30'))
    const body = await res.json()
    expect(body.count).toBe(1)
  })

  it('excludes Terminated contracts', async () => {
    mockExecute.mockResolvedValueOnce([[row('c1', 10, 'Terminated')]])
    const res = await GET(new NextRequest('http://localhost/api/contracts/expiring-count'))
    const body = await res.json()
    expect(body.count).toBe(0)
  })
})
