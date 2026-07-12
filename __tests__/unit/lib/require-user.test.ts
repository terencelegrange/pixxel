import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}))
jest.mock('@/lib/jwt', () => ({
  verifyJwt: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { verifyJwt } from '@/lib/jwt'
import { requireUser } from '@/lib/require-user'

const mockExecute = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const payload = {
  sub: 'u1', name: 'Test User', email: 'test@example.com', role: 'Member',
  tokenVersion: 3, iat: 0, exp: Math.floor(Date.now() / 1000) + 3600,
}

function makeReq(opts: {
  method?: string
  cookie?: string
  origin?: string
  referer?: string
  host?: string
  forwardedHost?: string
  url?: string
} = {}) {
  const headers: Record<string, string> = {}
  if (opts.cookie !== undefined) headers['Cookie'] = opts.cookie
  if (opts.origin) headers['Origin'] = opts.origin
  if (opts.referer) headers['Referer'] = opts.referer
  // Real requests always carry a Host header reflecting whatever the client
  // actually connected to — default it here the way a real browser would,
  // so tests exercise the same code path production traffic does.
  headers['Host'] = opts.host ?? 'localhost'
  if (opts.forwardedHost) headers['X-Forwarded-Host'] = opts.forwardedHost
  return new NextRequest(opts.url ?? 'http://localhost/api/assets', {
    method: opts.method ?? 'GET',
    headers,
  })
}

describe('requireUser — CSRF origin check', () => {
  it('blocks a POST with a mismatched Origin header', async () => {
    const res = await requireUser(makeReq({ method: 'POST', origin: 'https://evil.com', cookie: 'authToken=x' }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it('allows a POST with a matching Origin header', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    const res = await requireUser(makeReq({ method: 'POST', origin: 'http://localhost', cookie: 'authToken=x' }))
    expect(res.ok).toBe(true)
  })

  it('allows a POST with no Origin/Referer (non-browser client)', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    const res = await requireUser(makeReq({ method: 'POST', cookie: 'authToken=x' }))
    expect(res.ok).toBe(true)
  })

  it('does not apply the origin check to GET requests', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    const res = await requireUser(makeReq({ method: 'GET', origin: 'https://evil.com', cookie: 'authToken=x' }))
    expect(res.ok).toBe(true)
  })

  // Regression test for the standalone-server bug: in Next.js's `output:
  // "standalone"` build (this app's Docker target), req.nextUrl is derived
  // from the server's own internal listen address (e.g. http://0.0.0.0:3000
  // from the HOSTNAME/PORT env vars), not the client's actual Host header —
  // so a container run with a remapped host port (`docker run -p
  // 3088:3000`, a completely normal deployment) would see every real
  // same-origin request rejected as cross-site. The fix must key off the
  // Host header, never req.nextUrl.origin, for exactly this reason.
  it('allows a matching Origin even when the request URL itself points at a different internal host/port', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    const res = await requireUser(makeReq({
      method: 'POST',
      cookie: 'authToken=x',
      url: 'http://0.0.0.0:3000/api/organisations', // internal bind address
      host: 'localhost:3088',                        // what the client actually used
      origin: 'http://localhost:3088',
    }))
    expect(res.ok).toBe(true)
  })

  it('rejects when Origin matches the internal bind address instead of the real Host', async () => {
    const res = await requireUser(makeReq({
      method: 'POST',
      cookie: 'authToken=x',
      url: 'http://0.0.0.0:3000/api/organisations',
      host: 'localhost:3088',
      origin: 'http://0.0.0.0:3000', // attacker (or stale client) using the internal address
    }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it('honors X-Forwarded-Host over Host when present (reverse-proxy deployment)', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    const res = await requireUser(makeReq({
      method: 'POST',
      cookie: 'authToken=x',
      host: 'internal-app:3000',
      forwardedHost: 'pixxel.example.com',
      origin: 'http://pixxel.example.com',
    }))
    expect(res.ok).toBe(true)
  })

  it('rejects when there is no Host header at all', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    const req = new NextRequest('http://localhost/api/assets', {
      method: 'POST',
      headers: { Cookie: 'authToken=x', Origin: 'http://localhost' },
    })
    req.headers.delete('host')
    const res = await requireUser(req)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })
})

describe('requireUser — token version', () => {
  it('rejects when the DB token_version no longer matches the JWT', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 4 }]]) // bumped since token was issued
    const res = await requireUser(makeReq({ cookie: 'authToken=x' }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it('rejects when the user no longer exists', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[]])
    const res = await requireUser(makeReq({ cookie: 'authToken=x' }))
    expect(res.ok).toBe(false)
  })

  it('accepts when the DB token_version matches', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    const res = await requireUser(makeReq({ cookie: 'authToken=x' }))
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.user.id).toBe('u1')
  })
})

describe('requireUser — basic auth checks', () => {
  it('rejects when there is no cookie', async () => {
    const res = await requireUser(makeReq())
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it('rejects when the JWT fails verification', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(null)
    const res = await requireUser(makeReq({ cookie: 'authToken=bad' }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it('enforces the required role', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    const res = await requireUser(makeReq({ cookie: 'authToken=x' }), 'Admin')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })
})
