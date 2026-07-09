// __tests__/unit/lib/csv.test.ts
import { parseCsv } from '@/lib/csv'

describe('parseCsv', () => {
  it('parses a basic unquoted row', () => {
    const { headers, rows } = parseCsv('name,department\nApp One,IT\nApp Two,Finance\n')
    expect(headers).toEqual(['name', 'department'])
    expect(rows).toEqual([
      { name: 'App One', department: 'IT' },
      { name: 'App Two', department: 'Finance' },
    ])
  })

  it('handles quoted fields containing commas', () => {
    const { headers, rows } = parseCsv('name,description\n"Widget, Inc.",A test app\n')
    expect(headers).toEqual(['name', 'description'])
    expect(rows).toEqual([{ name: 'Widget, Inc.', description: 'A test app' }])
  })

  it('handles escaped double quotes inside a quoted field', () => {
    const { rows } = parseCsv('name,notes\nApp One,"He said ""hello"" to me"\n')
    expect(rows).toEqual([{ name: 'App One', notes: 'He said "hello" to me' }])
  })

  it('handles multiline quoted fields', () => {
    const { rows } = parseCsv('name,notes\nApp One,"line one\nline two"\nApp Two,plain\n')
    expect(rows).toEqual([
      { name: 'App One', notes: 'line one\nline two' },
      { name: 'App Two', notes: 'plain' },
    ])
  })

  it('handles CRLF line endings and a missing trailing final newline', () => {
    const { headers, rows } = parseCsv('name,department\r\nApp One,IT')
    expect(headers).toEqual(['name', 'department'])
    expect(rows).toEqual([{ name: 'App One', department: 'IT' }])
  })

  it('returns empty headers/rows for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
  })

  it('fills missing trailing cells with empty string', () => {
    const { rows } = parseCsv('name,department,notes\nApp One,IT\n')
    expect(rows).toEqual([{ name: 'App One', department: 'IT', notes: '' }])
  })
})
