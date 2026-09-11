import { sendToCustomCollector } from '@/lib/observability/sinks/customCollector'
import { ObservabilityConfig } from '@/lib/observability/config'

const CONFIG: ObservabilityConfig = {
  enabled: true, provider: 'custom', collectorUrl: 'http://collector.local/ingest/pixxel',
  authType: 'bearer', apiKey: 'secret-token', minLevel: 'debug', channel: 'pixxel',
}

const ENTRY = { level: 'info' as const, message: 'hello', timestamp: '2026-01-01T00:00:00.000Z', metadata: { foo: 'bar' } }

const originalFetch = global.fetch
afterEach(() => { global.fetch = originalFetch; jest.clearAllMocks() })

describe('sendToCustomCollector', () => {
  it('returns an error without calling fetch when no collector URL is configured', async () => {
    const result = await sendToCustomCollector({ ...CONFIG, collectorUrl: '' }, ENTRY)
    expect(result).toEqual({ ok: false, error: 'No collector URL configured.' })
  })

  it('sends the collector-shaped body: channel, timestamp, payload', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 202 })
    global.fetch = mockFetch as unknown as typeof fetch

    await sendToCustomCollector(CONFIG, ENTRY)

    expect(mockFetch).toHaveBeenCalledWith('http://collector.local/ingest/pixxel', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
    }))
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({
      channel: 'pixxel',
      timestamp: '2026-01-01T00:00:00.000Z',
      payload: { level: 'info', message: 'hello', metadata: { foo: 'bar' } },
    })
  })

  it('returns ok:true on a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 202 }) as unknown as typeof fetch
    const result = await sendToCustomCollector(CONFIG, ENTRY)
    expect(result).toEqual({ ok: true, status: 202 })
  })

  it('returns ok:false with the response body on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 422, statusText: 'Unprocessable Entity',
      text: () => Promise.resolve('{"detail":"channel is required"}'),
    }) as unknown as typeof fetch
    const result = await sendToCustomCollector(CONFIG, ENTRY)
    expect(result).toEqual({ ok: false, status: 422, error: '{"detail":"channel is required"}' })
  })

  it('returns ok:false when fetch throws (e.g. timeout or network error)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed')) as unknown as typeof fetch
    const result = await sendToCustomCollector(CONFIG, ENTRY)
    expect(result).toEqual({ ok: false, error: 'fetch failed' })
  })
})
