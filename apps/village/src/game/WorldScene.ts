// The village world, single player (Checkpoint 4): map, collision, tile-by-tile walking, camera, snow, day/night. Multiplayer joins in Checkpoint 5.
import Phaser from 'phaser'
import { CAMERA_LERP, COLOURS, MOVE_SEND_MAX_HZ, REMOTE_INTERP_DELAY_MS, RUN_MS_PER_TILE, TILE_PX, WALK_MS_PER_TILE, ambientAt, heldKeys, interpolate, minuteOfDay, parseMap, spawnFor, step, tooFar, trim, zoneAt, type Colour, type Dir, type Member, type ServerMsg, type Snap, type World, type ZoneId } from '@desker/shared'
import type { Bridge } from './bridge.ts'
import { DEPTH, Kodama } from './Kodama.ts'

export interface SceneData { userId: string; name: string; colour: Colour; bridge: Bridge; onZone?: (z: ZoneId) => void }
interface Remote { k: Kodama; buf: Snap[]; dir: Dir; shown: { x: number; y: number }; lastArrival: number }
const D = { ground: 0, floor: 1, walls: 2, below: 3, entity: DEPTH.entity, above: DEPTH.above, snow: 200000, tint: 300000, glow: 310000 } // render order

export class WorldScene extends Phaser.Scene {
  private world!: World
  private me!: Kodama
  private remotes = new Map<string, Remote>()
  private seq = 0; private lastSend = 0; private dirty = false
  private keys!: ReturnType<typeof heldKeys>
  private tx = 0; private ty = 0; private facing: Dir = 'down'
  private mv: { fx: number; fy: number; tx: number; ty: number; start: number; dur: number; foot: 1 | 2 } | null = null
  private foot: 1 | 2 = 1
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
    for (const c of COLOURS) this.load.spritesheet(`kodama-${c}`, `/assets/kodama-${c}.png`, { frameWidth: 16, frameHeight: 24 })
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
    this.tx = sp.x; this.ty = sp.y
    this.me = new Kodama(this, this.data0.colour, this.data0.name, true)
    this.place(this.tx, this.ty)

    const cam = this.cameras.main, W = this.world.w * TILE_PX, H = this.world.h * TILE_PX
    cam.setBounds(0, 0, W, H).startFollow(this.me.sprite, true, CAMERA_LERP, CAMERA_LERP).setRoundPixels(true)
    this.fitZoom(); this.scale.on('resize', () => this.fitZoom())

    this.snow(W, H); this.ambience(json); this.steam()
    this.keys = heldKeys(window)
    this.events.once('shutdown', () => this.keys.destroy())
    this.sparkle(this.me.x, this.me.y - 8, 0xf2c46d)
    this.data0.bridge.attach((m) => this.onServer(m))
  }

  private fitZoom() { this.cameras.main.setZoom(this.scale.width >= 900 ? 3 : 2) } // integer zoom only: 3x on desktop, 2x on narrower screens

  private place(tx: number, ty: number) { this.me.put(tx * TILE_PX + TILE_PX / 2, (ty + 1) * TILE_PX) }

  update(time: number) {
    this.moveMe(time); this.drawRemotes(time)
    if (this.dirty && time - this.lastSend >= 1000 / MOVE_SEND_MAX_HZ) { // at most 10 updates a second, and only after something changed
      this.data0.bridge.out({ t: 'move', x: this.tx, y: this.ty, dir: this.facing, seq: ++this.seq }); this.lastSend = time; this.dirty = false
    }
  }

  private moveMe(time: number) {
    let startAt = time
    if (this.mv) {
      const t = (time - this.mv.start) / this.mv.dur
      if (t < 1) return this.drawStep(t)
      this.tx = this.mv.tx; this.ty = this.mv.ty; startAt = this.mv.start + this.mv.dur; this.mv = null // carry the overshoot so a held key never stutters
      this.place(this.tx, this.ty); this.dirty = true
      const z = zoneAt(this.world, this.tx, this.ty); if (z !== this.lastZone) { this.lastZone = z; this.data0.onZone?.(z) }
    }
    const dir = this.keys.dir()
    if (dir) {
      if (dir !== this.facing) this.dirty = true
      this.facing = dir // turning to face a blocked tile works without moving
      const n = step(this.world, this.tx, this.ty, dir)
      if (n) {
        this.foot = this.foot === 1 ? 2 : 1
        this.mv = { fx: this.tx, fy: this.ty, tx: n.x, ty: n.y, start: startAt, dur: this.keys.run() ? RUN_MS_PER_TILE : WALK_MS_PER_TILE, foot: this.foot }
        return this.drawStep(Math.min(1, (time - startAt) / this.mv.dur))
      }
    }
    this.drawIdle(time)
  }

  private drawStep(t: number) {
    const m = this.mv!
    const x = (m.fx + (m.tx - m.fx) * t) * TILE_PX + TILE_PX / 2, y = (m.fy + (m.ty - m.fy) * t + 1) * TILE_PX
    this.me.put(x, y); this.me.walk(this.facing, t < 0.5 ? m.foot : 0)
  }

  private drawIdle(time: number) { this.me.idle(this.facing, time) }

  // ---- everyone else ----------------------------------------------------------------------------------------------
  private onServer(m: ServerMsg) {
    const now = this.time.now
    if (m.t === 'welcome') { // a fresh welcome replaces local state (first connect and every reconnect)
      for (const r of this.remotes.values()) r.k.destroy()
      this.remotes.clear()
      for (const mem of m.members) if (mem.userId !== this.data0.userId) this.addRemote(mem, m.positions[mem.userId], now, false)
      const p = m.positions[this.data0.userId]
      if (p && (p.x !== this.tx || p.y !== this.ty) && !this.mv) this.snapMe(p.x, p.y)
    } else if (m.t === 'joined') { if (m.member.userId !== this.data0.userId) this.addRemote(m.member, undefined, now, true) }
    else if (m.t === 'left') {
      const r = this.remotes.get(m.userId); if (!r) return
      this.remotes.delete(m.userId)
      this.tweens.add({ targets: [r.k.sprite, r.k.tag], alpha: 0, duration: 400, onComplete: () => r.k.destroy() }) // a soft fade
    } else if (m.t === 'moved') {
      for (const mv of m.moves) {
        const r = this.remotes.get(mv.userId); if (!r) continue
        const prev = r.buf[r.buf.length - 1], tiles = Math.abs(mv.x - prev.x) + Math.abs(mv.y - prev.y)
        // A walk starts when the news arrives and lasts as long as the real steps did (measured from the gap between updates, never faster than running
        // or slower than walking). So the first step after a rest starts from standing instead of popping in already part-way.
        const dur = Math.min(tiles * WALK_MS_PER_TILE, Math.max(tiles * RUN_MS_PER_TILE, now - r.lastArrival)), start = Math.max(prev.t, now)
        if (start > prev.t) r.buf.push({ t: start, x: prev.x, y: prev.y, dir: mv.dir }) // stand where they were until the walk begins
        r.buf.push({ t: start + dur, x: mv.x, y: mv.y, dir: mv.dir }); r.dir = mv.dir; r.lastArrival = now
      }
    } else if (m.t === 'correct') this.snapMe(m.x, m.y) // the room says that is not where you are
  }

  private snapMe(x: number, y: number) { this.mv = null; this.tx = x; this.ty = y; this.place(x, y); this.dirty = false }

  private addRemote(mem: Member, pos: { x: number; y: number; dir: Dir } | undefined, now: number, arrive: boolean) {
    this.remotes.get(mem.userId)?.k.destroy()
    const p = pos ?? { ...spawnFor(this.world, mem.userId), dir: 'down' as Dir }
    const k = new Kodama(this, mem.colour, mem.name, false)
    k.put(p.x * TILE_PX + TILE_PX / 2, (p.y + 1) * TILE_PX)
    this.remotes.set(mem.userId, { k, buf: [{ t: now - 1000, x: p.x, y: p.y, dir: p.dir }], dir: p.dir, shown: { x: p.x, y: p.y }, lastArrival: now - 1000 })
    if (arrive) { k.setAlpha(0); this.tweens.add({ targets: [k.sprite, k.tag], alpha: 1, duration: 400 }); this.sparkle(k.x, k.y - 8, 0xf2c46d) } // a soft sparkle where they appear
  }

  private drawRemotes(time: number) {
    const rt = time - REMOTE_INTERP_DELAY_MS // drawn a little in the past so motion stays smooth between updates
    for (const r of this.remotes.values()) {
      trim(r.buf, rt)
      const last = r.buf[r.buf.length - 1], pose = interpolate(r.buf, rt)
      if (!pose) continue
      if (tooFar(r.shown, last)) { // far behind (a lag spike or a teleport): snap, with a puff of dust
        this.sparkle(r.k.x, r.k.y - 4, 0xdfe6ef); r.buf.splice(0, r.buf.length - 1)
        r.shown = { x: last.x, y: last.y }; r.k.put(last.x * TILE_PX + 8, (last.y + 1) * TILE_PX); this.sparkle(r.k.x, r.k.y - 4, 0xdfe6ef); continue
      }
      r.shown = { x: pose.x, y: pose.y }
      r.k.put(pose.x * TILE_PX + TILE_PX / 2, (pose.y + 1) * TILE_PX)
      if (pose.moving) r.k.walk(pose.dir, Math.floor(time / WALK_MS_PER_TILE) % 2 ? 1 : 2); else r.k.idle(r.dir, time)
    }
  }

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
    const order: string[] = this.cache.json.get('manifest').assets[0].tileOrder, lamp = order.indexOf('lamp_top') + 1
    const above = json.layers.find((l: any) => l.name === 'furniture_above').data as number[]
    above.forEach((g, i) => { if (g === lamp) this.glows.push(this.add.image((i % this.world.w) * TILE_PX + 8, Math.floor(i / this.world.w) * TILE_PX + 8, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow).setScale(1.3).setAlpha(0)) })
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
