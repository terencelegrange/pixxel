import fs from 'fs'
import path from 'path'

jest.mock('fs')

import { getSiteConfig, writeSiteConfig, type SiteConfig } from '@/lib/setup'

const CONFIG_PATH = path.join(process.cwd(), 'site.config.json')

describe('lib/setup dialect handling', () => {
  beforeEach(() => jest.clearAllMocks())

  it('normalizes a pre-dialect site.config.json to mysql', () => {
    const legacy = {
      setupComplete: true,
      appName: 'Pixxel',
      orgName: 'Acme',
      db: { host: 'localhost', port: 3306, user: 'root', password: '', name: 'saas_app' },
    }
    ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(legacy))

    const config = getSiteConfig()

    expect(config?.db).toEqual({
      dialect: 'mysql',
      host: 'localhost', port: 3306, user: 'root', password: '', name: 'saas_app',
    })
  })

  it('round-trips a sqlite config unchanged', () => {
    const config: SiteConfig = {
      setupComplete: true,
      appName: 'Pixxel',
      orgName: 'Acme',
      db: { dialect: 'sqlite', file: 'data/pixxel.db' },
    }
    writeSiteConfig(config)
    const written = (fs.writeFileSync as jest.Mock).mock.calls[0]
    expect(written[0]).toBe(CONFIG_PATH)
    ;(fs.readFileSync as jest.Mock).mockReturnValue(written[1] as string)

    expect(getSiteConfig()).toEqual(config)
  })
})
