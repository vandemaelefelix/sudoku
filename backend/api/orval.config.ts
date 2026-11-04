import { defineConfig } from 'orval'

// The output is a test input only (git-ignored). The zod contracts in shared/ stay the source of truth.
export default defineConfig({
  api: {
    input: './openapi.yaml',
    output: {
      client: 'zod',
      mode: 'single',
      target: './.generated/api.zod.ts',
      clean: true,
    },
  },
})
