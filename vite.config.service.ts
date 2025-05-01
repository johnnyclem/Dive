import { defineConfig } from 'vite'
import path from 'path'
import { builtinModules } from 'module'

export default defineConfig({
  build: {
    target: 'node16',
    lib: {
      entry: {
        services: path.resolve(__dirname, 'services/index.ts'),
        main: path.resolve(__dirname, 'services/main.ts')
      },
      formats: ['es']
    },
    outDir: 'dist-services',
    emptyOutDir: true,
    rollupOptions: {
      external: [...builtinModules, 'express', 'better-sqlite3'],
      output: {
        format: 'es',
        exports: 'named',
        entryFileNames: '[name].js'
      }
    }
  },
}) 