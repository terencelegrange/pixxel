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
  // Floor pinned just under today's measured baseline (~51%/64%/72%/51%) so
  // CI fails on regressions without blocking on the large pre-existing gap.
  // Raise these as coverage improves; don't lower them.
  coverageThreshold: {
    global: {
      statements: 48,
      branches: 60,
      functions: 68,
      lines: 48,
    },
  },
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      // testRegex (not testMatch): testMatch runs its glob through
      // micromatch, which mis-escapes the literal ".claude" path segment
      // when <rootDir> sits under a .claude/worktrees/* checkout on
      // Windows, silently matching zero files. testRegex applies directly
      // to the normalized path string and isn't affected.
      testRegex: '__tests__/unit/.*\\.test\\.ts$',
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
      // Avoid haste-map collisions with the standalone build's copied
      // package.json (and coverage output) when .next/ exists on disk.
      modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/coverage/', '<rootDir>/.claude/'],
      testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.claude/'],
    } as any,
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testRegex: '__tests__/integration/.*\\.test\\.ts$',
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
      // Avoid haste-map collisions with the standalone build's copied
      // package.json (and coverage output) when .next/ exists on disk.
      modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/coverage/', '<rootDir>/.claude/'],
      testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.claude/'],
    } as any,
    {
      displayName: 'ui',
      testEnvironment: 'jsdom',
      testRegex: '__tests__/ui/.*\\.test\\.tsx$',
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(css|scss)$': '<rootDir>/__tests__/__mocks__/fileMock.ts',
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/coverage/', '<rootDir>/.claude/'],
      testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.claude/'],
    } as any,
  ],
}

export default config
