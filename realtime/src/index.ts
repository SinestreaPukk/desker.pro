// Cloudflare Worker + Durable Object: one VillageRoom per village. Checkpoint 3: hello -> welcome, joined/left, ping/pong. Movement etc. come later.
import { DurableObject } from 'cloudflare:workers'
import { applyMove, approaches, canSit, cleanBubble, newMover, parseMap, parseMentions, rateCheck, spawnFor, visibility, zoneAt, CHAT_LOG_TTL_HOURS, type Colour, type Dir, type Member, type Mover, type Party, type Role } from '@desker/shared'
import type { ServerMsg } from '@desker/shared'
import { checkHello, countBad, parseClient } from './logic.ts'
import campus from '../../apps/village/public/maps/snowy_campus.json'

const WORLD = parseMap(campus as never) // the same map file the client draws, so both sides agree on every wall
const MOVED_BATCH_MS = 50

export interface Env { ROOM: DurableObjectNamespace; VILLAGE_ROOM_SECRET: string; ALLOWED_ORIGINS?: string }
interface Att { vid: string; authed: boolean; bad: number; badAt: number; member?: Member; pos?: Mover; sat?: { spotId: string; from: { x: number; y: number } }; presence?: 'available' | 'focusing' | 'away'; says?: number[]; queue?: { fromUserId: string; name: string; text: string }[] }
const HELLO_TIMEOUT_MS = 10_000
const HOUR_MS = 3_600_000, LOG_TTL_MS = CHAT_LOG_TTL_HOURS * HOUR_MS, QUEUE_MAX = 3 // the queue lives in the socket attachment, which is capped at 2 KB
const ROOM_PATH = /^\/room\/([0-9a-f-]{36})$/

export default {
  fetch(req: Request, env: Env): Promise<Response> | Response {
    const vid = ROOM_PATH.exec(new URL(req.url).pathname)?.[1]
    if (!vid) return new Response('Not found', { status: 404 })
    if (req.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const origin = req.headers.get('origin')
    if (allowed.length && (!origin || !allowed.includes(origin))) return new Response('Forbidden', { status: 403 }) // browsers only; the token still decides who gets in
    return env.ROOM.get(env.ROOM.idFromName(vid)).fetch(req)
  },
}

export class VillageRoom extends DurableObject<Env> {
  private pending = new Map<string, { userId: string; x: number; y: number; dir: Dir; seq: number }>()
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // the last 24 h of bubbles, one row per person who was able to see each one (SPEC §6.3). Lives with the room: no database credentials on the edge.
    ctx.blockConcurrencyWhile(async () => { ctx.storage.sql.exec('create table if not exists chat (id integer primary key autoincrement, uid text not null, zone text not null, sid text not null, name text not null, text text not null, at integer not null)'); ctx.storage.sql.exec('create index if not exists chat_uid on chat (uid, at)') })
  }

  private async wake(inMs: number) { const cur = await this.ctx.storage.getAlarm(); if (!cur || cur > Date.now() + inMs) await this.ctx.storage.setAlarm(Date.now() + inMs) }
  private partyOf(att: Att): Party {
    const p = att.pos!, spot = att.sat ? WORLD.sitSpots.find((q) => q.id === att.sat!.spotId) : undefined
    return { x: p.x, y: p.y, zone: zoneAt(WORLD, p.x, p.y), table: spot?.table ?? null }
  }

  async fetch(req: Request): Promise<Response> {
    const vid = ROOM_PATH.exec(new URL(req.url).pathname)![1]
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ vid, authed: false, bad: 0, badAt: 0 } satisfies Att)
    await this.wake(HELLO_TIMEOUT_MS)
    return new Response(null, { status: 101, webSocket: client })
  }

  // Sockets that never said hello are closed (they cost memory and could be probing).
  async alarm() {
    for (const ws of this.ctx.getWebSockets()) if (!(ws.deserializeAttachment() as Att).authed) ws.close(4001, 'hello timeout')
    this.ctx.storage.sql.exec('delete from chat where at < ?', Date.now() - LOG_TTL_MS) // the daily purge: nothing older than 24 h is kept
    if (this.ctx.storage.sql.exec('select 1 from chat limit 1').toArray().length) await this.wake(HOUR_MS)
  }

  private send(ws: WebSocket, msg: ServerMsg) { try { ws.send(JSON.stringify(msg)) } catch { /* closing */ } }
  private authed() { return this.ctx.getWebSockets().map((ws) => ({ ws, att: ws.deserializeAttachment() as Att })).filter((x) => x.att.authed) }
  private broadcast(msg: ServerMsg, except?: WebSocket) { for (const { ws } of this.authed()) if (ws !== except) this.send(ws, msg) }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const att = ws.deserializeAttachment() as Att
    const msg = parseClient(raw)
    if (!msg) { // unknown or invalid: drop and log; repeated abuse disconnects
      console.warn('dropped invalid message', att.member?.userId ?? 'unauthenticated')
      const c = countBad(att)
      ws.serializeAttachment({ ...att, bad: c.bad, badAt: c.badAt })
      if (c.disconnect) ws.close(4008, 'too many invalid messages')
      return
    }
    if (!att.authed) {
      if (msg.t !== 'hello') return void ws.close(4001, 'hello first')
      const h = await checkHello(msg, att.vid, this.env.VILLAGE_ROOM_SECRET)
      if (!h.ok) { this.send(ws, { t: 'error', code: h.code, message: h.message }); return void ws.close(h.code === 'version' ? 4002 : 4003, h.code) }
      const me: Member = { userId: h.claims.sub, name: h.claims.n ?? 'Someone', colour: (h.claims.c ?? 'snow') as Colour, role: h.claims.role as Role }
      let pos: Mover | undefined, sat: Att['sat']
      for (const o of this.authed()) if (o.att.member?.userId === me.userId) { pos = o.att.pos; sat = o.att.sat; o.ws.close(4000, 'replaced') } // one connection per person: the newest wins, and keeps the old place
      const sp = spawnFor(WORLD, me.userId)
      // A member with a claimed desk arrives sitting at it (unless someone is already there), instead of at a spawn point.
      const desk = !pos && h.claims.d ? WORLD.sitSpots.find((q) => q.id === h.claims.d && q.kind === 'desk') : undefined
      const free = desk && !this.authed().some((o) => o.att.sat?.spotId === desk.id)
      const from = free ? approaches(WORLD, desk)[0] : undefined
      if (free && from) { pos = { ...newMover(desk.x, desk.y, Date.now(), desk.facing) }; sat = { spotId: desk.id, from } }
      ws.serializeAttachment({ ...att, authed: true, member: me, pos: pos ? { ...pos, tokens: 3, at: Date.now() } : newMover(sp.x, sp.y, Date.now()), sat, presence: this.authed().find((o) => o.att.member?.userId === me.userId)?.att.presence ?? 'available' })
      const all = this.authed()
      const members = [...new Map(all.map((x) => [x.att.member!.userId, x.att.member!])).values()]
      const positions = Object.fromEntries(all.map((x) => [x.att.member!.userId, { x: x.att.pos!.x, y: x.att.pos!.y, dir: x.att.pos!.dir }]))
      this.send(ws, { t: 'welcome', self: me, members, positions, presence: Object.fromEntries(all.map((x) => [x.att.member!.userId, x.att.presence ?? 'available'])), statuses: {}, desks: {}, sitting: Object.fromEntries(all.filter((x) => x.att.sat).map((x) => [x.att.member!.userId, x.att.sat!.spotId])), board: [], mapVersion: 1 })
      this.broadcast({ t: 'joined', member: me }, ws)
      return
    }
    if (msg.t === 'ping') return this.send(ws, { t: 'pong', ts: msg.ts })
    if (msg.t === 'log') {
      const rows = this.ctx.storage.sql.exec('select zone, sid, name, text, at from chat where uid = ? and at > ? order by at asc limit 200', att.member!.userId, Date.now() - LOG_TTL_MS).toArray()
      return this.send(ws, { t: 'log', items: rows.map((r) => ({ zoneId: r.zone as never, userId: String(r.sid), name: String(r.name), text: String(r.text), at: Number(r.at) })) })
    }
    if (msg.t === 'say') {
      const text = cleanBubble(msg.text), now = Date.now(); if (!text) return
      const rate = rateCheck(att.says ?? [], now)
      if (!rate.ok) return this.send(ws, { t: 'error', code: 'slow_down', message: 'Slow down a little' })
      ws.serializeAttachment({ ...att, says: rate.times })
      const me = att.member!, from = this.partyOf(att), room = this.authed()
      const mentioned = new Set(parseMentions(text, room.map((o) => o.att.member!.name)))
      for (const { ws: w, att: a } of room) {
        const self = a.member!.userId === me.userId, hit = !self && mentioned.has(a.member!.name)
        const v = self ? 'full' : visibility(from, this.partyOf(a), hit)
        if (v === 'full') {
          this.send(w, { t: 'said', userId: me.userId, text, zoneId: from.zone, ...(hit && { mentionsYou: true as const }) })
          this.ctx.storage.sql.exec('insert into chat (uid, zone, sid, name, text, at) values (?, ?, ?, ?, ?, ?)', a.member!.userId, from.zone, me.userId, me.name, text, now)
        } else if (v === 'hint') this.send(w, { t: 'said', userId: me.userId, nearbyOnly: true })
        else if (v === 'queued') w.serializeAttachment({ ...a, queue: [...(a.queue ?? []), { fromUserId: me.userId, name: me.name, text }].slice(-QUEUE_MAX) })
      }
      return void (await this.wake(HOUR_MS))
    }
    if (msg.t === 'presence') { // available / focusing / away; everyone sees it
      ws.serializeAttachment({ ...att, presence: msg.presence })
      return this.broadcast({ t: 'presenceChanged', userId: att.member!.userId, presence: msg.presence })
    }
    if (msg.t === 'claimDesk') { // the API has already recorded it (it is the authority across visits); the room only checks you are really sitting there
      const spot = att.sat && att.sat.spotId === msg.spotId ? WORLD.sitSpots.find((q) => q.id === msg.spotId) : undefined
      if (spot?.kind === 'desk') this.broadcast({ t: 'deskClaimed', userId: att.member!.userId, spotId: spot.id })
      return
    }
    if (msg.t === 'sit') { // next to a free spot, and not already sitting: the room seats you there
      const taken = new Set(this.authed().flatMap((x) => (x.att.sat ? [x.att.sat.spotId] : [])))
      const spot = att.sat ? null : canSit(WORLD, att.pos!.x, att.pos!.y, msg.spotId, taken)
      if (!spot) return this.send(ws, { t: 'correct', x: att.pos!.x, y: att.pos!.y }) // refused: here is where you really are
      ws.serializeAttachment({ ...att, sat: { spotId: spot.id, from: { x: att.pos!.x, y: att.pos!.y } }, pos: { ...att.pos!, x: spot.x, y: spot.y, dir: spot.facing } })
      return this.broadcast({ t: 'sat', userId: att.member!.userId, spotId: spot.id })
    }
    if (msg.t === 'stand') { // back to the tile you sat down from
      if (!att.sat) return
      const { from } = att.sat, pos = { ...att.pos!, x: from.x, y: from.y }
      ws.serializeAttachment({ ...att, sat: undefined, pos })
      this.broadcast({ t: 'stood', userId: att.member!.userId })
      this.send(ws, { t: 'correct', x: from.x, y: from.y }) // tells the stander exactly where they now are (a desk arrival has no remembered tile)
      this.pending.set(att.member!.userId, { userId: att.member!.userId, x: from.x, y: from.y, dir: pos.dir, seq: 0 })
      this.timer ??= setTimeout(() => this.flush(), MOVED_BATCH_MS)
      return
    }
    if (msg.t === 'move') {
      if (att.sat) return // sitting: stand first (the client always does) // validate loosely (SPEC §3.5): reachable within the walking budget, else tell the client where it really is
      const r = applyMove(WORLD, att.pos!, msg, Date.now())
      const leaving = r.ok && att.queue?.length && zoneAt(WORLD, att.pos!.x, att.pos!.y) === 'library' && zoneAt(WORLD, r.mover.x, r.mover.y) !== 'library'
      ws.serializeAttachment({ ...att, pos: r.mover, ...(leaving && { queue: [] }) })
      if (leaving) this.send(ws, { t: 'queued', items: att.queue!.map((q) => ({ kind: 'mention' as const, ...q })) }) // what you missed while studying (until Focus arrives in Checkpoint 8, leaving the Library ends it)
      if (!r.ok) return this.send(ws, { t: 'correct', x: r.mover.x, y: r.mover.y })
      this.pending.set(att.member!.userId, { userId: att.member!.userId, x: msg.x, y: msg.y, dir: msg.dir, seq: msg.seq })
      this.timer ??= setTimeout(() => this.flush(), MOVED_BATCH_MS)
    }
    // status, focus: Checkpoint 8
  }

  // `moved` goes out in one batch every 50 ms, to everyone except the mover (who predicts their own walking).
  private flush() {
    this.timer = null
    const moves = [...this.pending.values()]; this.pending.clear()
    for (const { ws, att } of this.authed()) {
      const others = moves.filter((m) => m.userId !== att.member!.userId)
      if (others.length) this.send(ws, { t: 'moved', moves: others })
    }
  }

  async webSocketClose(ws: WebSocket) {
    const me = (ws.deserializeAttachment() as Att | null)?.member
    if (me && !this.authed().some((x) => x.ws !== ws && x.att.member?.userId === me.userId)) this.broadcast({ t: 'left', userId: me.userId }, ws)
  }
  async webSocketError(ws: WebSocket) { await this.webSocketClose(ws) }
}
