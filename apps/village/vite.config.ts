import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
// @ts-expect-error plain JS module shared with the Desker app's local dev
import { devApi } from '../../scripts/dev-api.js'

// Dev host village.desker.test (one /etc/hosts line, see README) so the cookie on .desker.test is shared with desker.test:3000.
const BUILD = String(Date.now()) // one id per build; the page compares it with /version.json to learn that a newer one is out
export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), { name: 'version-json', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }) } }, devApi({ root: resolve(__dirname, '../..'), apiDir: resolve(__dirname, 'api') })],
  server: { host: true, port: 5174, allowedHosts: ['.desker.test', '.desker.dev'] },
  build: { chunkSizeWarningLimit: 1500 }, // Phaser is large; it is lazy-loaded with the world, not with the picker
})
