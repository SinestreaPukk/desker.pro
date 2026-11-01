// Load test: N bots join one room, walk about and chat, and we report message rates, dropped messages and the local Worker's CPU and memory.
//   set -a; . realtime/.dev.vars; set +a; node scripts/loadtest.ts --clients 30 --minutes 3 [--url ws://localhost:8787]
// "Dropped" = a bot's move was corrected back (the room refused it), an error came back, or a socket closed. Target: none.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { signToken } from '../packages/shared/src/token.js'
import { parseMap, spawnFor, step } from '../packages/shared/src/world.ts'

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const clients = Number(arg('clients', '30')), minutes = Number(arg('minutes', '3')), base = arg('url', 'ws://localhost:8787')
const secret = process.env.VILLAGE_ROOM_SECRET; if (!secret) { console.error('VILLAGE_ROOM_SECRET missing (source realtime/.dev.vars)'); process.exit(1) }
const world = parseMap(JSON.parse(readFileSync(new URL('../apps/village/public/maps/snowy_campus.json', import.meta.url), 'utf8')))
const vid = crypto.randomUUID(), sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const stat = { sent: 0, recv: 0, welcome: 0, moved: 0, said: 0, corrected: 0, errors: 0, closed: 0, lag: [] as number[] }
const dirs = ['up', 'down', 'left', 'right'] as const

async function bot(i: number, until: number) {
  const sub = `load-${i}`, token = await signToken({ sub, vid, role: 'member', n: `Bot ${i}`, c: 'sky' }, secret, 3600)
  const ws = new WebSocket(`${base}/room/${vid}`, { headers: { origin: 'http://village.desker.test:5174' } } as never)
  let x = 0, y = 0, seq = 0, ready = false
  const send = (m: object) => { ws.send(JSON.stringify(m)); stat.sent++ }
  ws.onmessage = (e) => {
    stat.recv++; const m = JSON.parse(String(e.data))
    if (m.t === 'welcome') { stat.welcome++; ;({ x, y } = m.positions[sub] ?? spawnFor(world, sub)); ready = true }
    else if (m.t === 'moved') stat.moved += m.moves.length
    else if (m.t === 'said') stat.said++
    else if (m.t === 'correct') { stat.corrected++; x = m.x; y = m.y }
    else if (m.t === 'error') stat.errors++
    else if (m.t === 'pong') stat.lag.push(Date.now() - m.ts)
  }
  ws.onclose = () => { if (Date.now() < until) stat.closed++ }
  await new Promise<void>((r) => { ws.onopen = () => { send({ t: 'hello', v: 1, token }); r() } })
  while (!ready) await sleep(50)
  let nextSay = Date.now() + 5000 + Math.random() * 10000, nextPing = Date.now()
  while (Date.now() < until) {
    const d = dirs[Math.floor(Math.random() * 4)], n = step(world, x, y, d)
    if (n) { x = n.x; y = n.y; send({ t: 'move', x, y, dir: d, seq: ++seq }) }
    if (Date.now() > nextSay) { send({ t: 'say', text: `hello from bot ${i}` }); nextSay = Date.now() + 9000 + Math.random() * 8000 } // under the 5-per-10-s limit
    if (Date.now() > nextPing) { send({ t: 'ping', ts: Date.now() }); nextPing = Date.now() + 5000 }
    await sleep(155 + Math.random() * 60) // about a tile per 0.18 s, like walking
  }
  ws.close()
}

const pid = (() => { try { return execSync("lsof -ti tcp:8787 -sTCP:LISTEN | head -1").toString().trim() } catch { return '' } })()
const proc = () => { try { const [cpu, rss] = execSync(`ps -o %cpu=,rss= -p ${pid}`).toString().trim().split(/\s+/); return { cpu: Number(cpu), mb: Math.round(Number(rss) / 1024) } } catch { return null } }
console.log(`${clients} bots for ${minutes} min against ${base} (room ${vid})`)
const until = Date.now() + minutes * 60_000, samples: { cpu: number; mb: number }[] = []
const poll = setInterval(() => { const p = proc(); if (p) samples.push(p) }, 5000)
await Promise.all(Array.from({ length: clients }, (_, i) => sleep(i * 100).then(() => bot(i, until))))
clearInterval(poll)
const secs = minutes * 60, avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0), lag = stat.lag.sort((a, b) => a - b)
console.log(`bots joined: ${stat.welcome}/${clients}   sockets closed early: ${stat.closed}`)
console.log(`sent ${stat.sent} (${(stat.sent / secs).toFixed(0)}/s)   received ${stat.recv} (${(stat.recv / secs).toFixed(0)}/s)   moved entries ${stat.moved}   bubbles delivered ${stat.said}`)
console.log(`dropped: ${stat.corrected} corrected moves, ${stat.errors} errors   ping p50 ${lag[Math.floor(lag.length / 2)] ?? '-'} ms, p95 ${lag[Math.floor(lag.length * 0.95)] ?? '-'} ms`)
if (samples.length) console.log(`Worker (pid ${pid}): CPU avg ${avg(samples.map((s) => s.cpu)).toFixed(0)}% peak ${Math.max(...samples.map((s) => s.cpu))}%, memory peak ${Math.max(...samples.map((s) => s.mb))} MB`)
const bad = stat.corrected + stat.errors + stat.closed + (clients - stat.welcome)
console.log(bad ? `RESULT: ${bad} problems` : 'RESULT: no drops')
process.exit(bad ? 1 : 0)
