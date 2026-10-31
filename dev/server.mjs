// Local server with nothing to configure: Vite for the app, plus the Vercel-style handlers in api/, unchanged.
// AI calls use this terminal's `claude` login (claude-fetch.mjs); the database is PGlite in .data/ (neon-shim.mjs).
//   npm run dev:local
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { createServer as createVite } from 'vite'
import './claude-fetch.mjs'

const PORT = Number(process.env.PORT) || 3000
const ROOT = new URL('../', import.meta.url)
const ROUTE = /^\/api\/((?:v1\/)?[a-z]+)$/ // same as Vercel: _files are not routes
const LOCAL = /^(localhost|127\.0\.0\.1)(:\d+)?$/ // this server spends your Claude plan: refuse other hostnames (DNS rebinding)
const MAX_BODY = 4_500_000 // Vercel's request limit

const shim = new URL('./neon-shim.mjs', import.meta.url).href
registerHooks({ resolve: (spec, ctx, next) => (spec === '@neondatabase/serverless' ? { url: shim, shortCircuit: true } : next(spec, ctx)) })
process.env.DSB_PASSWORD ||= 'dev'

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    if ((size += c.length) > MAX_BODY) return null
    chunks.push(c)
  }
  return Buffer.concat(chunks).toString()
}

// The parts of Vercel's req/res helpers that the handlers use. Only JSON bodies are parsed, so other sites can't post here without a CORS preflight.
async function api(req, res, name) {
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (v) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(v)); return res }
  res.send = (v) => { res.end(v); return res }
  if (!LOCAL.test(req.headers.host || '')) return res.status(403).json({ error: 'Local only' })
  const file = new URL(`api/${name}.js`, ROOT)
  if (!existsSync(file)) return res.status(404).json({ error: 'Not found' })
  req.query = Object.fromEntries(new URL(req.url, 'http://x').searchParams)
  const raw = await readBody(req)
  if (raw === null) return res.status(413).json({ error: 'Too large' })
  if (raw && /application\/json/.test(req.headers['content-type'] || '')) {
    try { req.body = JSON.parse(raw) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }
  try {
    const { default: handler } = await import(file.href)
    await handler(req, res)
  } catch (err) {
    console.error(`[api/${name}]`, err)
    if (!res.headersSent) res.status(500).json({ error: 'Server error' })
  }
}

const server = createServer((req, res) => {
  const path = req.url.split('?')[0]
  if (!path.startsWith('/api/')) return void vite.middlewares(req, res)
  void api(req, res, path.match(ROUTE)?.[1] ?? '_') // not a route: 404, never Vite, which would serve the source file
})
const vite = await createVite({ root: ROOT.pathname, appType: 'spa', server: { middlewareMode: true, hmr: { server } } })

// Port first: it stops a second copy from opening the same database folder.
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is in use. Try: PORT=3001 npm run dev:local` : err)
  process.exit(1)
})
server.listen(PORT, '127.0.0.1', async () => {
  await import(shim)
  console.log(`\n  Desker is running: http://localhost:${PORT}\n  AI: this terminal's claude login. Database: .data/ (delete it to start clean). /dsb password: ${process.env.DSB_PASSWORD}\n`)
})
