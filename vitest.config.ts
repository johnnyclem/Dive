import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: __dirname,
    include: [
      'test/**/*.test.ts',
      'test/**/*.spec.ts'
    ],
    testTimeout: 1000 * 29,
  },
})
