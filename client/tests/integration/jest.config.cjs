module.exports = {
  displayName: 'integration',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../client/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  preset: 'ts-jest/presets/default-esm',
  setupFilesAfterEnv: ['<rootDir>/setup/jest.setup.ts'],
  testTimeout: 10000,
  collectCoverageFrom: [
    '<rootDir>/../../server/routes/**/*.ts',
    '!<rootDir>/../../server/routes/**/*.test.ts',
  ],
};
