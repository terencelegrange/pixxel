import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

jest.mock('fs')
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(),
}))

import mysql from 'mysql2/promise'
import { POST } from '@/app/api/setup/test-db/route'

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/setup/test-db', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/setup/test-db', () => {
  beforeEach(() => jest.clearAllMocks())

  it('checks the directory is writable for sqlite, without opening a mysql connection', async () => {
    ;(fs.accessSync as jest.Mock) = jest.fn()
    ;(fs.mkdirSync as jest.Mock) = jest.fn()
    const res = await POST(makeReq({ dialect: 'sqlite', file: 'data/pixxel.db' }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mysql.createConnection).not.toHaveBeenCalled()
  })

  it('derives the writability check directory the same way lib/db-sqlite.ts derives it (path.dirname(file), not joined with cwd)', async () => {
    const mkdirSync = jest.fn()
    ;(fs.mkdirSync as jest.Mock) = mkdirSync
    ;(fs.accessSync as jest.Mock) = jest.fn()
    await POST(makeReq({ dialect: 'sqlite', file: 'data/pixxel.db' }))
    expect(mkdirSync).toHaveBeenCalledWith('data', { recursive: true })
  })

  it('rejects an absolute sqlite file path', async () => {
    const res = await POST(makeReq({ dialect: 'sqlite', file: '/etc/pixxel.db' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toContain('relative path')
  })

  it('rejects a sqlite file path that traverses outside the project directory', async () => {
    const res = await POST(makeReq({ dialect: 'sqlite', file: '../../etc/pixxel.db' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toContain('relative path')
  })

  it('rejects a sqlite file path resolving to a sibling directory sharing a prefix with the project directory (bare startsWith bypass)', async () => {
    // e.g. cwd "/app" + file "../app-secrets/db.sqlite" resolves to "/app-secrets/db.sqlite",
    // which a bare `.startsWith(cwd)` check would wrongly accept since
    // "/app-secrets/db.sqlite".startsWith("/app") is true, even though it is
    // a sibling directory entirely outside the project root.
    const siblingFile = `../${path.basename(process.cwd())}-secrets/db.sqlite`
    const res = await POST(makeReq({ dialect: 'sqlite', file: siblingFile }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toContain('relative path')
  })

  it('still accepts a normal relative sqlite file path', async () => {
    ;(fs.accessSync as jest.Mock) = jest.fn()
    ;(fs.mkdirSync as jest.Mock) = jest.fn()
    const res = await POST(makeReq({ dialect: 'sqlite', file: 'data/pixxel.db' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('reports failure when the sqlite directory cannot be created', async () => {
    ;(fs.mkdirSync as jest.Mock) = jest.fn(() => { throw new Error('EACCES: permission denied'); })
    const res = await POST(makeReq({ dialect: 'sqlite', file: 'no-access/pixxel.db' }))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('permission denied')
  })

  it('still opens a mysql connection for the mysql dialect', async () => {
    const mockEnd = jest.fn().mockResolvedValue(undefined);
    (mysql.createConnection as jest.Mock).mockResolvedValue({
      execute: jest.fn().mockResolvedValue([[]]),
      end: mockEnd,
    })
    const res = await POST(makeReq({ dialect: 'mysql', host: 'localhost', port: 3306, user: 'root', password: '', name: 'saas_app' }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mysql.createConnection).toHaveBeenCalled()
  })
})
