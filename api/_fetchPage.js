// Fetches a public web page as plain text. Guards against SSRF: public http(s) only, default ports,
// every redirect hop re-checked. ponytail: DNS is resolved separately from the fetch, so a rebinding
// attacker could race it; pin the resolved IP with a custom agent if this endpoint ever handles sensitive networks.
import dns from 'node:dns/promises'
import net from 'node:net'

const BAD4 = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|2(2[4-9]|[3-5]\d)\.)/
const BAD6 = /^(::$|::1$|f[cd]|fe[89ab]|::ffff:)/i
const bad = (ip) => (net.isIPv4(ip) ? BAD4.test(ip) : BAD6.test(ip))

async function check(u) {
  if (!/^https?:$/.test(u.protocol) || u.port || u.username || u.password) throw new Error('Only plain public http(s) links are supported')
  const addrs = await dns.lookup(u.hostname, { all: true })
  if (!addrs.length || addrs.some((a) => bad(a.address))) throw new Error('That address is not allowed')
}

// Raw fetch with the same guards. `types` limits the accepted content-type; `max` caps the bytes read.
export async function fetchRaw(link, { types, max = 1_000_000, accept }) {
  let u
  try { u = new URL(link) } catch { throw new Error('That does not look like a valid link') }
  for (let hop = 0; hop < 4; hop++) {
    await check(u)
    const res = await fetch(u, {
      redirect: 'manual', signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'DeskerBot/1.0', accept },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { u = new URL(res.headers.get('location'), u); continue }
    if (!res.ok) throw new Error(`The link answered ${res.status}`)
    if (!types.test(res.headers.get('content-type') || '')) throw new Error('That link is not the kind of file we expected')
    const reader = res.body.getReader()
    const chunks = []
    let size = 0
    while (size < max) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value); size += value.length
    }
    reader.cancel().catch(() => {})
    return Buffer.concat(chunks).toString('utf8')
  }
  throw new Error('Too many redirects')
}

export async function fetchPage(link) {
  const html = await fetchRaw(link, { types: /^(text\/(html|plain)|application\/xhtml)/, accept: 'text/html,text/plain,application/xhtml+xml' })
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim().slice(0, 20_000)
}
