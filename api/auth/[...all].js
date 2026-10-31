// Every /api/auth/* call (sign-up, sign-in, sign-out, session, password reset, verify email) goes to Better Auth.
// /api/auth/providers is ours: which social sign-in buttons the login screen shows (only providers whose keys are set).
import { auth, socialProviders } from '../_auth.js'

const handle = (req) => new URL(req.url).pathname === '/api/auth/providers' ? Response.json(socialProviders, { headers: { 'cache-control': 'public, max-age=300' } }) : auth.handler(req)
export { handle as GET, handle as POST }
