import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  getDbDialect: jest.fn().mockReturnValue('mysql'),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

import { getDb, getDbDialect } from '@/lib/db'
import { POST } from '@/app/api/plantuml/[id]/assets/auto-tag/route'

const mockExecute = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/plantuml/diagram-1/assets/auto-tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/plantuml/[id]/assets/auto-tag', () => {
  it('returns empty result when no participant names provided', async () => {
    const res = await POST(makeReq({ participantNames: [] }), { params: Promise.resolve({ id: 'diagram-1' }) })
    const body = await res.json()
    expect(body).toEqual({ tagged: [], unmatched: [] })
  })

  it('uses ON DUPLICATE KEY UPDATE for mysql dialect', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'asset-1', name: 'Alice', shortCode: 'AL' }]])
      .mockResolvedValueOnce([{}])

    const res = await POST(makeReq({ participantNames: ['Alice'] }), { params: Promise.resolve({ id: 'diagram-1' }) })
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      `INSERT INTO plantuml_diagram_assets (diagram_id, asset_id, matched_on) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE matched_on = VALUES(matched_on)`,
      ['diagram-1', 'asset-1', 'name']
    )
  })

  it('uses ON CONFLICT DO UPDATE for sqlite dialect', async () => {
    ;(getDbDialect as jest.Mock).mockReturnValue('sqlite')
    mockExecute
      .mockResolvedValueOnce([[{ id: 'asset-1', name: 'Alice', shortCode: 'AL' }]])
      .mockResolvedValueOnce([{}])

    const res = await POST(makeReq({ participantNames: ['Alice'] }), { params: Promise.resolve({ id: 'diagram-1' }) })
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledWith(
      'INSERT INTO plantuml_diagram_assets (diagram_id, asset_id, matched_on) VALUES (?, ?, ?) ON CONFLICT(diagram_id, asset_id) DO UPDATE SET matched_on = excluded.matched_on',
      ['diagram-1', 'asset-1', 'name']
    )
  })
})
