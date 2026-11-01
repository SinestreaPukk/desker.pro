// `npm run dev:local`: the Desker app + its api/ functions on one port, using ONLY .env.local (see scripts/dev-api.js). For testing against a Neon branch.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devApi } from './scripts/dev-api.js'

// The same rewrites as vercel.json, for routing only (the function still sees the original URL).
const rewrites = [
  [/^\/api\/ics$/, '/api/state?feed=1'],
  [/^\/api\/(signup|login|logout|me|forgot-password|reset-password|account)$/, '/api/auth/x'],
  [/^\/api\/auth\/.+$/, '/api/auth/x'],
]
export default defineConfig({
  plugins: [react(), tailwindcss(), devApi({ root: import.meta.dirname, apiDir: import.meta.dirname + '/api', rewrites })],
  server: { host: true, port: 3000, strictPort: true, allowedHosts: ['.desker.test'] },
})
