import { defineConfig } from 'vitest/config'

// The normal test run never reads this file. `just technique-coverage` passes it with --config.
export default defineConfig({
  test: {
    include: ['scripts/*.coverage.ts'],
    testTimeout: 3_600_000,
  },
})
