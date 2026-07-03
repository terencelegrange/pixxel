import type { Config } from 'jest'

const config: Config = {
  testTimeout: 30000,
  coverageDirectory: '<rootDir>/coverage',
  // ts-jest's TS-compiled output isn't compatible with the default Babel-based
  // instrumentation (babel-plugin-istanbul) — use V8's native coverage instead.
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'app/api/**/*.ts',
    'lib/**/*.ts',
    '!**/*.d.ts',
  ],
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/unit/**/*.test.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    } as any,
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/**/*.test.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    } as any,
    {
      displayName: 'ui',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/ui/**/*.test.tsx'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(css|scss)$': '<rootDir>/__tests__/__mocks__/fileMock.ts',
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    } as any,
  ],
}

export default config
