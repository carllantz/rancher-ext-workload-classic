module.exports = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  testMatch:       ['<rootDir>/pkg/**/__tests__/**/*.test.ts'],
  // ts-jest resolves the tsconfig nearest to <rootDir>, which is the repo
  // root tsconfig.json — it does not include "@types/jest" in its "types"
  // array (only the nested pkg/workload-classic/tsconfig.json does), so
  // Jest globals fail to type-check. isolatedModules switches ts-jest to
  // per-file transpilation (no cross-file/global type checking), which
  // sidesteps that without editing any tsconfig shared with other tasks.
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
};
