// Every /api/auth/* call (sign-up, sign-in, sign-out, session, password reset, verify email) goes to Better Auth.
import { auth } from '../_auth.js'

const handle = (req) => auth.handler(req)
export { handle as GET, handle as POST }
