import { NextRequest } from 'next/server'
import fs from 'fs'

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

  it('reports failure when the sqlite directory cannot be created', async () => {
    ;(fs.mkdirSync as jest.Mock) = jest.fn(() => { throw new Error('EACCES: permission denied'); })
    const res = await POST(makeReq({ dialect: 'sqlite', file: '/root/no-access/pixxel.db' }))
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
