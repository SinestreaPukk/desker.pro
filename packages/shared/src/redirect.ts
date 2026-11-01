/** A post-sign-in redirect target, or null. Only http(s) URLs on a *.desker.dev (or dev *.desker.test) host. */
export function safeRedirect(url: unknown): string | null {
  try {
    const u = new URL(String(url))
    const ok = /^https?:$/.test(u.protocol) && (u.hostname.endsWith('.desker.dev') || u.hostname.endsWith('.desker.test'))
    return ok ? u.href : null
  } catch { return null }
}
