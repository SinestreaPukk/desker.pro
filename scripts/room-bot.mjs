// A pretend villager for testing: joins a village's room with a properly signed token and walks around the plaza.
//   set -a; . ./.env.local; set +a; node scripts/room-bot.mjs <villageId> [name] [colour] [ws://localhost:8787]
import { readFileSync } from 'node:fs'
import { signToken } from '../packages/shared/src/token.js'
import { parseMap, spawnFor, step } from '../packages/shared/src/world.ts'

const [vid, name = 'Bot Bea', colour = 'rose', base = 'ws://localhost:8787'] = process.argv.slice(2)
if (!vid) { console.error('usage: room-bot.mjs <villageId> [name] [colour]'); process.exit(1) }
const world = parseMap(JSON.parse(readFileSync(new URL('../apps/village/public/maps/snowy_campus.json', import.meta.url), 'utf8')))
const sub = `bot-${name.replace(/\W/g, '').toLowerCase()}`
const token = await signToken({ sub, vid, role: 'member', n: name, c: colour }, process.env.VILLAGE_ROOM_SECRET, 600)
const ws = new WebSocket(`${base}/room/${vid}`, { headers: { origin: 'http://village.desker.test:5174' } })
let seq = 0, x, y
function route(tx, ty) { // breadth-first path of directions from (x, y) to (tx, ty)
  const q = [[x, y, []]], seen = new Set([`${x},${y}`])
  while (q.length) { const [cx, cy, p] = q.shift(); if (cx === tx && cy === ty) return p
    for (const d of ['up', 'down', 'left', 'right']) { const n = step(world, cx, cy, d); if (n && !seen.has(`${n.x},${n.y}`)) { seen.add(`${n.x},${n.y}`); q.push([n.x, n.y, [...p, { d, ...n }]]) } } }
  return []
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: 1, token }))
ws.onmessage = async (e) => {
  const m = JSON.parse(e.data)
  if (m.t === 'error') return console.error('refused:', m.code)
  if (m.t === 'correct') { console.log('corrected to', m.x, m.y); ({ x, y } = m); return }
  if (m.t !== 'welcome') return
  ;({ x, y } = m.positions[sub] ?? spawnFor(world, sub)); console.log(`${name} joined at ${x},${y}`)
  const stops = [[19, 15], [24, 15], [24, 17], [17, 17], [17, 14], [19, 14]]
  for (;;) for (const [tx, ty] of stops) {
    for (const s of route(tx, ty)) { x = s.x; y = s.y; ws.send(JSON.stringify({ t: 'move', x, y, dir: s.d, seq: ++seq })); if (seq % 5 === 1) console.log('move', seq, x, y); await sleep(155) }
    await sleep(1500)
  }
}
ws.onclose = (e) => { console.log('closed', e.code); process.exit(0) }
process.on('SIGTERM', () => ws.close())
