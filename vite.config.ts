import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    build: {
      target: 'esnext',
    },
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src'),
        '@services': path.join(__dirname, 'services')
      },
    },
    optimizeDeps: {
      include: [
        'algorand-mcp/packages/client/src/index',
        '@perawallet/connect',
        '@blockshake/defly-connect',
        '@daffiwallet/connect',
      ],
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api': 'http://localhost:4321',
      }
    }
  }
})
