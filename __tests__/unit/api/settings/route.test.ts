import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Admin User', email: 'admin@example.com', role: 'Admin' } }),
}))
jest.mock('@/lib/observability/config', () => ({
  refreshObservabilityConfig: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/require-user'
import { GET, PUT } from '@/app/api/settings/route'
import { MASKED_VALUE } from '@/lib/secretSettings'

const mockExecute = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/settings', () => {
  it('returns 401/403 when not Admin', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 403 }) })
    const res = await GET(new NextRequest('http://localhost/api/settings'))
    expect(res.status).toBe(403)
  })

  it('masks secret settings values in the response', async () => {
    mockExecute.mockResolvedValueOnce([[
      { key: 'confluence.api_token', value: 'real-secret' },
      { key: 'confluence.base_url', value: 'https://example.atlassian.net' },
      { key: 'observability.api_key', value: 'another-secret' },
    ]])
    const res = await GET(new NextRequest('http://localhost/api/settings'))
    const body = await res.json()
    expect(body.settings['confluence.api_token']).toBe(MASKED_VALUE)
    expect(body.settings['observability.api_key']).toBe(MASKED_VALUE)
    expect(body.settings['confluence.base_url']).toBe('https://example.atlassian.net')
  })
})

describe('PUT /api/settings', () => {
  function makeReq(settings: Record<string, string>) {
    return new NextRequest('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
  }

  it('returns 401/403 when not Admin', async () => {
    ;(requireUser as jest.Mock).mockReturnValueOnce({ ok: false, response: new NextResponse(null, { status: 403 }) })
    const res = await PUT(makeReq({ 'confluence.base_url': 'x' }))
    expect(res.status).toBe(403)
  })

  it('does not overwrite a secret when the client echoes the masked sentinel back', async () => {
    const res = await PUT(makeReq({ 'confluence.api_token': MASKED_VALUE, 'confluence.base_url': 'https://new.atlassian.net' }))
    expect(res.status).toBe(200)
    // Only the non-secret key should have triggered a write.
    expect(mockExecute).toHaveBeenCalledTimes(1)
    expect(mockExecute).toHaveBeenCalledWith(expect.any(String), ['confluence.base_url', 'https://new.atlassian.net'])
  })

  it('saves a real new secret value when provided', async () => {
    const res = await PUT(makeReq({ 'observability.api_key': 'brand-new-token' }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(expect.any(String), ['observability.api_key', 'brand-new-token'])
  })
})
