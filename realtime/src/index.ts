// Cloudflare Worker + Durable Object: one VillageRoom per village. Checkpoint 3: hello -> welcome, joined/left, ping/pong. Movement etc. come later.
import { DurableObject } from 'cloudflare:workers'
import { can, emoteVisible, knockResult, EMOTE_RATE_LIMIT, applyMove, approaches, canSit, cleanBubble, maskStatus, newMover, parseMap, parseMentions, rateCheck, spawnFor, visibility, zoneAt, CHAT_LOG_TTL_HOURS, slowCheck, strike, muteLeftMin, type Colour, type Dir, type Member, type Mover, type Party, type Role, type Status, type StatusSharing } from '@desker/shared'
import { SIGN_MAX_CHARS } from '@desker/shared'
import { apply as applyOps, checkEdit, newState, restoreOps, REFUSAL_TEXT, type MapState, type MapOp, type Placement } from '@desker/shared'
import type { ServerMsg } from '@desker/shared'
import { checkHello, countBad, parseClient } from './logic.ts'
import { verifyToken, signToken } from '@desker/shared/src/token.js'
import campus from '../../apps/village/public/maps/snowy_campus.json'

const BASE = parseMap(campus as never) // the same map file the client draws, so both sides agree on every wall; decorations are layered on top of it per village
const MOVED_BATCH_MS = 50

export interface Env { ROOM: DurableObjectNamespace; VILLAGE_ROOM_SECRET: string; ALLOWED_ORIGINS?: string; VILLAGE_API_URL?: string }
interface Att { vid: string; authed: boolean; build?: boolean; building?: boolean; bad: number; badAt: number; member?: Member; pos?: Mover; sat?: { spotId: string; from: { x: number; y: number } }; presence?: 'available' | 'focusing' | 'away' | 'dnd'; share?: StatusSharing; status?: Status; focus?: { startedAt: number; endsAt: number; pausedAt?: number }; says?: number[]; sm?: boolean; lastSay?: number; strikes?: number[]; muteUntil?: number; emo?: number[]; queue?: { fromUserId: string; name: string; text: string; k?: 'knock' | 'answer' }[] }
const HELLO_TIMEOUT_MS = 10_000
const HOUR_MS = 3_600_000, LOG_TTL_MS = CHAT_LOG_TTL_HOURS * HOUR_MS, QUEUE_MAX = 3 // the queue lives in the socket attachment, which is capped at 2 KB
const ROOM_PATH = /^\/room\/([0-9a-f-]{36})$/

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    // The API tells the room about kicks, bans, role changes and closed villages (signed with the room secret, role 'revoke'), so they take effect now, not when the 10-minute token runs out.
    const rv = /^\/room\/([0-9a-f-]{36})\/revoke$/.exec(url.pathname)
    if (rv && req.method === 'POST') {
      const t = await verifyToken((req.headers.get('authorization') ?? '').replace(/^Bearer /, ''), env.VILLAGE_ROOM_SECRET, rv[1])
      if (!t.ok || t.claims.role !== 'revoke') return new Response('Forbidden', { status: 403 })
      return env.ROOM.get(env.ROOM.idFromName(rv[1])).fetch(new Request(`https://room/revoke?uid=${encodeURIComponent(t.claims.sub)}&op=${t.claims.op === 'refresh' ? 'refresh' : 'remove'}`, { method: 'POST' }))
    }
    // The API also tells the room about questions and answers (same signature, role 'notify'); the body says what happened.
    const nv = /^\/room\/([0-9a-f-]{36})\/notify$/.exec(url.pathname)
    if (nv && req.method === 'POST') {
      const t = await verifyToken((req.headers.get('authorization') ?? '').replace(/^Bearer /, ''), env.VILLAGE_ROOM_SECRET, nv[1])
      if (!t.ok || t.claims.role !== 'notify') return new Response('Forbidden', { status: 403 })
      return env.ROOM.get(env.ROOM.idFromName(nv[1])).fetch(new Request('https://room/notify', { method: 'POST', body: await req.text() }))
    }
    const vid = ROOM_PATH.exec(url.pathname)?.[1]
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
  private map: MapState = newState(BASE) // the template plus this village's placements; replaced (never edited) on every change
  private mapOk = false; private mapTriedAt = 0 // loaded from the database yet? when we last tried
  private edits: Promise<unknown> = Promise.resolve() // edits run one at a time, so the version order is the order they arrived
  private get world() { return this.map.world }
  private knocks = new Map<string, number>() // 'from>to' -> last knock time. ponytail: lives in memory, so a room restart forgets it (a knock may slip through early); persist it if that ever matters

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // the last 24 h of bubbles, one row per person who was able to see each one (SPEC §6.3). Lives with the room: no database credentials on the edge.
    ctx.blockConcurrencyWhile(async () => { ctx.storage.sql.exec('create table if not exists chat (id integer primary key autoincrement, uid text not null, zone text not null, sid text not null, name text not null, text text not null, at integer not null)'); ctx.storage.sql.exec('create index if not exists chat_uid on chat (uid, at)'); ctx.storage.sql.exec('create table if not exists blocks (blocker text not null, blocked text not null, primary key (blocker, blocked))') })
  }

  private async wake(inMs: number) { const cur = await this.ctx.storage.getAlarm(); if (!cur || cur > Date.now() + inMs) await this.ctx.storage.setAlarm(Date.now() + inMs) }
  private partyOf(att: Att): Party {
    const p = att.pos!, spot = att.sat ? this.world.sitSpots.find((q) => q.id === att.sat!.spotId) : undefined
    return { x: p.x, y: p.y, zone: zoneAt(this.world, p.x, p.y), table: spot?.table ?? null, focus: !!att.focus }
  }
  /** Has `by` blocked `who`? Blocks live in the room's SQLite (filled from the token on connect, kept current by the API). A blocked person is never told. */
  private blocked(by: string, who: string) { return this.ctx.storage.sql.exec('select 1 from blocks where blocker = ? and blocked = ?', by, who).toArray().length > 0 }
  private setBlocks(uid: string, ids: string[]) { const q = this.ctx.storage.sql; q.exec('delete from blocks where blocker = ?', uid); for (const id of ids.slice(0, 20)) q.exec('insert or ignore into blocks values (?, ?)', uid, id) }
  private shown(att: Att) { return att.status ? maskStatus(att.status, att.share ?? 'basic') : null } // what friends may see of this member's status
  // Queued @mentions are handed over when the member is no longer studying: out of the Library and no timer running.
  private release(ws: WebSocket, att: Att) {
    if (!att.queue?.length || att.presence === 'dnd') return att // in Do Not Disturb everything is held until it ends
    this.send(ws, { t: 'queued', items: att.queue.map(({ k, ...q }) => ({ kind: k ?? ('mention' as const), ...q })) })
    const next = { ...att, queue: [] }; ws.serializeAttachment(next); return next
  }


  // ---- the map (Phase 2): the database remembers, the room decides ------------------------------------------------
  private async api(vid: string, init?: { body: object }, query = '') {
    const t = await signToken({ sub: 'room', vid, role: 'map' }, this.env.VILLAGE_ROOM_SECRET, 60)
    return fetch(`${this.env.VILLAGE_API_URL}/api/village/room/${vid}${query}`, { method: init ? 'POST' : 'GET', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: init && JSON.stringify(init.body) })
  }
  /** Load the placements once per room lifetime. If the API cannot be reached the village still works on the bare template (editing is refused), and we try again at most every 10 s. */
  private async ensureMap(vid: string) {
    if (this.mapOk) return true
    if (!this.env.VILLAGE_API_URL || Date.now() - this.mapTriedAt < 10_000) return false
    this.mapTriedAt = Date.now()
    try {
      const r = await this.api(vid); if (!r.ok) return false
      const j = await r.json() as { version: number; placements: Placement[] }
      this.map = newState(BASE, j.placements, j.version); this.mapOk = true
      return true
    } catch { return false }
  }
  private async persist(vid: string, version: number, ops: MapOp[], actor: string, snapshot = false) {
    try {
      const r = await this.api(vid, { body: { version, ops, actor, snapshot } })
      if (r.status === 409) this.mapOk = false // the database is ahead of us: reload before the next edit
      return r.ok
    } catch { return false }
  }
  private refuse(ws: WebSocket, reason: string) { this.send(ws, { t: 'mapRefused', reason, version: this.map.version }) }
  /** Commit ops as the next version: save, then change the room, then tell everyone. Anyone seated on something that just went is stood up. */
  private async commit(ws: WebSocket, vid: string, ops: MapOp[], actor: string, snapshot = false) {
    const next = this.map.version + 1
    if (!(await this.persist(vid, next, ops, actor, snapshot))) return void this.refuse(ws, 'save_failed')
    this.map = applyOps(this.map, ops, next)
    this.broadcast({ t: 'mapPatch', version: next, ops })
    const ids = new Set(this.world.sitSpots.map((q) => q.id))
    for (const { ws: w, att } of this.authed()) if (att.sat?.spotId.startsWith('d:') && !ids.has(att.sat.spotId)) { // ponytail: stands them at the tile they sat down from; if decor now covers it the next move is corrected
      const { from } = att.sat
      w.serializeAttachment({ ...att, sat: undefined, pos: { ...att.pos!, x: from.x, y: from.y } })
      this.broadcast({ t: 'stood', userId: att.member!.userId }); this.send(w, { t: 'correct', x: from.x, y: from.y })
    }
  }
  private mapMessage(ws: WebSocket, att: Att, msg: Extract<import('@desker/shared').ClientMsg, { t: 'map.edit' | 'map.restore' | 'map.snapshot' | 'map.snapshots' | 'map.reset' }>) {
    const run = async () => {
      const me = att.member!, W = this.map.base.w
      if (!(await this.ensureMap(att.vid))) return this.refuse(ws, 'unavailable')
      if (msg.t === 'map.edit') {
        if (att.focus) return this.refuse(ws, 'focusing') // studying is protected: no decorating while a timer runs
        let edit = msg.edit
        if (edit.t === 'text') { // sign text is filtered like a bubble; text that is only filtered words is refused
          const text = cleanBubble(edit.text).slice(0, SIGN_MAX_CHARS)
          if (edit.text.trim() && !text) return this.refuse(ws, 'text')
          edit = { ...edit, text }
        }
        const standing = new Set(this.authed().flatMap((x) => (x.att.pos ? [Math.round(x.att.pos.y) * W + Math.round(x.att.pos.x)] : [])))
        const r = checkEdit(this.map, edit, { id: me.userId, canBuild: !!att.build }, msg.base, { occupied: (t) => standing.has(t) })
        return r.ok ? this.commit(ws, att.vid, r.ops, me.userId) : this.refuse(ws, r.reason)
      }
      if (me.role !== 'owner') return this.refuse(ws, 'permission')
      if (msg.t === 'map.snapshots') {
        try { const r = await this.api(att.vid, undefined, '?snapshots=1'); if (!r.ok) return this.refuse(ws, 'unavailable'); this.send(ws, { t: 'snapshots', items: ((await r.json()) as { snapshots: { version: number; createdAt: string; items: number }[] }).snapshots.map((x) => ({ version: x.version, at: x.createdAt, items: x.items })) }) } catch { this.refuse(ws, 'unavailable') }
        return
      }
      if (msg.t === 'map.reset') { const ops = restoreOps(this.map, []); if (ops.length) await this.commit(ws, att.vid, ops, me.userId); return }
      if (msg.t === 'map.snapshot') { if (!(await this.persist(att.vid, this.map.version, [], me.userId, true))) this.refuse(ws, 'save_failed'); return }
      try { // restore: today's placements become the snapshot's, as one new version (so it can be undone)
        const r = await this.api(att.vid, undefined, `?snapshot=${msg.version}`); if (!r.ok) return this.refuse(ws, 'gone')
        const ops = restoreOps(this.map, (await r.json() as { placements: Placement[] }).placements)
        if (ops.length) await this.commit(ws, att.vid, ops, me.userId)
      } catch { this.refuse(ws, 'save_failed') }
    }
    return (this.edits = this.edits.then(run, run).catch(() => {}))
  }

  async fetch(req: Request): Promise<Response> {
    if (req.method === 'POST' && new URL(req.url).pathname === '/notify') return this.notify(await req.json().catch(() => null) as never)
    if (req.method === 'POST') { // revoke (the Worker already checked the signature): close that person's connections; 4004 = gone for good, 4005 = reconnect with a fresh token
      const q = new URL(req.url).searchParams
      for (const { ws, att } of this.authed()) if (q.get('uid') === '*' || att.member?.userId === q.get('uid')) ws.close(q.get('op') === 'refresh' ? 4005 : 4004, 'revoked')
      return new Response('ok')
    }
    const vid = ROOM_PATH.exec(new URL(req.url).pathname)![1]
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ vid, authed: false, bad: 0, badAt: 0 } satisfies Att)
    await this.wake(HELLO_TIMEOUT_MS)
    return new Response(null, { status: 101, webSocket: client })
  }

  /** A question was asked or answered (the API stored it). Bubbles follow the usual reach; the asker hears about answers by their state: now, after Focus, or on the "while you were away" card. */
  private notify(b: { kind?: string; qid?: string; userId?: string; name?: string; text?: string; by?: string; ids?: string[] } | null) {
    if (b?.kind === 'blocks' && typeof b.userId === 'string' && Array.isArray(b.ids)) { this.setBlocks(b.userId, b.ids.filter((x) => typeof x === 'string')); return Response.json({ ok: true }) }
    if (!b || typeof b.qid !== 'string' || typeof b.userId !== 'string') return new Response('bad', { status: 400 })
    const room = this.authed(), asker = room.find((x) => x.att.member!.userId === b.userId)
    if (b.kind === 'asked' && asker) {
      const from = this.partyOf(asker.att), text = String(b.text ?? '').slice(0, 200)
      for (const { ws, att } of room) {
        const v = att.member!.userId === b.userId ? 'full' : att.presence === 'dnd' ? 'none' : visibility(from, this.partyOf(att), false)
        if (v === 'full') this.send(ws, { t: 'asked', qid: b.qid, userId: b.userId, text })
        else if (v === 'hint') this.send(ws, { t: 'asked', qid: b.qid, userId: b.userId, nearbyOnly: true })
        else this.send(ws, { t: 'qupdate', qid: b.qid }) // too far or quiet: no bubble, but an open Board refreshes
      }
    } else if (b.kind === 'answered') {
      const by = String(b.name ?? 'Someone').slice(0, 60)
      for (const { ws, att } of room) {
        if (att.member!.userId !== b.userId) { this.send(ws, { t: 'qupdate', qid: b.qid }); continue } // userId is the asker; by is who answered
        const quiet = att.presence === 'dnd' || att.presence === 'focusing' || !!att.focus
        if (!quiet) this.send(ws, { t: 'answered', qid: b.qid, byUserId: String(b.by ?? ''), name: by })
        else ws.serializeAttachment({ ...att, queue: [...(att.queue ?? []), { fromUserId: String(b.by ?? ''), name: by, text: 'answered your question', k: 'answer' as const }].slice(-QUEUE_MAX) })
      }
    } else if (b.kind === 'update') for (const { ws } of room) this.send(ws, { t: 'qupdate', qid: b.qid })
    return Response.json({ online: [...new Set(room.map((x) => x.att.member!.userId))] }) // who is here, so the API pushes only to people who are not
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
      let pos: Mover | undefined, sat: Att['sat'], old: Att | undefined
      for (const o of this.authed()) if (o.att.member?.userId === me.userId) { pos = o.att.pos; sat = o.att.sat; old = o.att; o.ws.close(4000, 'replaced') } // one connection per person: the newest wins, and keeps the old place
      await this.ensureMap(att.vid)
      const sp = spawnFor(this.world, me.userId)
      // A member with a claimed desk arrives sitting at it (unless someone is already there), instead of at a spawn point.
      const desk = !pos && h.claims.d ? this.world.sitSpots.find((q) => q.id === h.claims.d && q.kind === 'desk') : undefined
      const free = desk && !this.authed().some((o) => o.att.sat?.spotId === desk.id)
      const from = free ? approaches(this.world, desk)[0] : undefined
      if (free && from) { pos = { ...newMover(desk.x, desk.y, Date.now(), desk.facing) }; sat = { spotId: desk.id, from } }
      this.setBlocks(me.userId, Array.isArray(h.claims.bl) ? h.claims.bl : [])
      ws.serializeAttachment({ ...att, authed: true, build: !!h.claims.bld, sm: !!h.claims.sm, lastSay: old?.lastSay, strikes: old?.strikes, muteUntil: old?.muteUntil, member: me, pos: pos ? { ...pos, tokens: 3, at: Date.now() } : newMover(sp.x, sp.y, Date.now()), sat, presence: old?.presence ?? 'available', focus: old?.focus, status: old?.status, share: (['full', 'basic', 'off'] as const).find((x) => x === h.claims.s) ?? 'basic' })
      const all = this.authed()
      const members = [...new Map(all.map((x) => [x.att.member!.userId, x.att.member!])).values()]
      const positions = Object.fromEntries(all.map((x) => [x.att.member!.userId, { x: x.att.pos!.x, y: x.att.pos!.y, dir: x.att.pos!.dir }]))
      this.send(ws, { t: 'welcome', self: me, members, positions, presence: Object.fromEntries(all.map((x) => [x.att.member!.userId, x.att.presence ?? 'available'])), statuses: Object.fromEntries(all.flatMap((x) => { const s = this.shown(x.att); return s ? [[x.att.member!.userId, s]] : [] })), focus: Object.fromEntries(all.flatMap((x) => (x.att.focus ? [[x.att.member!.userId, x.att.focus]] : []))), desks: {}, sitting: Object.fromEntries(all.filter((x) => x.att.sat).map((x) => [x.att.member!.userId, x.att.sat!.spotId])), board: [], mapVersion: this.map.version, placements: [...this.map.placements.values()], building: all.filter((x) => x.att.building).map((x) => x.att.member!.userId) })
      this.broadcast({ t: 'joined', member: me }, ws)
      return
    }
    if (msg.t === 'ping') return this.send(ws, { t: 'pong', ts: msg.ts })
    if (msg.t === 'map.edit' || msg.t === 'map.restore' || msg.t === 'map.snapshot' || msg.t === 'map.snapshots' || msg.t === 'map.reset') return this.mapMessage(ws, att, msg)
    if (msg.t === 'build') { // build mode on/off and my ghost, shown to everyone so friends see what each other are doing
      if (!att.build) return
      if (!!att.building !== msg.on) ws.serializeAttachment({ ...att, building: msg.on })
      return this.broadcast({ t: 'building', userId: att.member!.userId, on: msg.on, g: msg.on ? msg.g ?? null : null }, ws)
    }
    if (!this.mapOk) await this.ensureMap(att.vid) // a room that woke from hibernation reloads the decorations before judging moves
    if (msg.t === 'log') {
      const rows = this.ctx.storage.sql.exec('select zone, sid, name, text, at from chat where uid = ? and at > ? order by at asc limit 200', att.member!.userId, Date.now() - LOG_TTL_MS).toArray()
      return this.send(ws, { t: 'log', items: rows.map((r) => ({ zoneId: r.zone as never, userId: String(r.sid), name: String(r.name), text: String(r.text), at: Number(r.at) })) })
    }
    if (msg.t === 'mod.remove') { // an admin removes one bubble from every log
      if (!can(att.member!.role, 'moderate')) return
      this.ctx.storage.sql.exec('delete from chat where sid = ? and at = ?', msg.userId, msg.at)
      return void this.send(ws, { t: 'error', code: 'removed', message: 'Removed.' })
    }
    if (msg.t === 'say') {
      const text = cleanBubble(msg.text), now = Date.now(); if (!text) return
      const left = muteLeftMin(att.muteUntil, now)
      if (left > 0) return this.send(ws, { t: 'error', code: 'muted', message: `You are muted for ${left} more minute${left === 1 ? '' : 's'}.` })
      const slow = slowCheck(att.lastSay, now, !!att.sm)
      if (!slow.ok) return this.send(ws, { t: 'error', code: 'slow_mode', message: `Slow mode is on. Try again in ${Math.ceil(slow.waitMs / 1000)} s.` })
      const rate = rateCheck(att.says ?? [], now)
      if (!rate.ok) { // hitting the limit is a strike; five in a minute is a 10-minute mute (not audited: the room has no database)
        const s = strike(att.strikes ?? [], now)
        ws.serializeAttachment({ ...att, strikes: s.strikes, muteUntil: s.muteUntil ?? att.muteUntil })
        return this.send(ws, s.muteUntil ? { t: 'error', code: 'muted', message: 'You are muted for 10 minutes.' } : { t: 'error', code: 'slow_down', message: 'Slow down a little' })
      }
      const next: Att = { ...att, says: rate.times, lastSay: now }
      ws.serializeAttachment(next)
      const me = att.member!, from = this.partyOf(att), room = this.authed()
      const mentioned = new Set(parseMentions(text, room.map((o) => o.att.member!.name)))
      for (const { ws: w, att: a } of room) {
        const self = a.member!.userId === me.userId, hit = !self && mentioned.has(a.member!.name)
        if (!self && this.blocked(a.member!.userId, me.userId)) continue // they blocked me: nothing reaches them, and I am not told
        const v = self ? 'full' : a.presence === 'dnd' ? (hit ? 'queued' : 'none') : visibility(from, this.partyOf(a), hit) // Do Not Disturb: nothing is delivered, mentions are kept for the "while you were away" card
        if (v === 'full') {
          this.send(w, { t: 'said', userId: me.userId, text, zoneId: from.zone, ...(hit && { mentionsYou: true as const }) })
          this.ctx.storage.sql.exec('insert into chat (uid, zone, sid, name, text, at) values (?, ?, ?, ?, ?, ?)', a.member!.userId, from.zone, me.userId, me.name, text, now)
        } else if (v === 'hint') this.send(w, { t: 'said', userId: me.userId, nearbyOnly: true })
        else if (v === 'queued') w.serializeAttachment({ ...a, queue: [...(a.queue ?? []), { fromUserId: me.userId, name: me.name, text }].slice(-QUEUE_MAX) })
      }
      return void (await this.wake(HOUR_MS))
    }
    if (msg.t === 'presence') { // available / focusing / away / dnd; everyone sees it
      const me = att.member!.userId
      if (att.presence === 'dnd') { // only leaving Do Not Disturb is allowed from inside it
        if (msg.presence !== 'available') return
        const next = { ...att, presence: att.focus ? 'focusing' as const : 'available' as const, queue: [] }
        ws.serializeAttachment(next)
        this.broadcast({ t: 'presenceChanged', userId: me, presence: next.presence })
        if (att.queue?.length) this.send(ws, { t: 'away', items: att.queue.map(({ k, ...q }) => ({ kind: k ?? ('mention' as const), ...q })) })
        return
      }
      if (att.focus && msg.presence !== 'focusing' && msg.presence !== 'dnd') return // a running timer is Focusing; stop the timer first
      ws.serializeAttachment({ ...att, presence: msg.presence })
      this.broadcast({ t: 'presenceChanged', userId: me, presence: msg.presence })
      if (msg.presence === 'available' && !att.focus && zoneAt(this.world, att.pos!.x, att.pos!.y) !== 'library') this.release(ws, { ...att, presence: 'available' })
      return
    }
    if (msg.t === 'status') { // what I am working on; friends get it masked by my sharing choice (SPEC §6.2)
      ws.serializeAttachment({ ...att, status: msg.status })
      return this.broadcast({ t: 'statusChanged', userId: att.member!.userId, status: this.shown({ ...att, status: msg.status }) })
    }
    if (msg.t === 'focus.start') { // the API holds the lasting record; the room just shows the ring and goes quiet for this member
      const now = Date.now(), focus = { startedAt: now, endsAt: now + msg.plannedMin * 60_000 }, me = att.member!.userId
      ws.serializeAttachment({ ...att, focus, presence: att.presence === 'dnd' ? 'dnd' : 'focusing' })
      if (att.presence !== 'dnd') this.broadcast({ t: 'presenceChanged', userId: me, presence: 'focusing' })
      return this.broadcast({ t: 'focusChanged', userId: me, endsAt: focus.endsAt, startedAt: focus.startedAt })
    }
    if (msg.t === 'focus.pause' || msg.t === 'focus.resume') { // a paused timer keeps its ring frozen; resuming pushes both ends forward by the pause
      const f = att.focus, now = Date.now(); if (!f || (msg.t === 'focus.pause') === !!f.pausedAt) return
      const next: NonNullable<Att['focus']> = msg.t === 'focus.pause' ? { ...f, pausedAt: now } : { startedAt: f.startedAt + (now - f.pausedAt!), endsAt: f.endsAt + (now - f.pausedAt!) }
      ws.serializeAttachment({ ...att, focus: next })
      return this.broadcast({ t: 'focusChanged', userId: att.member!.userId, endsAt: next.endsAt, startedAt: next.startedAt, ...(next.pausedAt && { pausedAt: next.pausedAt }) })
    }
    if (msg.t === 'focus.stop') {
      if (!att.focus) return
      const me = att.member!.userId, next = { ...att, focus: undefined, status: undefined, presence: att.presence === 'dnd' ? 'dnd' as const : 'available' as const }
      ws.serializeAttachment(next)
      this.broadcast({ t: 'focusChanged', userId: me, endsAt: null })
      if (att.presence !== 'dnd') this.broadcast({ t: 'presenceChanged', userId: me, presence: 'available' })
      this.broadcast({ t: 'statusChanged', userId: me, status: null })
      if (zoneAt(this.world, att.pos!.x, att.pos!.y) !== 'library') this.release(ws, next)
      return
    }
    if (msg.t === 'emote') { // silent, so it shows in the Library too; same reach as bubbles (table, then distance); not to people in Do Not Disturb
      const now = Date.now(), rate = rateCheck(att.emo ?? [], now, EMOTE_RATE_LIMIT)
      if (!rate.ok) return
      ws.serializeAttachment({ ...att, emo: rate.times })
      const me = att.member!.userId, from = this.partyOf(att)
      for (const { ws: w, att: a } of this.authed()) {
        const self = a.member!.userId === me
        if (!self && this.blocked(a.member!.userId, me)) continue
        if (self || emoteVisible(from, this.partyOf(a), { receiverDnd: a.presence === 'dnd', aimedAtReceiver: msg.to === a.member!.userId })) this.send(w, { t: 'emoted', userId: me, id: msg.id, ...(msg.to && { to: msg.to }) })
      }
      return
    }
    if (msg.t === 'knock') { // a gentle "chat when free?": delivered now, held while the target is focusing, dropped in Do Not Disturb (and the knocker is told)
      const me = att.member!, now = Date.now(), target = this.authed().find((x) => x.att.member!.userId === msg.userId && x.ws !== ws)
      if (target && this.blocked(msg.userId, me.userId)) return this.send(ws, { t: 'error', code: 'knock_sent', message: `Knocked ${target.att.member!.name}.` }) // blocked: looks sent, goes nowhere
      const key = `${me.userId}>${msg.userId}`
      const r = knockResult({ present: !!target, dnd: target?.att.presence === 'dnd', focusing: !!target && (!!target.att.focus || target.att.presence === 'focusing') }, this.knocks.get(key), now)
      if (r === 'gone') return this.send(ws, { t: 'error', code: 'knock_gone', message: 'They are not here right now' })
      if (r === 'slow') return this.send(ws, { t: 'error', code: 'knock_slow', message: `You knocked ${target!.att.member!.name} a moment ago` })
      if (r === 'dnd') return this.send(ws, { t: 'error', code: 'knock_dnd', message: `${target!.att.member!.name} is in Do Not Disturb` })
      this.knocks.set(key, now)
      if (r === 'queue') target!.ws.serializeAttachment({ ...target!.att, queue: [...(target!.att.queue ?? []), { fromUserId: me.userId, name: me.name, text: 'knocked: chat when you are free?', k: 'knock' as const }].slice(-QUEUE_MAX) })
      else this.send(target!.ws, { t: 'knocked', fromUserId: me.userId, name: me.name })
      return this.send(ws, { t: 'error', code: 'knock_sent', message: `Knocked ${target!.att.member!.name}${r === 'queue' ? '. They are focusing, so they will see it after.' : '.'}` }) // the knocker's confirmation (shown as a toast)
    }
    if (msg.t === 'claimDesk') { // the API has already recorded it (it is the authority across visits); the room only checks you are really sitting there
      const spot = att.sat && att.sat.spotId === msg.spotId ? this.world.sitSpots.find((q) => q.id === msg.spotId) : undefined
      if (spot?.kind === 'desk' && can(att.member!.role, 'claimDesk')) this.broadcast({ t: 'deskClaimed', userId: att.member!.userId, spotId: spot.id })
      return
    }
    if (msg.t === 'sit') { // next to a free spot, and not already sitting: the room seats you there
      const taken = new Set(this.authed().flatMap((x) => (x.att.sat ? [x.att.sat.spotId] : [])))
      const spot = att.sat ? null : canSit(this.world, att.pos!.x, att.pos!.y, msg.spotId, taken)
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
      const r = applyMove(this.world, att.pos!, msg, Date.now())
      const leaving = r.ok && !att.focus && att.presence !== 'dnd' && att.queue?.length && zoneAt(this.world, att.pos!.x, att.pos!.y) === 'library' && zoneAt(this.world, r.mover.x, r.mover.y) !== 'library'
      ws.serializeAttachment({ ...att, pos: r.mover, ...(leaving && { queue: [] }) })
      if (leaving) this.send(ws, { t: 'queued', items: att.queue!.map(({ k, ...q }) => ({ kind: k ?? ('mention' as const), ...q })) }) // what you missed while studying (until Focus arrives in Checkpoint 8, leaving the Library ends it)
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
