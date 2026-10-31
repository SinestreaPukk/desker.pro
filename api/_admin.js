// Who may open the owner dashboard: a signed-in account with a verified email that is listed in ADMIN_EMAILS (comma separated).
// DSB_ADMIN_EMAIL, the single address used before, still counts so an existing setup keeps working.
export const adminEmails = (env = process.env) =>
  String(env.ADMIN_EMAILS || env.DSB_ADMIN_EMAIL || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

export const isAdmin = (user, env = process.env) => !!user?.emailVerified && !!user.email && adminEmails(env).includes(String(user.email).trim().toLowerCase())
