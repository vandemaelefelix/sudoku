import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['test/unit/**/*.test.ts'] } },
      {
        test: {
          name: 'db',
          include: ['test/db/**/*.test.ts'],
          globalSetup: ['test/db/globalSetup.ts'],
          // A DynamoDB Local call takes milliseconds, but the paging tests write 1,200 rows.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
