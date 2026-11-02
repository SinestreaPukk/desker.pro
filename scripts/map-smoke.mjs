// Live check of decorating (run the room with a stub API, never the real database):
//   npm run dev -w @desker/realtime -- --var VILLAGE_API_URL:http://localhost:3999     (in another terminal)
//   VILLAGE_ROOM_SECRET=<realtime/.dev.vars value> node scripts/map-smoke.mjs [ws://localhost:8787]
// This script plays the API: it keeps placements in memory and checks the room signs its calls.
import assert from 'node:assert/strict'
import http from 'node:http'
import { signToken, verifyToken } from '../packages/shared/src/token.js'

const URL_ = process.argv[2] ?? 'ws://localhost:8787', S = process.env.VILLAGE_ROOM_SECRET, vid = crypto.randomUUID()
const db = { version: 0, rows: new Map(), snaps: new Map(), writes: 0 }
const api = http.createServer(async (req, res) => {
  const t = await verifyToken((req.headers.authorization ?? '').replace(/^Bearer /, ''), S, vid)
  if (!t.ok || t.claims.role !== 'map') return res.writeHead(403).end('{}')
  const q = new URL(req.url, 'http://x').searchParams, json = (o, c = 200) => res.writeHead(c, { 'content-type': 'application/json' }).end(JSON.stringify(o))
  if (req.method === 'GET' && q.get('snapshots')) return json({ snapshots: [...db.snaps].map(([version, rows]) => ({ version, createdAt: new Date().toISOString(), items: rows.length })) })
  if (req.method === 'GET') return q.get('snapshot') ? json({ placements: db.snaps.get(Number(q.get('snapshot'))) ?? [] }) : json({ version: db.version, placements: [...db.rows.values()] })
  let body = ''; for await (const c of req) body += c
  const b = JSON.parse(body); if (b.ops.length ? b.version !== db.version + 1 : b.version !== db.version) return json({ error: 'version', version: db.version }, 409)
  for (const o of b.ops) o.k === 'del' ? db.rows.delete(o.id) : db.rows.set(o.p.id, o.p)
  if (b.ops.length) db.version = b.version
  if (b.snapshot || db.version % 50 === 0) db.snaps.set(db.version, [...db.rows.values()])
  db.writes++; json({ ok: true, version: db.version })
}).listen(3999)

const open = () => new Promise((res, rej) => { const ws = new WebSocket(`${URL_}/room/${vid}`, { headers: { origin: 'http://village.desker.test:5174' } }); ws.msgs = []; ws.addEventListener('message', (e) => ws.msgs.push(JSON.parse(e.data))); ws.addEventListener('open', () => res(ws)); ws.addEventListener('error', rej) })
const until = async (f, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { const x = f(); if (x) return x; await new Promise((r) => setTimeout(r, 20)) } throw new Error('timeout') }
const join = async (sub, role, bld) => { const ws = await open(); ws.send(JSON.stringify({ t: 'hello', v: 1, token: await signToken({ sub, vid, role, n: sub, c: 'moss', ...(bld && { bld: 1 }) }, S, 600) })); ws.welcome = await until(() => ws.msgs.find((m) => m.t === 'welcome')); return ws }
const edit = (ws, base, e) => ws.send(JSON.stringify({ t: 'map.edit', base, edit: e }))

const owner = await join('owner', 'owner', true), guest = await join('guest', 'guest', false)
assert.equal(owner.welcome.mapVersion, 0); assert.deepEqual(owner.welcome.placements, [])
// a free plaza tile: scan the real map for one the room accepts
edit(guest, 0, { t: 'place', decorId: 'paper_lantern', x: 12, y: 20, rotation: 0 })
assert.equal((await until(() => guest.msgs.find((m) => m.t === 'mapRefused'))).reason, 'permission'); console.log('ok: no build right, refused')
let placed
for (let x = 2; x < 38 && !placed; x++) { const n = owner.msgs.length; edit(owner, db.version, { t: 'place', decorId: 'paper_lantern', x, y: 22, rotation: 0 }); await new Promise((r) => setTimeout(r, 150)); placed = owner.msgs.slice(n).find((m) => m.t === 'mapPatch') }
assert.ok(placed, 'some tile on row 22 accepted a lantern'); assert.equal(placed.version, 1)
await until(() => guest.msgs.find((m) => m.t === 'mapPatch' && m.version === 1)); assert.equal(db.version, 1); assert.equal(db.rows.size, 1); console.log('ok: edit saved, version 1, everyone patched')
const p = placed.ops[0].p
edit(owner, 0, { t: 'place', decorId: 'plant_pot', x: p.x, y: p.y, rotation: 0 }); await until(() => owner.msgs.filter((m) => m.t === 'mapRefused').length >= 1); console.log('ok: same tile refused')
edit(owner, 1, { t: 'remove', placementId: p.id }); await until(() => owner.msgs.find((m) => m.t === 'mapPatch' && m.version === 2)); assert.equal(db.rows.size, 0); console.log('ok: remove saved')
const late = await join('late', 'member', true); assert.equal(late.welcome.mapVersion, 2); console.log('ok: a newcomer is welcomed at the current version')
guest.send(JSON.stringify({ t: 'map.restore', version: 1 })); await until(() => guest.msgs.filter((m) => m.t === 'mapRefused').length >= 2); console.log('ok: restore is owner-only')
owner.send(JSON.stringify({ t: 'map.snapshot' })); await until(() => db.snaps.has(2)); console.log('ok: owner snapshot saved')
edit(owner, 2, { t: 'place', decorId: 'paper_lantern', x: p.x, y: p.y, rotation: 0 }); await until(() => owner.msgs.find((m) => m.t === 'mapPatch' && m.version === 3))
owner.send(JSON.stringify({ t: 'map.restore', version: 2 })); await until(() => owner.msgs.find((m) => m.t === 'mapPatch' && m.version === 4)); assert.equal(db.rows.size, 0); console.log('ok: restore put the map back as version 4')
// CP3: build presence, sign text, snapshots list, reset, and no decorating while a timer runs
const send = (ws, m) => ws.send(JSON.stringify(m))
send(owner, { t: 'build', on: true, g: { decorId: 'paper_lantern', x: 5, y: 5, rotation: 0, ok: true } })
const seen = await until(() => late.msgs.find((m) => m.t === 'building' && m.userId === 'owner')); assert.equal(seen.on, true); assert.equal(seen.g.x, 5)
send(guest, { t: 'build', on: true }); await new Promise((r) => setTimeout(r, 150)); assert.ok(!late.msgs.some((m) => m.t === 'building' && m.userId === 'guest')); console.log('ok: builders are shown to friends; a guest cannot build')
const late2 = await join('late2', 'member', true); assert.deepEqual(late2.welcome.building, ['owner']); console.log('ok: a newcomer is told who is decorating')
const n0 = owner.msgs.length; edit(owner, db.version, { t: 'place', decorId: 'sign_wood', x: p.x, y: p.y, rotation: 0 }); const signOp = (await until(() => owner.msgs.slice(n0).find((m) => m.t === 'mapPatch'))).ops[0].p
edit(owner, db.version, { t: 'text', placementId: signOp.id, text: '  quiet please  ' }); await until(() => db.rows.get(signOp.id)?.text === 'quiet please'); console.log('ok: sign text saved, trimmed')
edit(owner, db.version, { t: 'text', placementId: signOp.id, text: 'x'.repeat(100) }); await until(() => db.rows.get(signOp.id)?.text?.length === 40); console.log('ok: sign text capped at 40')
send(owner, { t: 'map.snapshots' }); assert.ok((await until(() => owner.msgs.find((m) => m.t === 'snapshots'))).items.length >= 1); console.log('ok: snapshots listed')
send(owner, { t: 'focus.start', plannedMin: 25 }); await new Promise((r) => setTimeout(r, 150)); const r0 = owner.msgs.filter((m) => m.t === 'mapRefused').length
edit(owner, db.version, { t: 'remove', placementId: signOp.id }); await until(() => owner.msgs.filter((m) => m.t === 'mapRefused').length > r0); assert.equal(owner.msgs.filter((m) => m.t === 'mapRefused').at(-1).reason, 'focusing'); assert.ok(db.rows.has(signOp.id)); console.log('ok: no decorating while a timer runs')
send(owner, { t: 'focus.stop' }); await new Promise((r) => setTimeout(r, 150))
send(owner, { t: 'map.reset' }); await until(() => db.rows.size === 0); console.log('ok: reset to template removed everything')
console.log('all ok'); api.close(); for (const w of [owner, guest, late]) w.close(); process.exit(0)
