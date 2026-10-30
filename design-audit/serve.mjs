// Usage: node design-audit/serve.mjs [fresh|seeded] [port]. Serves dist/ with a mock /api/state, so Lighthouse can audit without a database.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { seed } from './seed.mjs'
const [, , profile = 'seeded', port = 4173] = process.argv
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  if (path.startsWith('/api/')) { res.setHeader('content-type', 'application/json'); return res.end(req.method === 'GET' && path === '/api/state' ? JSON.stringify(profile === 'seeded' ? seed() : {}) : '{"ok":true}') }
  try { const f = join('dist', path === '/' || !extname(path) ? 'index.html' : path); res.setHeader('content-type', TYPES[extname(f)] || 'application/octet-stream'); res.end(await readFile(f)) }
  catch { res.statusCode = 404; res.end() }
}).listen(port, () => console.log(`http://localhost:${port} (${profile})`))
