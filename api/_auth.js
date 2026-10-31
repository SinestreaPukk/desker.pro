// Accounts: Better Auth on the same Postgres as the app data. Passwords are scrypt-hashed (Better Auth default: per-user salt,
// N=16384, r=16, p=1) and checked against the Have I Been Pwned breach list; sessions are httpOnly cookies. Rate limits are counted in the `rateLimit` table.
// Rate limits come in layers: the edge (Vercel Firewall, see README), per IP per route (below), and per account/email (hooks below),
// so one IP spraying many accounts and many IPs hammering one account both get stopped.
// Without RESEND_API_KEY mails are printed to the server log and verification is not required (local dev); with it, sign-in needs a verified email.
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, createEmailVerificationToken, isAPIError } from 'better-auth/api'
import { haveIBeenPwned, username } from 'better-auth/plugins'
import { mailHtml, mailText } from './_mail.js'
import { Pool } from 'pg'

const mail = Boolean(process.env.RESEND_API_KEY)
const { GOOGLE_CLIENT_ID: gid, GOOGLE_CLIENT_SECRET: gsecret, GITHUB_CLIENT_ID: hid, GITHUB_CLIENT_SECRET: hsecret } = process.env
// A provider is on only when both its id and secret are set. The provider's verified email links it to an existing account with that email.
const SOCIAL = {
  ...(gid && gsecret && { google: { clientId: gid, clientSecret: gsecret } }),
  ...(hid && hsecret && { github: { clientId: hid, clientSecret: hsecret } }),
}
export const socialProviders = Object.keys(SOCIAL)

async function send(to, subject, content) {
  if (!mail) return void console.log(`\n[mail to ${to}] ${subject}\n${mailText(content)}\n`)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Desker <onboarding@resend.dev>', to, subject, html: mailHtml(content), text: mailText(content) }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new Error(`mail to ${to} failed: Resend ${r.status} ${await r.text().catch(() => '')}`)
}
const first = (user) => String(user.name || '').trim().split(/\s+/)[0] || 'there'
const welcome = (user, url) => send(user.email, 'Welcome to Desker: confirm your email', {
  title: `Welcome in, ${first(user)}!`,
  lines: ['Your desk is ready. One quick step before you start: confirm this is your email address, so we can keep your account safe and reach you if you ever lose your password.'],
  button: { label: 'Confirm my email', url }, note: 'The link works for one hour. If it runs out, just sign in and we will send a fresh one.',
})

// Per IP: 5 sign-in tries a minute, 5 sign-ups an hour, 3 reset / verification mails an hour. Everything else: 100 a minute.
const rule = (window, max) => ({ window, max })

// Per email, across all IPs (seconds, max). `fails`: only failed attempts count and a success clears them (credential stuffing);
// otherwise every request counts (mail bombing a victim's inbox). Hits live in `auth_hit`.
const BY_EMAIL = {
  '/sign-in/email': { window: 900, max: 10, fails: true },
  '/sign-in/username': { window: 900, max: 10, fails: true },
  '/sign-up/email': { window: 3600, max: 3 },
  '/request-password-reset': { window: 3600, max: 3 },
  '/send-verification-email': { window: 3600, max: 3 },
}
const hit = (key) => pool.query('insert into auth_hit (key) values ($1)', [key])
const keyOf = (ctx) => (BY_EMAIL[ctx.path] && typeof (ctx.body?.email ?? ctx.body?.username) === 'string' ? `${ctx.path}:${(ctx.body.email ?? ctx.body.username).trim().toLowerCase().slice(0, 254)}` : null)

const pool = new Pool({ connectionString: process.env.DATABASE_URL?.replace('sslmode=require', 'sslmode=verify-full'), max: 1 }) // same behaviour as 'require' in pg 8, without its warning

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
      sendDeleteAccountVerification: ({ user, url }) => send(user.email, 'Confirm deleting your Desker account', {
        title: 'Delete your account?',
        lines: [`Hi ${first(user)}, you asked to permanently delete your Desker account and everything in it: your tasks, goals and projects. This cannot be undone.`],
        button: { label: 'Yes, delete my account', url }, note: 'Did not ask for this? Ignore this email and change your password.',
      }),
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
    // Signing up again with an address that already exists answers the same as a new sign-up (no account probing), so the mail does the talking.
    onExistingUserSignUp: ({ user }) => user.emailVerified
      ? send(user.email, 'You already have a Desker account', {
        title: 'You already have an account',
        lines: [`Hi ${first(user)}, someone (hopefully you) tried to sign up to Desker with this email address, but it already has an account.`, 'Just sign in. If you forgot your password, use "Forgot password?" on the sign-in page.'],
        button: { label: 'Go to Desker', url: process.env.BETTER_AUTH_URL },
      })
      : createEmailVerificationToken(process.env.BETTER_AUTH_SECRET, user.email).then((t) => welcome(user, `${process.env.BETTER_AUTH_URL}/api/auth/verify-email?token=${t}&callbackURL=%2Ftoday`)),
    sendResetPassword: ({ user, url }) => send(user.email, 'Reset your Desker password', {
      title: 'Let\'s get you back in',
      lines: [`Hi ${first(user)}, someone asked to reset the password for your Desker account. Choose a new one with the button below.`],
      button: { label: 'Choose a new password', url }, note: 'The link works for one hour. Did not ask for this? Ignore this email and nothing changes.',
    }),
  },
  emailVerification: {
    sendOnSignUp: mail,
    sendOnSignIn: mail, // an unverified user who signs in gets a fresh link (covers a lost or failed first mail)
    autoSignInAfterVerification: true,
    sendVerificationEmail: ({ user, url }) => welcome(user, url),
  },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 }), haveIBeenPwned()], // usernames: letters, numbers, _ and . only
  rateLimit: {
    enabled: true, // on by default only in production
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': rule(60, 5),
      '/sign-in/username': rule(60, 5),
      '/is-username-available': rule(60, 20),
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
