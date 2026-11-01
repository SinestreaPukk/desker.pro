// Realtime client: token -> WebSocket -> hello/welcome. Refreshes the token before it expires, reconnects with backoff, and a fresh `welcome`
// replaces local state. Every incoming message is validated with the shared zod schema; invalid ones are dropped and logged.
import { PROTOCOL_VERSION, TOKEN_REFRESH_MS, reconnectDelay, serverMsg, type ServerMsg } from '@desker/shared'

export type Status = 'connecting' | 'online' | 'reconnecting' | 'refresh' | 'elsewhere' | 'failed'
const URL_ = import.meta.env.VITE_REALTIME_URL ?? 'ws://localhost:8787'

async function fetchToken(villageId: string): Promise<string> {
  const r = await fetch('/api/village/token', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ villageId }) })
  if (!r.ok) throw new Error(`token ${r.status}`)
  return (await r.json()).token
}

export function connect(villageId: string, on: { message: (m: ServerMsg) => void; status: (s: Status) => void }) {
  let ws: WebSocket | null = null, stopped = false, attempt = 0, retry: ReturnType<typeof setTimeout>, refresh: ReturnType<typeof setTimeout>
  let token: Promise<string> | null = null
  const getToken = () => (token ??= fetchToken(villageId).catch((e) => { token = null; throw e }))
  const scheduleRefresh = () => { clearTimeout(refresh); refresh = setTimeout(() => { token = null; getToken().then(scheduleRefresh).catch(() => {}) }, TOKEN_REFRESH_MS) }

  async function open() {
    if (stopped) return
    try {
      const t = await getToken()
      if (stopped) return // closed while the token was loading: do not open a socket, it would kick the live one out ("replaced")
      scheduleRefresh()
      const sock = ws = new WebSocket(`${URL_}/room/${villageId}`)
      sock.onopen = () => sock.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token: t }))
      sock.onmessage = (e) => {
        let m: unknown; try { m = JSON.parse(e.data) } catch { return console.warn('village: dropped non-JSON message') }
        const p = serverMsg.safeParse(m)
        if (!p.success) return console.warn('village: dropped invalid message', p.error.issues[0]?.message)
        if (p.data.t === 'welcome') { attempt = 0; on.status('online') }
        on.message(p.data)
      }
      sock.onclose = (e) => {
        if (stopped || ws !== sock) return
        if (e.code === 4002) return on.status('refresh') // protocol version: the page is out of date
        if (e.code === 4000) return on.status('elsewhere') // opened in another tab
        if (e.code === 4003) token = null // token refused (expired?): get a fresh one on the next try
        on.status('reconnecting'); retry = setTimeout(open, reconnectDelay(attempt++))
      }
    } catch { token = null; if (attempt >= 5) return on.status('failed'); on.status('reconnecting'); retry = setTimeout(open, reconnectDelay(attempt++)) }
  }
  on.status('connecting'); open()
  return {
    send: (m: object) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m)),
    close: () => { stopped = true; clearTimeout(retry); clearTimeout(refresh); ws?.close() },
  }
}
