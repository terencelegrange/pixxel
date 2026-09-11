/**
 * @jest-environment jsdom
 */

global.fetch = jest.fn()

import { getStoredUser, storeUser, clearStoredUser, loginUser, registerUser, verifyMfaChallenge, fetchCurrentUser } from '@/lib/auth'
import { User } from '@/types'

const mockUser: User = {
  id: 'u1', name: 'Jane Smith', email: 'jane@example.com',
  avatarInitials: 'JS', role: 'Member', createdAt: '2025-01-01T00:00:00.000Z',
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

describe('localStorage helpers', () => {
  it('storeUser writes JSON to saas_auth_user key', () => {
    storeUser(mockUser)
    expect(localStorage.getItem('saas_auth_user')).toBe(JSON.stringify(mockUser))
  })

  it('getStoredUser returns parsed user', () => {
    localStorage.setItem('saas_auth_user', JSON.stringify(mockUser))
    expect(getStoredUser()).toEqual(mockUser)
  })

  it('getStoredUser returns null when key is absent', () => {
    expect(getStoredUser()).toBeNull()
  })

  it('getStoredUser returns null when JSON is malformed', () => {
    localStorage.setItem('saas_auth_user', 'not-json{{{')
    expect(getStoredUser()).toBeNull()
  })

  it('clearStoredUser removes the key', () => {
    storeUser(mockUser)
    clearStoredUser()
    expect(localStorage.getItem('saas_auth_user')).toBeNull()
  })
})

describe('loginUser', () => {
  it('calls fetch with correct method and body, returns status "ok" + user', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    })
    const result = await loginUser('jane@example.com', 'password123')
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'jane@example.com', password: 'password123' }),
    }))
    expect(result).toEqual({ status: 'ok', user: mockUser })
  })

  it('returns status "mfa_required" + mfaToken when the account has MFA enabled', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mfaRequired: true, mfaToken: 'challenge-token' }),
    })
    const result = await loginUser('jane@example.com', 'password123')
    expect(result).toEqual({ status: 'mfa_required', mfaToken: 'challenge-token' })
  })

  it('throws when response is not ok', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid email or password.' }),
    })
    await expect(loginUser('a@b.com', 'wrong')).rejects.toThrow('Invalid email or password.')
  })
})

describe('verifyMfaChallenge', () => {
  it('posts the mfaToken and code to /api/auth/mfa/challenge', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    })
    const result = await verifyMfaChallenge('challenge-token', { code: '123456' })
    expect(fetch).toHaveBeenCalledWith('/api/auth/mfa/challenge', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ mfaToken: 'challenge-token', code: '123456' }),
    }))
    expect(result).toEqual(mockUser)
  })

  it('posts a recoveryCode when given one instead', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    })
    await verifyMfaChallenge('challenge-token', { recoveryCode: 'ABCDE-12345' })
    expect(fetch).toHaveBeenCalledWith('/api/auth/mfa/challenge', expect.objectContaining({
      body: JSON.stringify({ mfaToken: 'challenge-token', recoveryCode: 'ABCDE-12345' }),
    }))
  })

  it('throws when response is not ok', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid code.' }),
    })
    await expect(verifyMfaChallenge('challenge-token', { code: '000000' })).rejects.toThrow('Invalid code.')
  })
})

describe('registerUser', () => {
  it('calls fetch with name, email, password', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    })
    await registerUser('Jane Smith', 'jane@example.com', 'password123')
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Jane Smith', email: 'jane@example.com', password: 'password123' }),
    }))
  })

  it('throws when response is not ok', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Email already exists.' }),
    })
    await expect(registerUser('Jane', 'jane@example.com', 'password123')).rejects.toThrow('Email already exists.')
  })
})

describe('fetchCurrentUser', () => {
  it('returns the user when the session is valid', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser }),
    })
    const result = await fetchCurrentUser()
    expect(fetch).toHaveBeenCalledWith('/api/auth/me')
    expect(result).toEqual(mockUser)
  })

  it('returns null (not an error) when the session is missing/expired/revoked', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false })
    const result = await fetchCurrentUser()
    expect(result).toBeNull()
  })

  it('returns "unknown" on a network error, distinct from a confirmed logged-out state', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'))
    const result = await fetchCurrentUser()
    expect(result).toBe('unknown')
  })
})
