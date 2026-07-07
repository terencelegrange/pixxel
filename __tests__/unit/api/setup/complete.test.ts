import { NextRequest } from 'next/server'
import fs from 'fs'

jest.mock('fs')
jest.mock('@/lib/setup', () => ({
  isSetupComplete: jest.fn(),
  writeSiteConfig: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'),
}))

import { isSetupComplete, writeSiteConfig } from '@/lib/setup'
import { setupDatabase, getDb, resetPool } from '@/lib/db'
import { POST } from '@/app/api/setup/complete/route'

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/setup/complete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

const validAdmin = { name: 'Jane Admin', email: 'jane@example.com', password: 'password123' }
const mysqlDb = { dialect: 'mysql', host: 'localhost', port: 3306, user: 'root', password: '', name: 'saas_app' }
const sqliteDb = { dialect: 'sqlite', file: 'data/pixxel.db' }

describe('POST /api/setup/complete', () => {
  const mockExecute = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(isSetupComplete as jest.Mock).mockReturnValue(false)
    ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
    mockExecute.mockResolvedValue([{}])
    ;(fs.writeFileSync as jest.Mock) = jest.fn()
  })

  it('returns 400 when setup is already complete', async () => {
    ;(isSetupComplete as jest.Mock).mockReturnValue(true)
    const res = await POST(makeReq({ db: mysqlDb, appName: 'App', orgName: 'Org', admin: validAdmin }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when db config has no dialect', async () => {
    const res = await POST(makeReq({ db: { host: 'localhost' }, appName: 'App', orgName: 'Org', admin: validAdmin }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when mysql dialect is missing host/user/name', async () => {
    const res = await POST(makeReq({ db: { dialect: 'mysql' }, appName: 'App', orgName: 'Org', admin: validAdmin }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when sqlite dialect is missing file', async () => {
    const res = await POST(makeReq({ db: { dialect: 'sqlite', file: '  ' }, appName: 'App', orgName: 'Org', admin: validAdmin }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when appName or orgName missing', async () => {
    const res = await POST(makeReq({ db: mysqlDb, appName: '', orgName: 'Org', admin: validAdmin }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when admin fields missing', async () => {
    const res = await POST(makeReq({ db: mysqlDb, appName: 'App', orgName: 'Org', admin: { name: '', email: '', password: '' } }))
    expect(res.status).toBe(400)
  })

  it('completes setup with a mysql dialect config', async () => {
    const res = await POST(makeReq({ db: mysqlDb, appName: 'App', orgName: 'Org', admin: validAdmin }))
    expect(res.status).toBe(200)
    expect(setupDatabase).toHaveBeenCalled()
    expect(resetPool).toHaveBeenCalled()

    expect(writeSiteConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        setupComplete: true,
        db: expect.objectContaining({ dialect: 'mysql', host: 'localhost', name: 'saas_app' }),
      })
    )

    const envContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
    expect(envContent).toContain('DB_TYPE=mysql')
    expect(envContent).toContain('DB_HOST=localhost')
    expect(envContent).toContain('DB_NAME=saas_app')
  })

  it('completes setup with a sqlite dialect config', async () => {
    const res = await POST(makeReq({ db: sqliteDb, appName: 'App', orgName: 'Org', admin: validAdmin }))
    expect(res.status).toBe(200)

    expect(writeSiteConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        setupComplete: true,
        db: { dialect: 'sqlite', file: 'data/pixxel.db' },
      })
    )

    const envContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
    expect(envContent).toContain('DB_TYPE=sqlite')
    expect(envContent).toContain('DB_FILE=data/pixxel.db')
    expect(envContent).not.toContain('DB_HOST')
  })

  it('rolls back setupComplete to false when bootstrapping fails', async () => {
    ;(setupDatabase as jest.Mock).mockRejectedValueOnce(new Error('boom'))
    const res = await POST(makeReq({ db: sqliteDb, appName: 'App', orgName: 'Org', admin: validAdmin }))
    expect(res.status).toBe(500)

    const calls = (writeSiteConfig as jest.Mock).mock.calls
    const lastCall = calls[calls.length - 1][0]
    expect(lastCall.setupComplete).toBe(false)
    expect(lastCall.db).toEqual({ dialect: 'sqlite', file: 'data/pixxel.db' })
  })
})
