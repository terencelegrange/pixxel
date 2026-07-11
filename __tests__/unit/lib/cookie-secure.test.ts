import { NextRequest } from 'next/server'
import { isSecureRequest } from '@/lib/cookie-secure'

function makeReq(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers })
}

describe('isSecureRequest', () => {
  it('returns false for a plain HTTP request with no proxy header', () => {
    expect(isSecureRequest(makeReq('http://localhost:3000/api/auth/login'))).toBe(false)
  })

  it('returns true for a direct HTTPS request with no proxy header', () => {
    expect(isSecureRequest(makeReq('https://example.com/api/auth/login'))).toBe(true)
  })

  it('honors X-Forwarded-Proto: https over an HTTP request URL (TLS-terminating proxy)', () => {
    expect(
      isSecureRequest(makeReq('http://localhost:3000/api/auth/login', { 'x-forwarded-proto': 'https' }))
    ).toBe(true)
  })

  it('honors X-Forwarded-Proto: http even if the request URL itself is https', () => {
    expect(
      isSecureRequest(makeReq('https://localhost:3000/api/auth/login', { 'x-forwarded-proto': 'http' }))
    ).toBe(false)
  })

  it('takes the first value when X-Forwarded-Proto is a comma-separated chain', () => {
    expect(
      isSecureRequest(makeReq('http://localhost:3000/api/auth/login', { 'x-forwarded-proto': 'https, http' }))
    ).toBe(true)
  })
})
