module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json', diagnostics: false }],
  },
  testMatch: ['**/tests/**/*.test.ts'],
};
