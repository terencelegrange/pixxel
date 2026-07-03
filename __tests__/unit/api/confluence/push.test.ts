import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb } from '@/lib/db'
import { POST } from '@/app/api/confluence/push/route'

const mockExecute = jest.fn()
const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

afterAll(() => {
  global.fetch = originalFetch
})

const settingsRows = [
  { key: 'confluence.base_url', value: 'https://example.atlassian.net' },
  { key: 'confluence.api_token', value: 'token' },
  { key: 'confluence.user_email', value: 'user@example.com' },
  { key: 'confluence.space_key', value: 'ARCH' },
]

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/confluence/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/confluence/push', () => {
  it('escapes HTML special characters in asset fields before sending to Confluence', async () => {
    const maliciousAsset = {
      id: 'a1',
      name: '<script>alert(1)</script>',
      short_code: null,
      type: 'SaaS',
      category: 'Application',
      lifecycle_status: 'Production',
      business_owner: null,
      technical_owner: null,
      description: '"><img src=x onerror=alert(1)>',
      notes: "Tom & Jerry's <b>notes</b>",
    }

    mockExecute
      .mockResolvedValueOnce([settingsRows])   // settings lookup
      .mockResolvedValueOnce([[maliciousAsset]]) // asset lookup

    const fetchMock = jest.fn()
      // page search — no existing page
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      // create page
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page-1' }) })
      // update page body
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    global.fetch = fetchMock as unknown as typeof fetch

    const res = await POST(makeReq({ assetId: 'a1', pageTitle: 'Test Page' }))
    expect(res.status).toBe(200)

    const updateCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/wiki/rest/api/content/page-1'))
    expect(updateCall).toBeDefined()
    const updateBody = JSON.parse(updateCall![1].body)
    const storageValue = updateBody.body.storage.value as string

    expect(storageValue).not.toContain('<script>')
    expect(storageValue).toContain('&lt;script&gt;')
    expect(storageValue).not.toContain('"><img')
    expect(storageValue).toContain('&quot;&gt;&lt;img')
    expect(storageValue).toContain('Tom &amp; Jerry&#39;s &lt;b&gt;notes&lt;/b&gt;')
  })
})
