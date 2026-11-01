// Every /api/auth/* call (sign-up, sign-in, sign-out, session, password reset, verify email) goes to Better Auth.
// /api/auth/providers is ours: which social sign-in buttons the login screen shows (only providers whose keys are set).
// Short aliases for scripts and other clients (vercel.json routes them here): the request is re-addressed to the Better Auth path,
// so every hook and rate limit applies exactly as for the app itself.
import { auth, socialProviders, villageOrigins } from '../_auth.js'

const ALIAS = { // name: [method, Better Auth path]
  signup: ['POST', '/sign-up/email'],
  login: ['POST', '/sign-in/email'], // {identifier, password}: an email, or a username
  logout: ['POST', '/sign-out'],
  me: ['GET', '/get-session'],
  'forgot-password': ['POST', '/request-password-reset'],
  'reset-password': ['POST', '/reset-password'],
  account: ['DELETE', '/delete-user'],
}

async function alias(req, [method, path]) {
  if (req.method !== method) return Response.json({ error: `Use ${method}` }, { status: 405, headers: { allow: method } })
  const url = new URL(req.url); let body
  if (method !== 'GET') {
    body = await req.json().catch(() => ({}))
    if (path === '/sign-in/email' && body.identifier != null) {
      const { identifier, ...rest } = body
      body = String(identifier).includes('@') ? { ...rest, email: identifier } : (path = '/sign-in/username', { ...rest, username: identifier })
    }
  }
  const headers = new Headers(req.headers); headers.set('content-type', 'application/json'); headers.delete('content-length')
  return auth.handler(new Request(`${url.origin}/api/auth${path}`, { method: method === 'DELETE' ? 'POST' : method, headers, body: body && JSON.stringify(body) }))
}

// The village (another origin on the same domain) calls these routes with the session cookie, so it needs CORS with credentials. Only listed origins.
const cors = (req, res) => {
  const origin = req.headers.get('origin')
  if (!origin || !villageOrigins.includes(origin)) return res
  const headers = new Headers(res.headers)
  headers.set('access-control-allow-origin', origin); headers.set('access-control-allow-credentials', 'true'); headers.append('vary', 'Origin')
  headers.set('access-control-allow-headers', 'content-type'); headers.set('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
  return new Response(req.method === 'OPTIONS' ? null : res.body, { status: req.method === 'OPTIONS' ? 204 : res.status, headers })
}

const handle = async (req) => cors(req, req.method === 'OPTIONS' ? new Response(null) : await route(req))
const route = (req) => {
  const name = new URL(req.url).pathname.replace(/^\/api\//, '')
  if (name === 'auth/providers') return Response.json(socialProviders, { headers: { 'cache-control': 'public, max-age=300' } })
  return ALIAS[name] ? alias(req, ALIAS[name]) : auth.handler(req)
}
export { handle as GET, handle as POST, handle as DELETE, handle as OPTIONS }
