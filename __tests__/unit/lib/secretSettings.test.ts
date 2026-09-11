import { maskSecretSettings, MASKED_VALUE, SECRET_SETTING_KEYS } from '@/lib/secretSettings'

describe('maskSecretSettings', () => {
  it('masks configured secret keys that have a value', () => {
    const result = maskSecretSettings({
      'confluence.api_token': 'real-secret-token',
      'observability.api_key': 'another-real-secret',
    })
    expect(result['confluence.api_token']).toBe(MASKED_VALUE)
    expect(result['observability.api_key']).toBe(MASKED_VALUE)
  })

  it('does not mask an empty secret value (nothing to hide)', () => {
    const result = maskSecretSettings({ 'confluence.api_token': '' })
    expect(result['confluence.api_token']).toBe('')
  })

  it('leaves non-secret keys untouched', () => {
    const result = maskSecretSettings({
      'confluence.base_url': 'https://example.atlassian.net',
      'observability.collector_url': 'http://collector.internal/ingest',
    })
    expect(result['confluence.base_url']).toBe('https://example.atlassian.net')
    expect(result['observability.collector_url']).toBe('http://collector.internal/ingest')
  })

  it('SECRET_SETTING_KEYS includes both known secret fields', () => {
    expect(SECRET_SETTING_KEYS.has('confluence.api_token')).toBe(true)
    expect(SECRET_SETTING_KEYS.has('observability.api_key')).toBe(true)
  })
})
