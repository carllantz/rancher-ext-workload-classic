module.exports = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  testMatch:       ['<rootDir>/pkg/**/__tests__/**/*.test.ts'],
  // ts-jest resolves the tsconfig nearest to <rootDir>, which is the repo
  // root tsconfig.json — it does not include "@types/jest" in its "types"
  // array (only the nested pkg/workload-classic/tsconfig.json does), so
  // Jest globals fail to type-check under the default resolution. Pointing
  // ts-jest at the package tsconfig (which already includes @types/jest)
  // fixes that while keeping full type checking intact, without editing the
  // repo-root tsconfig shared with other tasks.
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/pkg/workload-classic/tsconfig.json' }] },
};
