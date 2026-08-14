import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } }),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET } from '@/app/api/branding/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
  ;(requireUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member' } })
})

describe('GET /api/branding', () => {
  it('returns 401 when not authenticated', async () => {
    ;(requireUser as jest.Mock).mockResolvedValueOnce({ ok: false, response: new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }) })
    const res = await GET(new NextRequest('http://localhost/api/branding'))
    expect(res.status).toBe(401)
  })

  it('returns null fields when branding is unset', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await GET(new NextRequest('http://localhost/api/branding'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ companyName: null, logoDataUrl: null })
  })

  it('returns configured branding values, accessible to a non-admin user', async () => {
    mockExecute.mockResolvedValueOnce([[
      { key: 'branding.company_name', value: 'Acme Co' },
      { key: 'branding.logo_data_url', value: 'data:image/png;base64,abc' },
    ]])
    const res = await GET(new NextRequest('http://localhost/api/branding'))
    expect(await res.json()).toEqual({ companyName: 'Acme Co', logoDataUrl: 'data:image/png;base64,abc' })
  })
})
