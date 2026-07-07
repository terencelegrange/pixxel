// __tests__/unit/lib/sql-compat.test.ts
import { insertIgnoreSql, upsertSql, nowSql } from '@/lib/sql-compat'

describe('insertIgnoreSql', () => {
  it('produces MySQL INSERT IGNORE syntax', () => {
    expect(insertIgnoreSql('asset_departments', ['asset_id', 'department_id'], 'mysql'))
      .toBe('INSERT IGNORE INTO asset_departments (asset_id, department_id) VALUES (?, ?)')
  })

  it('produces SQLite INSERT OR IGNORE syntax', () => {
    expect(insertIgnoreSql('asset_departments', ['asset_id', 'department_id'], 'sqlite'))
      .toBe('INSERT OR IGNORE INTO asset_departments (asset_id, department_id) VALUES (?, ?)')
  })
})

describe('upsertSql', () => {
  it('produces MySQL ON DUPLICATE KEY UPDATE syntax', () => {
    expect(upsertSql('app_settings', ['key', 'value'], 'value', 'mysql'))
      .toBe('INSERT INTO app_settings (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)')
  })

  it('produces SQLite ON CONFLICT DO UPDATE syntax, conflicting on the first column', () => {
    expect(upsertSql('app_settings', ['key', 'value'], 'value', 'sqlite'))
      .toBe('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  })

  it('supports a composite conflict target (all columns before the update column)', () => {
    expect(upsertSql('plantuml_diagram_assets', ['diagram_id', 'asset_id', 'matched_on'], 'matched_on', 'sqlite'))
      .toBe('INSERT INTO plantuml_diagram_assets (diagram_id, asset_id, matched_on) VALUES (?, ?, ?) ON CONFLICT(diagram_id, asset_id) DO UPDATE SET matched_on = excluded.matched_on')
  })
})

describe('nowSql', () => {
  it('returns NOW() for mysql', () => {
    expect(nowSql('mysql')).toBe('NOW()')
  })
  it('returns CURRENT_TIMESTAMP for sqlite', () => {
    expect(nowSql('sqlite')).toBe('CURRENT_TIMESTAMP')
  })
})
