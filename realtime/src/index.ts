// Cloudflare Worker + Durable Object: one VillageRoom per village. Checkpoint 3: hello -> welcome, joined/left, ping/pong. Movement etc. come later.
import { DurableObject } from 'cloudflare:workers'
import { applyMove, newMover, parseMap, spawnFor, type Colour, type Dir, type Member, type Mover, type Role } from '@desker/shared'
import type { ServerMsg } from '@desker/shared'
import { checkHello, countBad, parseClient } from './logic.ts'
import campus from '../../apps/village/public/maps/snowy_campus.json'

const WORLD = parseMap(campus as never) // the same map file the client draws, so both sides agree on every wall
const MOVED_BATCH_MS = 50

export interface Env { ROOM: DurableObjectNamespace; VILLAGE_ROOM_SECRET: string; ALLOWED_ORIGINS?: string }
interface Att { vid: string; authed: boolean; bad: number; badAt: number; member?: Member; pos?: Mover }
const HELLO_TIMEOUT_MS = 10_000
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

  async fetch(req: Request): Promise<Response> {
    const vid = ROOM_PATH.exec(new URL(req.url).pathname)![1]
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ vid, authed: false, bad: 0, badAt: 0 } satisfies Att)
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + HELLO_TIMEOUT_MS)
    return new Response(null, { status: 101, webSocket: client })
  }

  // Sockets that never said hello are closed (they cost memory and could be probing).
  async alarm() {
    for (const ws of this.ctx.getWebSockets()) if (!(ws.deserializeAttachment() as Att).authed) ws.close(4001, 'hello timeout')
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
      let pos: Mover | undefined
      for (const o of this.authed()) if (o.att.member?.userId === me.userId) { pos = o.att.pos; o.ws.close(4000, 'replaced') } // one connection per person: the newest wins, and keeps the old place
      const sp = spawnFor(WORLD, me.userId)
      ws.serializeAttachment({ ...att, authed: true, member: me, pos: pos ? { ...pos, tokens: 3, at: Date.now() } : newMover(sp.x, sp.y, Date.now()) })
      const all = this.authed()
      const members = [...new Map(all.map((x) => [x.att.member!.userId, x.att.member!])).values()]
      const positions = Object.fromEntries(all.map((x) => [x.att.member!.userId, { x: x.att.pos!.x, y: x.att.pos!.y, dir: x.att.pos!.dir }]))
      this.send(ws, { t: 'welcome', self: me, members, positions, presence: {}, statuses: {}, desks: {}, board: [], mapVersion: 1 })
      this.broadcast({ t: 'joined', member: me }, ws)
      return
    }
    if (msg.t === 'ping') return this.send(ws, { t: 'pong', ts: msg.ts })
    if (msg.t === 'move') { // validate loosely (SPEC §3.5): reachable within the walking budget, else tell the client where it really is
      const r = applyMove(WORLD, att.pos!, msg, Date.now())
      ws.serializeAttachment({ ...att, pos: r.mover })
      if (!r.ok) return this.send(ws, { t: 'correct', x: r.mover.x, y: r.mover.y })
      this.pending.set(att.member!.userId, { userId: att.member!.userId, x: msg.x, y: msg.y, dir: msg.dir, seq: msg.seq })
      this.timer ??= setTimeout(() => this.flush(), MOVED_BATCH_MS)
    }
    // say, sit, status, presence, focus, claimDesk: later checkpoints
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
