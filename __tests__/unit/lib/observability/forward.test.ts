jest.mock('@/lib/observability/config', () => ({
  getObservabilityConfig: jest.fn(),
}))
jest.mock('@/lib/observability/sinks/customCollector', () => ({
  sendToCustomCollector: jest.fn(),
}))

import { getObservabilityConfig } from '@/lib/observability/config'
import { sendToCustomCollector } from '@/lib/observability/sinks/customCollector'
import { forwardLog } from '@/lib/observability/forward'

const baseConfig = {
  enabled: true,
  provider: 'custom' as const,
  collectorUrl: 'http://collector.internal/ingest',
  authType: 'bearer' as const,
  apiKey: 'test-key',
  minLevel: 'warn' as const,
};

// forwardLog fires an internal async IIFE it doesn't await — flush microtasks
// between calling it and asserting.
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks()
  ;(sendToCustomCollector as jest.Mock).mockResolvedValue({ ok: true, status: 201 })
})

describe('forwardLog', () => {
  it('does nothing when observability is disabled', async () => {
    ;(getObservabilityConfig as jest.Mock).mockResolvedValue({ ...baseConfig, enabled: false })
    forwardLog(50, [{ err: new Error('boom') }, 'request failed'])
    await flush()
    expect(sendToCustomCollector).not.toHaveBeenCalled()
  })

  it('does nothing when provider is none', async () => {
    ;(getObservabilityConfig as jest.Mock).mockResolvedValue({ ...baseConfig, provider: 'none' })
    forwardLog(50, ['error message'])
    await flush()
    expect(sendToCustomCollector).not.toHaveBeenCalled()
  })

  it('skips levels below the configured minimum', async () => {
    ;(getObservabilityConfig as jest.Mock).mockResolvedValue({ ...baseConfig, minLevel: 'error' })
    forwardLog(40, ['a warning']) // warn is below error threshold
    await flush()
    expect(sendToCustomCollector).not.toHaveBeenCalled()
  })

  it('forwards a plain string message at info level', async () => {
    ;(getObservabilityConfig as jest.Mock).mockResolvedValue({ ...baseConfig, minLevel: 'debug' })
    forwardLog(30, ['plain info message'])
    await flush()
    expect(sendToCustomCollector).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'custom' }),
      expect.objectContaining({ level: 'info', message: 'plain info message' })
    )
  })

  it('extracts message + metadata from a pino merge-object call, serializing Error instances', async () => {
    ;(getObservabilityConfig as jest.Mock).mockResolvedValue(baseConfig)
    const err = new Error('db exploded')
    forwardLog(50, [{ err, route: 'GET /api/assets' }, 'request failed'])
    await flush()
    expect(sendToCustomCollector).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        level: 'error',
        message: 'request failed',
        metadata: expect.objectContaining({
          route: 'GET /api/assets',
          err: expect.objectContaining({ message: 'db exploded' }),
        }),
      })
    )
  })

  it('maps fatal (60) to error and trace (10) to debug', async () => {
    ;(getObservabilityConfig as jest.Mock).mockResolvedValue({ ...baseConfig, minLevel: 'debug' })
    forwardLog(60, ['fatal!'])
    await flush()
    expect(sendToCustomCollector).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ level: 'error' }))

    forwardLog(10, ['trace!'])
    await flush()
    expect(sendToCustomCollector).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ level: 'debug' }))
  })

  it('never throws even if the sink rejects', async () => {
    ;(getObservabilityConfig as jest.Mock).mockResolvedValue(baseConfig)
    ;(sendToCustomCollector as jest.Mock).mockRejectedValue(new Error('network down'))
    expect(() => forwardLog(50, ['boom'])).not.toThrow()
    await flush()
  })
})
