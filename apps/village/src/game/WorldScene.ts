// The village world, single player (Checkpoint 4): map, collision, tile-by-tile walking, camera, snow, day/night. Multiplayer joins in Checkpoint 5.
import Phaser from 'phaser'
import { CAMERA_LERP, COLOURS, RUN_MS_PER_TILE, TILE_PX, WALK_MS_PER_TILE, ambientAt, heldKeys, minuteOfDay, parseMap, step, zoneAt, type Colour, type Dir, type World, type ZoneId } from '@desker/shared'

export interface SceneData { userId: string; colour: Colour; onZone?: (z: ZoneId) => void }
const WALK_BASE: Record<Dir, number> = { down: 0, up: 3, left: 6, right: 9 }
const IDLE = 12, BLINK = 13
const D = { ground: 0, floor: 1, walls: 2, below: 3, entity: 1000, above: 100000, snow: 200000, tint: 300000, glow: 310000 } // render order

export class WorldScene extends Phaser.Scene {
  private world!: World
  private me!: Phaser.GameObjects.Sprite
  private keys!: ReturnType<typeof heldKeys>
  private tx = 0; private ty = 0; private facing: Dir = 'down'
  private mv: { fx: number; fy: number; tx: number; ty: number; start: number; dur: number; foot: 1 | 2 } | null = null
  private foot: 1 | 2 = 1
  private nextBlink = 0; private blinkUntil = 0
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
    const sp = this.world.spawns[[...this.data0.userId].reduce((a, c) => a + c.charCodeAt(0), 0) % this.world.spawns.length]
    this.tx = sp.x; this.ty = sp.y
    this.me = this.add.sprite(0, 0, `kodama-${this.data0.colour}`, WALK_BASE.down).setOrigin(0.5, 1)
    this.place(this.tx, this.ty)

    const cam = this.cameras.main, W = this.world.w * TILE_PX, H = this.world.h * TILE_PX
    cam.setBounds(0, 0, W, H).startFollow(this.me, true, CAMERA_LERP, CAMERA_LERP).setRoundPixels(true)
    this.fitZoom(); this.scale.on('resize', () => this.fitZoom())

    this.snow(W, H); this.ambience(json); this.steam()
    this.keys = heldKeys(window)
    this.events.once('shutdown', () => this.keys.destroy())
  }

  private fitZoom() { this.cameras.main.setZoom(this.scale.width >= 900 ? 3 : 2) } // integer zoom only: 3x on desktop, 2x on narrower screens

  private place(tx: number, ty: number) { this.me.setPosition(tx * TILE_PX + TILE_PX / 2, (ty + 1) * TILE_PX).setDepth(D.entity + (ty + 1) * TILE_PX) }

  update(time: number) {
    let startAt = time
    if (this.mv) {
      const t = (time - this.mv.start) / this.mv.dur
      if (t < 1) return this.drawStep(t)
      this.tx = this.mv.tx; this.ty = this.mv.ty; startAt = this.mv.start + this.mv.dur; this.mv = null // carry the overshoot so a held key never stutters
      this.place(this.tx, this.ty)
      const z = zoneAt(this.world, this.tx, this.ty); if (z !== this.lastZone) { this.lastZone = z; this.data0.onZone?.(z) }
    }
    const dir = this.keys.dir()
    if (dir) {
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
    this.me.setPosition(Math.round(x), Math.round(y)).setDepth(D.entity + Math.round(y)).setFrame(WALK_BASE[this.facing] + (t < 0.5 ? m.foot : 0))
  }

  private drawIdle(time: number) {
    if (this.facing !== 'down') return void this.me.setFrame(WALK_BASE[this.facing])
    if (time > this.nextBlink) { this.blinkUntil = time + 160; this.nextBlink = time + 3000 + Math.random() * 3000 } // blink every 3-6 s
    this.me.setFrame(time < this.blinkUntil ? BLINK : IDLE)
    this.me.y = (this.ty + 1) * TILE_PX - (Math.floor(time / 700) % 2) // a gentle one-pixel bob
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
