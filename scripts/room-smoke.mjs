// Live check of the room (run `npm run dev -w @desker/realtime` first): two members join, see each other, a bad token / old version / junk are refused.
//   VILLAGE_ROOM_SECRET=... node scripts/room-smoke.mjs [ws://localhost:8787]
import assert from 'node:assert/strict'
import { signToken } from '../packages/shared/src/token.js'

const URL_ = process.argv[2] ?? 'ws://localhost:8787', S = process.env.VILLAGE_ROOM_SECRET, vid = crypto.randomUUID()
const tok = (sub, n, v = vid, secret = S) => signToken({ sub, vid: v, role: 'member', n, c: 'moss' }, secret, 600)
const open = (v = vid) => new Promise((res, rej) => { const ws = new WebSocket(`${URL_}/room/${v}`, { headers: { origin: 'http://village.desker.test:5174' } }); ws.msgs = []; ws.closed = new Promise((r) => ws.addEventListener('close', (e) => r(e.code))); ws.addEventListener('message', (e) => ws.msgs.push(JSON.parse(e.data))); ws.addEventListener('open', () => res(ws)); ws.addEventListener('error', rej) })
const until = async (f, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { const x = f(); if (x) return x; await new Promise((r) => setTimeout(r, 20)) } throw new Error('timeout') }
const hello = (ws, token, v = 1) => ws.send(JSON.stringify({ t: 'hello', v, token }))

const a = await open(); hello(a, await tok('ann', 'Ann'))
const wa = await until(() => a.msgs.find((m) => m.t === 'welcome')); assert.deepEqual(wa.members.map((m) => m.name), ['Ann'])
const b = await open(); hello(b, await tok('bob', 'Bob'))
const wb = await until(() => b.msgs.find((m) => m.t === 'welcome')); assert.deepEqual(wb.members.map((m) => m.name).sort(), ['Ann', 'Bob'])
await until(() => a.msgs.find((m) => m.t === 'joined' && m.member.name === 'Bob')); console.log('ok: both see each other')
b.send(JSON.stringify({ t: 'ping', ts: 7 })); await until(() => b.msgs.find((m) => m.t === 'pong' && m.ts === 7)); console.log('ok: ping/pong')

const bad = await open(); hello(bad, await tok('eve', 'Eve', vid, 'another-secret-of-enough-length')); assert.equal(await bad.closed, 4003); console.log('ok: wrong signature refused')
const other = await open(); hello(other, await tok('eve', 'Eve', crypto.randomUUID())); assert.equal(await other.closed, 4003); console.log('ok: token for another village refused')
const old = await open(); hello(old, await tok('eve', 'Eve'), 2); await until(() => old.msgs.find((m) => m.t === 'error' && m.code === 'version' && /refresh/i.test(m.message))); assert.equal(await old.closed, 4002); console.log('ok: old protocol version told to refresh')
const quiet = await open(); quiet.send(JSON.stringify({ t: 'say', text: 'hi' })); assert.equal(await quiet.closed, 4001); console.log('ok: no talking before hello')
const spam = await open(); for (let i = 0; i < 12; i++) spam.send('garbage'); assert.equal(await spam.closed, 4008); console.log('ok: repeated junk disconnects')

const b2 = await open(); hello(b2, await tok('bob', 'Bob')); assert.equal(await b.closed, 4000); console.log('ok: second connection replaces the first')
assert.ok(!a.msgs.some((m) => m.t === 'left' && m.userId === 'bob'), 'replacing must not announce a leave')
b2.close(); await until(() => a.msgs.find((m) => m.t === 'left' && m.userId === 'bob')); console.log('ok: leaving is announced')
a.close(); console.log('ROOM OK'); process.exit(0)
