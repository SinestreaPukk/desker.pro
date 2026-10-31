// Accounts: Better Auth on the same Postgres as the app data. Passwords are scrypt-hashed (Better Auth default: per-user salt,
// N=16384, r=16, p=1) and checked against the Have I Been Pwned breach list; sessions are httpOnly cookies. Rate limits are counted in the `rateLimit` table.
// Rate limits come in layers: the edge (Vercel Firewall, see README), per IP per route (below), and per account/email (hooks below),
// so one IP spraying many accounts and many IPs hammering one account both get stopped.
// Without RESEND_API_KEY mails are printed to the server log and verification is not required (local dev); with it, sign-in needs a verified email.
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api'
import { haveIBeenPwned } from 'better-auth/plugins'
import { Pool } from 'pg'

const mail = Boolean(process.env.RESEND_API_KEY)
const { GOOGLE_CLIENT_ID: gid, GOOGLE_CLIENT_SECRET: gsecret, GITHUB_CLIENT_ID: hid, GITHUB_CLIENT_SECRET: hsecret } = process.env
// A provider is on only when both its id and secret are set. The provider's verified email links it to an existing account with that email.
const SOCIAL = {
  ...(gid && gsecret && { google: { clientId: gid, clientSecret: gsecret } }),
  ...(hid && hsecret && { github: { clientId: hid, clientSecret: hsecret } }),
}
export const socialProviders = Object.keys(SOCIAL)

async function send(to, subject, text) {
  if (!mail) return void console.log(`\n[mail to ${to}] ${subject}\n${text}\n`)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Desker <onboarding@resend.dev>', to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new Error(`mail provider answered ${r.status}`)
}

// Per IP: 5 sign-in tries a minute, 5 sign-ups an hour, 3 reset / verification mails an hour. Everything else: 100 a minute.
const rule = (window, max) => ({ window, max })

// Per email, across all IPs (seconds, max). `fails`: only failed attempts count and a success clears them (credential stuffing);
// otherwise every request counts (mail bombing a victim's inbox). Hits live in `auth_hit`.
const BY_EMAIL = {
  '/sign-in/email': { window: 900, max: 10, fails: true },
  '/sign-up/email': { window: 3600, max: 3 },
  '/request-password-reset': { window: 3600, max: 3 },
  '/send-verification-email': { window: 3600, max: 3 },
}
const hit = (key) => pool.query('insert into auth_hit (key) values ($1)', [key])
const keyOf = (ctx) => (BY_EMAIL[ctx.path] && typeof ctx.body?.email === 'string' ? `${ctx.path}:${ctx.body.email.trim().toLowerCase().slice(0, 254)}` : null)

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,
  // The account id doubles as the API key, which expects a uuid. Vercel overwrites x-vercel-forwarded-for, so a client cannot spoof its IP to dodge the limits.
  advanced: { database: { generateId: () => crypto.randomUUID() }, ipAddress: { ipAddressHeaders: ['x-vercel-forwarded-for', 'x-forwarded-for'] } },
  socialProviders: SOCIAL,
  user: {
    deleteUser: {
      enabled: true, // confirmed by a mailed link, so it works for password and social accounts alike
      sendDeleteAccountVerification: ({ user, url }) => send(user.email, 'Confirm deleting your Desker account', `Open this link to permanently delete your account and all its data:\n${url}\n\nNot you? Ignore this email and change your password.`),
      afterDelete: (user) => pool.query('delete from users where id = $1', [user.id]).then(() => {}), // the app's rows (goals, tasks, ...) cascade from here
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const key = keyOf(ctx), r = BY_EMAIL[ctx.path]
      if (!key) return
      if (Math.random() < 0.01) await pool.query("delete from auth_hit where at < now() - interval '1 day'")
      const { rows: [{ n }] } = await pool.query("select count(*)::int n from auth_hit where key = $1 and at > now() - make_interval(secs => $2)", [key, r.window])
      if (n >= r.max) throw new APIError('TOO_MANY_REQUESTS', { message: 'Too many attempts for this account. Try again later.' })
      if (!r.fails) await hit(key)
    }),
    after: createAuthMiddleware(async (ctx) => {
      const key = keyOf(ctx)
      if (!key || !BY_EMAIL[ctx.path].fails) return
      if (ctx.context.newSession) await pool.query('delete from auth_hit where key = $1', [key])
      else if (isAPIError(ctx.context.returned)) await hit(key)
    }),
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: mail,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: ({ user, url }) => send(user.email, 'Reset your Desker password', `Open this link to choose a new password (valid for 1 hour):\n${url}\n\nNot you? Ignore this email.`),
  },
  emailVerification: {
    sendOnSignUp: mail,
    autoSignInAfterVerification: true,
    sendVerificationEmail: ({ user, url }) => send(user.email, 'Confirm your Desker email', `Welcome to Desker. Confirm your email:\n${url}`),
  },
  plugins: [haveIBeenPwned()],
  rateLimit: {
    enabled: true, // on by default only in production
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': rule(60, 5),
      '/sign-up/email': rule(3600, 5),
      '/request-password-reset': rule(3600, 3),
      '/reset-password': rule(3600, 10),
      '/send-verification-email': rule(3600, 3),
      '/sign-in/social': rule(60, 10),
      '/delete-user': rule(3600, 5),
    },
  },
})

// The signed-in user's id, or null. Handlers answer 401 on null.
export async function userOf(req) {
  const s = await auth.api.getSession({ headers: new Headers(req.headers) })
  return s?.user.id ?? null
}
