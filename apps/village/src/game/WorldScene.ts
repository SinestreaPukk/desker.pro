// The village world: map, collision, free walking in any direction, sitting, other people, camera, snow, day/night.
import Phaser from 'phaser'
import { AWAY_AFTER_IDLE_MS, BODY_HALF_H, BODY_HALF_W, CAMERA_LERP, MOVE_SEND_MAX_HZ, REMOTE_INTERP_DELAY_MS, RUN_TILES_PER_MS, TILE_PX, WALK_MS_PER_TILE, WALK_TILES_PER_MS, actionOf, ambientAt, appearanceFor, heldKeys, interpolate, isTyping, minuteOfDay, parseMap, spawnFor, spotNear, tooFar, trim, walkBody, zoneAt, type Colour, type Dir, type Member, type Presence, type Spot, type ServerMsg, type Status, type Snap, type World, type ZoneId } from '@desker/shared'
import type { Bridge, RosterItem } from './bridge.ts'
import { Avatar, DEPTH } from './Avatar.ts'

export interface SceneData {
  userId: string; name: string; colour: Colour; bridge: Bridge; onZone?: (z: ZoneId) => void
  libraryAutoFocus: boolean; desks: { userId: string; spotId: string }[]; names: Record<string, string>
  claimDesk: (spotId: string) => Promise<boolean>; onPresence?: (p: Presence) => void
  focusKey: (atDesk: boolean) => boolean // F: React handles it when a timer is running or I am at a desk (true = handled)
}
interface Remote { k: Avatar; buf: Snap[]; dir: Dir; shown: { x: number; y: number }; lastArrival: number; sat?: Spot; gap: number; delay: number }
const D = { ground: 0, floor: 1, walls: 2, below: 3, entity: DEPTH.entity, above: DEPTH.above, snow: 200000, tint: 300000, glow: 310000 } // render order

export class WorldScene extends Phaser.Scene {
  private world!: World
  private me!: Avatar
  private remotes = new Map<string, Remote>()
  private seq = 0; private lastSend = 0; private dirty = false
  private keys!: ReturnType<typeof heldKeys>
  private fx = 0; private fy = 0; private facing: Dir = 'down' // where I am, in tiles (tile t is centred on t; a fraction means between tiles)
  private phase = 0 // how far I have walked, for the stepping animation
  private get tx() { return Math.round(this.fx) } private get ty() { return Math.round(this.fy) } // the tile I am standing in
  private sitting: { spot: Spot; from: { x: number; y: number } } | null = null
  private prompt!: Phaser.GameObjects.Text
  private taken = new Set<string>() // sit spots someone is on
  private desks = new Map<string, string>() // desk spot id -> the member who made it theirs
  private plates = new Map<string, Phaser.GameObjects.Text>()
  private presences = new Map<string, Presence>()
  private statuses = new Map<string, Status>()
  private myPresence: Presence = 'available'; private autoFocused = false; private lastInput = 0
  private awayMs = Number(new URLSearchParams(location.search).get('away')) || AWAY_AFTER_IDLE_MS // ?away=5000 previews falling asleep quickly
  private notice: { text: string; until: number } | null = null
  private bubbles = new Map<string, { box: Phaser.GameObjects.Container; timer: Phaser.Time.TimerEvent }>()
  private tint!: Phaser.GameObjects.Rectangle
  private glows: Phaser.GameObjects.Image[] = []
  private lastZone: ZoneId | null = null
  private data0!: SceneData

  constructor() { super('world') }
  init(d: SceneData) { this.data0 = d }

  preload() {
    this.load.json('manifest', '/assets/manifest.json')
    this.load.tilemapTiledJSON('map', '/maps/snowy_campus.json')
    this.load.image('tiles', '/assets/tiles.png')
    for (const l of ['body', 'outfit', 'face', 'hair-short', 'hair-long']) this.load.spritesheet(`avatar-${l}`, `/assets/avatar-${l}.png`, { frameWidth: 16, frameHeight: 24 })
    this.load.image('snowflake', '/assets/snowflake.png'); this.load.image('glow', '/assets/glow.png')
  }

  create() {
    const json = this.cache.tilemap.get('map').data
    this.world = parseMap(json)
    const map = this.make.tilemap({ key: 'map' })
    const ts = map.addTilesetImage('tiles', 'tiles')!
    for (const [name, depth] of [['ground', D.ground], ['floor', D.floor], ['walls', D.walls], ['furniture_below', D.below], ['furniture_above', D.above]] as const) map.createLayer(name, ts)!.setDepth(depth)

    // I start on a spawn point around the Board (stable per person, so reloading puts you back in the same place).
    const sp = spawnFor(this.world, this.data0.userId) // the room uses the same function, so we agree without talking
    this.fx = sp.x; this.fy = sp.y
    this.me = new Avatar(this, appearanceFor(this.data0.userId, this.data0.colour), this.data0.name, true)
    this.place()

    const cam = this.cameras.main, W = this.world.w * TILE_PX, H = this.world.h * TILE_PX
    cam.setBounds(0, 0, W, H).startFollow(this.me.sprite, true, CAMERA_LERP, CAMERA_LERP).setRoundPixels(true)
    this.fitZoom(); this.scale.on('resize', () => this.fitZoom())

    this.snow(W, H); this.ambience(json); this.steam()
    this.keys = heldKeys(window)
    this.prompt = this.add.text(0, 0, '', { fontFamily: 'VT323', fontSize: '7px', color: '#14213d', backgroundColor: 'rgba(255,233,168,0.92)', padding: { x: 2, y: 0 } }).setOrigin(0.5, 1).setResolution(4).setDepth(DEPTH.tag + 1).setVisible(false)
    const onKey = (e: KeyboardEvent) => {
      this.touched()
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const a = actionOf(e.key, isTyping()); if (a === 'interact') this.interact(); else if (a === 'focus') this.toggleFocus()
    }
    const touched = () => this.touched()
    window.addEventListener('keydown', onKey); for (const t of ['pointerdown', 'pointermove', 'touchstart', 'wheel']) window.addEventListener(t, touched, { passive: true })
    this.events.once('shutdown', () => { this.keys.destroy(); window.removeEventListener('keydown', onKey); for (const t of ['pointerdown', 'pointermove', 'touchstart', 'wheel']) window.removeEventListener(t, touched) })
    this.lastInput = this.time.now
    for (const d of this.data0.desks) this.setDesk(d.userId, d.spotId)
    const b = this.data0.bridge
    b.toggleFocus = () => this.toggleFocus()
    b.locate = (id) => { const t = this.who(id); if (!t || t === this.me) return; const cam = this.cameras.main; cam.startFollow(t.sprite, true, CAMERA_LERP, CAMERA_LERP); this.time.delayedCall(2000, () => cam.startFollow(this.me.sprite, true, CAMERA_LERP, CAMERA_LERP)) } // locate only; walking to them comes in Phase 1
    b.roster = () => this.roster()
    b.timer = (on) => { // a village timer started or ended: the room has already set Focusing / Available for everyone; follow it here
      if (on) { this.autoFocused = false; this.setPresence('focusing', false) }
      else { this.setPresence('available', false); if (this.lastZone === 'library' && this.data0.libraryAutoFocus) { this.autoFocused = true; this.setPresence('focusing') } } // still in the Library: back to quiet focus
    }
    this.sparkle(this.me.x, this.me.y - 8, 0xf2c46d)
    this.data0.bridge.attach((m) => this.onServer(m))
  }

  private fitZoom() { this.cameras.main.setZoom(this.scale.width >= 900 ? 3 : 2) } // integer zoom only: 3x on desktop, 2x on narrower screens

  private place() { this.me.put(this.fx * TILE_PX + TILE_PX / 2, this.fy * TILE_PX + TILE_PX) }

  update(time: number, delta: number) {
    this.moveMe(time, Math.min(delta, 50)); this.drawRemotes(time); this.followBubbles()
    this.me.tick(time); for (const r of this.remotes.values()) r.k.tick(time)
    if (this.myPresence === 'available' && time - this.lastInput > this.awayMs) this.setPresence('away') // asleep after 5 quiet minutes; any input wakes you
    if (this.dirty && time - this.lastSend >= 1000 / MOVE_SEND_MAX_HZ) { // at most 10 updates a second, and only after something changed
      this.sendMove(); this.lastSend = time; this.dirty = false
    }
  }
  private sendMove() { this.data0.bridge.out({ t: 'move', x: Math.round(this.fx * 100) / 100, y: Math.round(this.fy * 100) / 100, dir: this.facing, seq: ++this.seq }) }

  // Free walking: the keys give a direction, we move at a fixed speed along it (diagonals are normalised, so every direction is the same speed),
  // and a small box around the feet slides along walls. No waiting for tile boundaries, no waiting for the room: it answers the instant a key goes down.
  private moveMe(time: number, dt: number) {
    const { dx, dy } = this.keys.vec()
    if (this.sitting) { // any walking key stands you up first
      if (!dx && !dy) { const sp = this.sitting.spot; this.me.sit(this.facing); this.hint(this.notice && this.notice.until > time ? this.notice.text : sp.kind === 'desk' && !this.desks.has(sp.id) ? 'X  make this your desk?' : 'X  stand'); return }
      this.stand()
    }
    if (dx || dy) {
      const face: Dir = dx ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down' // sideways wins on a diagonal: we only draw four facings
      if (face !== this.facing) { this.facing = face; this.dirty = true }
      const len = Math.hypot(dx, dy), d = dt * (this.keys.run() ? RUN_TILES_PER_MS : WALK_TILES_PER_MS)
      const from = { x: this.fx, y: this.fy }, to = walkBody(this.world, this.fx, this.fy, (dx / len) * d, (dy / len) * d, BODY_HALF_W, BODY_HALF_H)
      const moved = Math.hypot(to.x - from.x, to.y - from.y)
      if (moved > 0) {
        const before = zoneAt(this.world, this.tx, this.ty)
        this.fx = to.x; this.fy = to.y; this.dirty = true; this.phase += moved
        const z = zoneAt(this.world, this.tx, this.ty); if (z !== before || this.lastZone === null) this.enterZone(z)
        this.place(); this.hint('')
        const c = this.phase % 1 // one full stride per tile walked: foot, passing, other foot, passing
        return this.me.walk(this.facing, c < 0.25 ? 1 : c < 0.5 ? 0 : c < 0.75 ? 2 : 0)
      }
      this.me.walk(this.facing, 0) // pushing against a wall: face it, stand still
      return
    }
    this.place(); this.me.idle(this.facing, time)
    const s = spotNear(this.world, this.tx, this.ty, this.facing, this.taken)
    this.hint(s ? 'X  sit' : '')
  }

  private hint(text: string) { this.prompt.setVisible(!!text).setText(text).setPosition(this.me.x, this.me.y - 36) }

  private enterZone(z: ZoneId) {
    const was = this.lastZone; this.lastZone = z; this.data0.onZone?.(z)
    if (z === 'library' && was !== 'library' && this.data0.libraryAutoFocus && this.myPresence === 'available') { this.autoFocused = true; this.setPresence('focusing') } // the Library is the quiet zone
    else if (was === 'library' && z !== 'library' && this.autoFocused) { this.autoFocused = false; if (this.myPresence === 'focusing') this.setPresence('available') }
  }

  // ---- presence: available / focusing / away (SPEC §6.1) ------------------------------------------------------------------
  private setPresence(p: Presence, tell = true) {
    if (p === this.myPresence) return
    this.myPresence = p; this.me.setPresence(p); this.presences.set(this.data0.userId, p); this.data0.onPresence?.(p)
    if (tell) this.data0.bridge.out({ t: 'presence', presence: p })
  }
  private touched() { this.lastInput = this.time.now; if (this.myPresence === 'away') this.setPresence('available') }
  private toggleFocus() {
    if (this.data0.focusKey(this.sitting?.spot.kind === 'desk')) return // a running timer or a desk: the timer panel decides
    this.autoFocused = false; if (this.myPresence === 'available') this.setPresence('focusing'); else if (this.myPresence === 'focusing') this.setPresence('available') }

  // ---- desks: a tiny name plate on a claimed desk, even when the owner is offline ---------------------------------------------
  private setDesk(userId: string, spotId: string) {
    for (const [sid, uid] of this.desks) if (uid === userId) { this.desks.delete(sid); this.plates.get(sid)?.destroy(); this.plates.delete(sid) } // one desk per member
    this.desks.set(spotId, userId)
    const sp = this.world.sitSpots.find((q) => q.id === spotId); if (!sp) return
    this.plates.get(spotId)?.destroy()
    const name = this.data0.names[userId] ?? '?', short = [...name].length > 7 ? [...name].slice(0, 6).join('') + '.' : name
    this.plates.set(spotId, this.add.text(sp.x * TILE_PX + TILE_PX / 2, sp.y * TILE_PX - 1, short, { fontFamily: 'VT323', fontSize: '6px', color: '#14213d', backgroundColor: '#ffe9a8', padding: { x: 1, y: 0 } }).setOrigin(0.5, 1).setResolution(4).setDepth(DEPTH.entity - 2))
  }
  private claimHere(spot: Spot) {
    this.data0.claimDesk(spot.id).then((ok) => {
      if (ok) { this.setDesk(this.data0.userId, spot.id); this.data0.bridge.out({ t: 'claimDesk', spotId: spot.id }); this.notice = { text: 'Your desk!', until: this.time.now + 2000 } }
      else this.notice = { text: 'Someone has this desk', until: this.time.now + 2500 }
    })
  }

  private roster(): RosterItem[] {
    const item = (userId: string, x: number, y: number, seat?: Spot): RosterItem => ({ userId, zone: zoneAt(this.world, Math.round(x), Math.round(y)), atDesk: seat?.kind === 'desk', presence: this.presences.get(userId) ?? 'available', status: this.statuses.get(userId), endsAt: this.who(userId)?.focus?.endsAt })
    return [item(this.data0.userId, this.fx, this.fy, this.sitting?.spot), ...[...this.remotes].map(([id, r]) => item(id, r.shown.x, r.shown.y, r.sat))]
  }

  // ---- sitting (X) ------------------------------------------------------------------------------------------------------
  private interact() {
    if (this.sitting) { const sp = this.sitting.spot; return sp.kind === 'desk' && !this.desks.has(sp.id) ? this.claimHere(sp) : this.stand() } // at an unclaimed desk X claims it; walk away to stand
    const spot = spotNear(this.world, this.tx, this.ty, this.facing, this.taken)
    if (spot) this.sit(spot, true)
  }
  private sit(spot: Spot, tell: boolean) {
    if (tell) { // the room must know where I am before it seats me
      if (this.dirty) { this.sendMove(); this.dirty = false }
      this.data0.bridge.out({ t: 'sit', spotId: spot.id })
    }
    this.sitting = { spot, from: { x: this.tx, y: this.ty } }
    this.facing = spot.facing; this.taken.add(spot.id)
    this.me.put(spot.x * TILE_PX + TILE_PX / 2, (spot.y + 1) * TILE_PX); this.me.sit(this.facing)
  }
  private stand(tell = true) {
    const s = this.sitting; if (!s) return
    this.sitting = null; this.taken.delete(s.spot.id)
    this.fx = s.from.x; this.fy = s.from.y; this.place(); this.dirty = false
    if (tell) this.data0.bridge.out({ t: 'stand' })
  }

  // ---- everyone else ----------------------------------------------------------------------------------------------
  private onServer(m: ServerMsg) {
    const now = this.time.now
    if (m.t === 'welcome') { // a fresh welcome replaces local state (first connect and every reconnect)
      for (const r of this.remotes.values()) r.k.destroy()
      this.remotes.clear()
      for (const mem of m.members) if (mem.userId !== this.data0.userId) this.addRemote(mem, m.positions[mem.userId], now, false)
      for (const [uid, p] of Object.entries(m.presence)) { this.presences.set(uid, p); this.remotes.get(uid)?.k.setPresence(p) }
      const mineP = m.presence[this.data0.userId]; if (mineP) this.setPresence(mineP, false)
      this.statuses.clear(); for (const uid of [...this.remotes.keys(), this.data0.userId]) { this.setStatus(uid, m.statuses[uid] ?? null); this.who(uid)?.setFocus(m.focus[uid] ?? null) }
      this.taken = new Set(Object.values(m.sitting)); this.seated = new Map(Object.entries(m.sitting))
      for (const [uid, spotId] of this.seated) this.seat(uid, spotId, true)
      const mine = m.sitting[this.data0.userId], p = m.positions[this.data0.userId]
      if (this.sitting && !mine) this.stand(false)
      if (mine && !this.sitting) { const sp = this.world.sitSpots.find((q) => q.id === mine); if (sp) { this.fx = p?.x ?? this.fx; this.fy = p?.y ?? this.fy; this.sit(sp, false) } }
      else if (!mine && p && (p.x !== this.tx || p.y !== this.ty)) this.snapMe(p.x, p.y)
      const zNow = zoneAt(this.world, this.tx, this.ty); if (zNow !== this.lastZone) this.enterZone(zNow) // arriving at a desk in the Library counts as entering it
    } else if (m.t === 'joined') { if (m.member.userId !== this.data0.userId) this.addRemote(m.member, undefined, now, true) }
    else if (m.t === 'left') {
      const r = this.remotes.get(m.userId); if (!r) return
      this.remotes.delete(m.userId); this.release(m.userId); this.dropBubble(m.userId)
      r.k.fade(this, 1, 0, 400, () => r.k.destroy()) // a soft fade
    } else if (m.t === 'moved') {
      for (const mv of m.moves) {
        const r = this.remotes.get(mv.userId); if (!r) continue
        const prev = r.buf[r.buf.length - 1]
        // Positions arrive about every 100 ms while someone walks. If they had been standing a while, hold them there until just before this news,
        // so the first step starts from rest instead of gliding across the whole quiet gap.
        const gap = now - r.lastArrival
        if (gap < 300) r.gap = Math.max(gap, r.gap * 0.97) // the longest recent wait between updates: the picture must stay that far behind to never run dry
        if (gap > 250) r.buf.push({ t: now - 100, x: prev.x, y: prev.y, dir: mv.dir })
        r.buf.push({ t: now, x: mv.x, y: mv.y, dir: mv.dir }); r.dir = mv.dir; r.lastArrival = now
      }
    } else if (m.t === 'said') this.bubble(m.userId, m.text, !!m.nearbyOnly, !!m.mentionsYou)
    else if (m.t === 'presenceChanged') { if (m.userId !== this.data0.userId) { this.presences.set(m.userId, m.presence); this.remotes.get(m.userId)?.k.setPresence(m.presence) } }
    else if (m.t === 'statusChanged') this.setStatus(m.userId, m.status)
    else if (m.t === 'focusChanged') {
      this.who(m.userId)?.setFocus(m.endsAt && m.startedAt ? { startedAt: m.startedAt, endsAt: m.endsAt, pausedAt: m.pausedAt } : null)
      if (m.userId === this.data0.userId && m.endsAt) { this.autoFocused = false; this.setPresence('focusing', false) } // my own timer, also after a reconnect
    }
    else if (m.t === 'deskClaimed') { if (m.userId !== this.data0.userId) this.setDesk(m.userId, m.spotId) }
    else if (m.t === 'sat') { if (m.userId !== this.data0.userId) this.seat(m.userId, m.spotId, false) }
    else if (m.t === 'stood') { if (m.userId !== this.data0.userId) this.release(m.userId) }
    else if (m.t === 'correct') this.snapMe(m.x, m.y) // the room says that is not where you are
  }

  private setStatus(uid: string, s: Status | null) { if (s) this.statuses.set(uid, s); else this.statuses.delete(uid); this.who(uid)?.setStatus(s?.activity ?? null) }
  private seated = new Map<string, string>() // who sits where, for everyone but also me
  private seat(userId: string, spotId: string, instant: boolean) {
    this.seated.set(userId, spotId); this.taken.add(spotId)
    const r = this.remotes.get(userId), sp = this.world.sitSpots.find((q) => q.id === spotId); if (!r || !sp) return
    r.sat = sp; r.dir = sp.facing
    const last = r.buf[r.buf.length - 1], now = this.time.now
    if (instant) r.buf.splice(0, r.buf.length, { t: now - 1000, x: sp.x, y: sp.y, dir: sp.facing })
    else r.buf.push({ t: Math.max(last.t, now), x: last.x, y: last.y, dir: sp.facing }, { t: Math.max(last.t, now) + WALK_MS_PER_TILE, x: sp.x, y: sp.y, dir: sp.facing }) // a hop onto the seat
  }
  private release(userId: string) {
    const spot = this.seated.get(userId); this.seated.delete(userId); if (spot) this.taken.delete(spot)
    const r = this.remotes.get(userId); if (r) r.sat = undefined
  }

  private snapMe(x: number, y: number) { if (this.sitting) this.stand(false); this.fx = x; this.fy = y; this.place(); this.dirty = false }

  private addRemote(mem: Member, pos: { x: number; y: number; dir: Dir } | undefined, now: number, arrive: boolean) {
    this.remotes.get(mem.userId)?.k.destroy()
    const p = pos ?? { ...spawnFor(this.world, mem.userId), dir: 'down' as Dir }
    const k = new Avatar(this, appearanceFor(mem.userId, mem.colour), mem.name, false)
    k.put(p.x * TILE_PX + TILE_PX / 2, (p.y + 1) * TILE_PX)
    this.remotes.set(mem.userId, { k, buf: [{ t: now - 1000, x: p.x, y: p.y, dir: p.dir }], dir: p.dir, shown: { x: p.x, y: p.y }, lastArrival: now - 1000, gap: 0, delay: REMOTE_INTERP_DELAY_MS })
    if (arrive) { k.fade(this, 0, 1, 400); this.sparkle(k.x, k.y - 8, 0xf2c46d) } // a soft sparkle where they appear
  }

  private drawRemotes(time: number) {
    for (const r of this.remotes.values()) {
      r.delay += (Math.min(250, Math.max(REMOTE_INTERP_DELAY_MS, r.gap + 40)) - r.delay) * 0.05 // drawn a little in the past, as far as their updates need
      const rt = time - r.delay
      trim(r.buf, rt)
      const last = r.buf[r.buf.length - 1], pose = interpolate(r.buf, rt)
      if (!pose) continue
      if (tooFar(r.shown, last)) { // far behind (a lag spike or a teleport): snap, with a puff of dust
        this.sparkle(r.k.x, r.k.y - 4, 0xdfe6ef); r.buf.splice(0, r.buf.length - 1)
        r.shown = { x: last.x, y: last.y }; r.k.put(last.x * TILE_PX + 8, (last.y + 1) * TILE_PX); this.sparkle(r.k.x, r.k.y - 4, 0xdfe6ef); continue
      }
      r.shown = { x: pose.x, y: pose.y }
      r.k.put(pose.x * TILE_PX + TILE_PX / 2, (pose.y + 1) * TILE_PX)
      if (pose.moving) r.k.walk(pose.dir, Math.floor(time / WALK_MS_PER_TILE) % 2 ? 1 : 2); else if (r.sat) r.k.sit(r.sat.facing); else r.k.idle(r.dir, time)
    }
  }

  // ---- speech bubbles (SPEC §6.3): pop in over 120 ms, stay 8 s, fade over 300 ms; a new one replaces the old; "…" for people a little too far to read ----
  private who(userId: string) { return userId === this.data0.userId ? this.me : this.remotes.get(userId)?.k }
  private dropBubble(userId: string) { const b = this.bubbles.get(userId); if (b) { b.timer.remove(); b.box.destroy(); this.bubbles.delete(userId) } }
  private bubble(userId: string, text: string | undefined, hint: boolean, mention: boolean) {
    const who = this.who(userId); if (!who) return
    this.dropBubble(userId)
    const t = this.add.text(0, 0, hint ? '…' : text ?? '', { fontFamily: "'Noto Sans Thai','Sarabun','Thonburi','Tahoma',system-ui,sans-serif", fontSize: '8px', color: '#14213d', align: 'center', wordWrap: { width: 96 } }).setOrigin(0.5, 1).setResolution(4)
    const w = Math.ceil(t.width) + 8, h = Math.ceil(t.height) + 5, g = this.add.graphics()
    g.fillStyle(mention ? 0xfff3d6 : 0xffffff, 1).lineStyle(1, mention ? 0xd89b3a : 0x35599a, 1)
    g.fillRoundedRect(-w / 2, -h - 3, w, h, 3).strokeRoundedRect(-w / 2, -h - 3, w, h, 3)
    g.fillTriangle(-2, -3, 2, -3, 0, 0).lineBetween(-2, -3, 0, 0).lineBetween(2, -3, 0, 0) // the tail
    g.fillStyle(mention ? 0xfff3d6 : 0xffffff, 1).fillRect(-1, -4, 3, 2)
    t.setPosition(0, -5)
    const box = this.add.container(who.x, who.y - 37, [g, t]).setDepth(DEPTH.tag + 2).setScale(0.6)
    this.tweens.add({ targets: box, scale: 1, duration: 120, ease: 'Back.Out' })
    const timer = this.time.delayedCall(hint ? 2500 : 8000, () => this.tweens.add({ targets: box, alpha: 0, duration: 300, onComplete: () => { box.destroy(); if (this.bubbles.get(userId)?.box === box) this.bubbles.delete(userId) } }))
    this.bubbles.set(userId, { box, timer })
  }
  private followBubbles() { for (const [id, b] of this.bubbles) { const w = this.who(id); if (w) b.box.setPosition(w.x, w.y - 37) } }

  /** A small burst of specks: amber sparkle where someone appears, pale dust when someone snaps into place. */
  private sparkle(x: number, y: number, tint: number) {
    const e = this.add.particles(x, y, 'snowflake', { lifespan: 600, speed: { min: 8, max: 26 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, tint, emitting: false }).setDepth(DEPTH.tag)
    e.explode(10); this.time.delayedCall(800, () => e.destroy())
  }

  // Snow falls outdoors only: it spawns outside the buildings and dies if it drifts into one.
  private snow(W: number, H: number) {
    const rooms = this.world.zones.filter((z) => z.id === 'library' || z.id === 'tables' || z.id === 'lounge').map((z) => new Phaser.Geom.Rectangle(z.x * TILE_PX, z.y * TILE_PX, z.w * TILE_PX, z.h * TILE_PX))
    const inRoom = (x: number, y: number) => rooms.some((r) => r.contains(x, y))
    const source = { getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => { let x, y; do { x = Math.random() * W; y = Math.random() * H * 0.6 } while (inRoom(x, y)); p.x = x; p.y = y; return p } }
    this.add.particles(0, 0, 'snowflake', {
      emitZone: { type: 'random', source } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
      deathZone: { type: 'onEnter', source: { contains: inRoom } } as Phaser.Types.GameObjects.Particles.ParticleEmitterDeathZoneConfig,
      lifespan: 14000, speedY: { min: 14, max: 30 }, speedX: { min: -6, max: 6 }, frequency: 70, scale: { min: 0.35, max: 0.6 }, alpha: { start: 0.95, end: 0.4 },
    }).setDepth(D.snow)
  }

  // Day/night follows the viewer's local time (?hour=21 previews another time). Lamps glow after dusk.
  private ambience(json: any) {
    this.tint = this.add.rectangle(0, 0, 6000, 6000, 0xffffff).setOrigin(0).setScrollFactor(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(D.tint)
    const order: string[] = this.cache.json.get('manifest').assets[0].tileOrder
    // anything that gives off light glows after dusk: lamps, stone lanterns, the campfire, the stove and the warm windows
    for (const [layer, name] of [['furniture_above', 'lamp_top'], ['furniture_above', 'lantern_t'], ['furniture_below', 'campfire'], ['furniture_below', 'stove_b'], ['walls', 'wall_win_s']] as const) {
      const gid = order.indexOf(name) + 1
      ;(json.layers.find((l: any) => l.name === layer).data as number[]).forEach((g, i) => { if (g === gid) this.glows.push(this.add.image((i % this.world.w) * TILE_PX + 8, Math.floor(i / this.world.w) * TILE_PX + 8, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow).setScale(name === 'campfire' ? 1.8 : name === 'wall_win_s' ? 1 : 1.3).setAlpha(0)) })
    }
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok'
    const hour = new URLSearchParams(location.search).get('hour')
    const apply = () => {
      const a = ambientAt(hour != null ? Number(hour) * 60 : minuteOfDay(new Date(), zone))
      this.tint.setFillStyle(a.tint, a.strength * 0.85)
      for (const g of this.glows) g.setAlpha(a.lamps ? 0.55 : 0)
    }
    apply(); this.time.addEvent({ delay: 30_000, loop: true, callback: apply })
  }

  // Tea steams above the Lounge counter.
  private steam() {
    this.add.particles(11.4 * TILE_PX, 19 * TILE_PX + 2, 'snowflake', { lifespan: 1800, speedY: { min: -9, max: -5 }, speedX: { min: -1.5, max: 1.5 }, frequency: 500, scale: { start: 0.3, end: 0.7 }, alpha: { start: 0.7, end: 0 } }).setDepth(D.entity + 100000)
  }
}
