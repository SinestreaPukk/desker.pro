// Local dev only: serves a folder of Vercel-style functions from inside the Vite dev server, so `npm run dev:local` needs no `vercel dev`.
// Why: `vercel dev` merges the Vercel project's cloud environment OVER local env files, so a local session can silently run on the production
// database. This runner reads ONLY the repo's .env.local, so DATABASE_URL is exactly what you set there (e.g. a Neon branch).
// Handles both function styles used here: default (req, res) with req.query/req.body, and named GET/POST Web handlers (Request -> Response).
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'

/** Which file serves /api/a/b: api/a/b.js, api/a/b/index.js, else the nearest [...x].js up the tree. Exported for tests. */
export function resolveFn(apiDir, pathname) {
  const segs = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  for (const f of [join(apiDir, ...segs) + '.js', join(apiDir, ...segs, 'index.js')]) if (segs.length && existsSync(f)) return f
  for (let k = segs.length - 1; k >= 0; k--) {
    const dir = join(apiDir, ...segs.slice(0, k))
    const catchAll = existsSync(dir) && readdirSync(dir).find((f) => /^\[\.\.\..+\]\.js$/.test(f))
    if (catchAll) return join(dir, catchAll)
  }
  return null
}

const body = async (req) => { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c) }

/** @param {{ root: string, apiDir: string, rewrites?: [RegExp, string][] }} o  rewrites: [matches the URL path, "/api/x?y=1" to route to]; req.url stays the original */
export function devApi({ root, apiDir, rewrites = [] }) {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://x')
        if (!url.pathname.startsWith('/api/')) return next()
        try {
          Object.assign(process.env, loadEnv('development', root, '')) // .env.local wins over the shell; re-read per request so edits apply at once
          let route = url
          for (const [re, to] of rewrites) if (re.test(url.pathname)) { route = new URL(to, 'http://x'); for (const [k, v] of url.searchParams) route.searchParams.set(k, v); break }
          const file = resolveFn(apiDir, route.pathname)
          if (!file) return res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"Not found"}')
          const mod = await import(/* @vite-ignore */ pathToFileURL(file).href + `?t=${Date.now()}`) // fresh import: edits apply without a restart
          const raw = await body(req)
          if (mod.default) { // Node style
            req.query = Object.fromEntries(route.searchParams)
            try { req.body = raw.length ? JSON.parse(raw.toString()) : undefined } catch { req.body = raw.toString() }
            res.status = (n) => { res.statusCode = n; return res }
            res.json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); return res }
            return await mod.default(req, res)
          }
          const handler = mod[req.method] // Web style
          if (!handler) return res.writeHead(405).end()
          const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, [].concat(v).join(', '))
          const r = await handler(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw }))
          const out = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v })
          const cookies = r.headers.getSetCookie?.() ?? []
          res.writeHead(r.status, cookies.length ? { ...out, 'set-cookie': cookies } : out).end(Buffer.from(await r.arrayBuffer()))
        } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' }); res.end('{"error":"Server error"}') }
      })
    },
  }
}
