import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}))
jest.mock('@/lib/jwt', () => ({
  verifyJwt: jest.fn(),
}))
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}))

import { getDb } from '@/lib/db'
import { verifyJwt } from '@/lib/jwt'
import { requireUser } from '@/lib/require-user'
import logger from '@/lib/logger'

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
  authorization?: string
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
  if (opts.authorization) headers['Authorization'] = opts.authorization
  return new NextRequest(opts.url ?? 'http://localhost/api/assets', {
    method: opts.method ?? 'GET',
    headers,
  })
}

const RAW_KEY = 'pxk_' + 'a'.repeat(43)

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

describe('requireUser — API key (bearer) auth', () => {
  const creatorRow = { id: 'creator-1', name: 'Key Creator', email: 'creator@example.com', role: 'Admin' }

  it('rejects a malformed bearer value without hitting the DB', async () => {
    const res = await requireUser(makeReq({ authorization: 'Bearer not-a-key' }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('rejects an unknown key hash', async () => {
    mockExecute.mockResolvedValueOnce([[]]) // no api_keys row
    const res = await requireUser(makeReq({ authorization: `Bearer ${RAW_KEY}` }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it('rejects a revoked key', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'k1', created_by_id: 'creator-1', expires_at: null, revoked_at: new Date() }]])
    const res = await requireUser(makeReq({ authorization: `Bearer ${RAW_KEY}` }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it('rejects an expired key', async () => {
    mockExecute.mockResolvedValueOnce([[{
      id: 'k1', created_by_id: 'creator-1', revoked_at: null,
      expires_at: new Date(Date.now() - 1000),
    }]])
    const res = await requireUser(makeReq({ authorization: `Bearer ${RAW_KEY}` }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it('resolves to the creating user\'s CURRENT role on a valid key, and bumps usage', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'k1', created_by_id: 'creator-1', expires_at: null, revoked_at: null }]])
      .mockResolvedValueOnce([[creatorRow]])
      .mockResolvedValueOnce([{}]) // usage-bump UPDATE
    const res = await requireUser(makeReq({ authorization: `Bearer ${RAW_KEY}` }))
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.user.id).toBe('creator-1')
      expect(res.user.role).toBe('Admin')
    }
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })

  it('rejects when the creating user no longer exists', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'k1', created_by_id: 'creator-1', expires_at: null, revoked_at: null }]])
      .mockResolvedValueOnce([[]])
    const res = await requireUser(makeReq({ authorization: `Bearer ${RAW_KEY}` }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it('enforces requiredRole on a bearer-authed request', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'k1', created_by_id: 'creator-1', expires_at: null, revoked_at: null }]])
      .mockResolvedValueOnce([[{ ...creatorRow, role: 'Member' }]])
    const res = await requireUser(makeReq({ authorization: `Bearer ${RAW_KEY}` }), 'Admin')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it('bypasses the CSRF/origin check for bearer-authed requests', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'k1', created_by_id: 'creator-1', expires_at: null, revoked_at: null }]])
      .mockResolvedValueOnce([[creatorRow]])
      .mockResolvedValueOnce([{}])
    const res = await requireUser(makeReq({
      method: 'POST', authorization: `Bearer ${RAW_KEY}`, origin: 'https://evil.com',
    }))
    expect(res.ok).toBe(true)
  })

  it('still succeeds when the usage-bump write fails', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'k1', created_by_id: 'creator-1', expires_at: null, revoked_at: null }]])
      .mockResolvedValueOnce([[creatorRow]])
      .mockRejectedValueOnce(new Error('db unavailable'))
    const res = await requireUser(makeReq({ authorization: `Bearer ${RAW_KEY}` }))
    expect(res.ok).toBe(true)
  })
})

describe('requireUser — central request logging (PIXXEL-2)', () => {
  it('logs a single "api_request" line on success, with user/role', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    await requireUser(makeReq({ cookie: 'authToken=x' }))
    expect(logger.info).toHaveBeenCalledTimes(1)
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET', path: '/api/assets', status: 200, outcome: 'ok',
        userId: 'u1', role: 'Member',
      }),
      'api_request'
    )
  })

  it('logs with no user/role when there is no cookie', async () => {
    await requireUser(makeReq())
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, outcome: 'unauthenticated', userId: undefined, role: undefined }),
      'api_request'
    )
  })

  it('logs the forbidden outcome (with user/role, since auth succeeded before the role check) when the role does not match', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 3 }]])
    await requireUser(makeReq({ cookie: 'authToken=x' }), 'Admin')
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, outcome: 'forbidden', userId: 'u1', role: 'Member' }),
      'api_request'
    )
  })

  it('never logs more than once per call, regardless of which branch returns', async () => {
    (verifyJwt as jest.Mock).mockReturnValue(payload)
    mockExecute.mockResolvedValueOnce([[{ token_version: 4 }]]) // mismatched -> session_expired branch
    await requireUser(makeReq({ cookie: 'authToken=x' }))
    expect(logger.info).toHaveBeenCalledTimes(1)
  })
})
