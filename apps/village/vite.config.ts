import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
// @ts-expect-error plain JS module shared with the Desker app's local dev
import { devApi } from '../../scripts/dev-api.js'

// Dev host village.desker.test (one /etc/hosts line, see README) so the cookie on .desker.test is shared with desker.test:3000.
export default defineConfig({
  plugins: [react(), devApi({ root: resolve(__dirname, '../..'), apiDir: resolve(__dirname, 'api') })],
  server: { host: true, port: 5174, allowedHosts: ['.desker.test', '.desker.dev'] },
  build: { chunkSizeWarningLimit: 1500 }, // Phaser is large; it is lazy-loaded with the world, not with the picker
})
