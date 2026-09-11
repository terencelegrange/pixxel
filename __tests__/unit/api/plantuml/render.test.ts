import { NextRequest } from 'next/server'

jest.mock('@/lib/require-user', () => ({
  requireUser: jest.fn().mockReturnValue({ ok: true, user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'Admin' } }),
}))

const originalFetch = global.fetch
const originalEnv = process.env.PLANTUML_SERVER_URL

afterEach(() => {
  global.fetch = originalFetch
  process.env.PLANTUML_SERVER_URL = originalEnv
  jest.resetModules()
})

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/plantuml/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/plantuml/render', () => {
  it('rejects source exceeding the length limit', async () => {
    const { POST } = await import('@/app/api/plantuml/render/route')
    const res = await POST(makeReq({ source: 'a'.repeat(20_001) }))
    expect(res.status).toBe(413)
  })

  it('defaults to the public plantuml.com server', async () => {
    delete process.env.PLANTUML_SERVER_URL
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '<svg/>' })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/plantuml/render/route')
    await POST(makeReq({ source: '@startuml\nA -> B\n@enduml' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/www\.plantuml\.com\/plantuml\/svg\//)
  })

  it('uses PLANTUML_SERVER_URL when configured', async () => {
    process.env.PLANTUML_SERVER_URL = 'http://plantuml.internal:8080/'
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '<svg/>' })
    global.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('@/app/api/plantuml/render/route')
    await POST(makeReq({ source: '@startuml\nA -> B\n@enduml' }))

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^http:\/\/plantuml\.internal:8080\/svg\//)
  })
})
