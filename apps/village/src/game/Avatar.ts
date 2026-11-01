// One villager on screen: three tinted layers (body, outfit, hair) + a soft shadow + a name tag. Used for me and for everyone else, so both look and animate the same.
import Phaser from 'phaser'
import type { Appearance, Dir, Presence } from '@desker/shared'

export const WALK_BASE: Record<Dir, number> = { down: 0, up: 3, left: 6, right: 9 }
const IDLE = 12, BLINK = 13, SLEEP = 18, BOOK = 19, SIT: Record<Dir, number> = { down: 14, up: 15, left: 16, right: 17 }
export const DEPTH = { entity: 1000, above: 100000, tag: 100500 }

export class Avatar {
  readonly layers: Phaser.GameObjects.Sprite[]
  readonly sprite: Phaser.GameObjects.Sprite // the body layer: the camera follows it
  readonly tag: Phaser.GameObjects.Text
  private shadow: Phaser.GameObjects.Ellipse
  private ring: Phaser.GameObjects.Arc // a small amber ring over someone who is focusing
  private zz: Phaser.GameObjects.Text // and 'zz' over someone who is away
  presence: Presence = 'available'
  private nextBlink = 0
  private blinkUntil = 0
  x = 0; y = 0 // bottom-centre in world pixels

  constructor(scene: Phaser.Scene, look: Appearance, name: string, mine: boolean) {
    this.layers = [['avatar-body', look.skin], ['avatar-outfit', look.outfit], ['avatar-face', 0xffffff], [`avatar-hair-${look.hairStyle}`, look.hair]].map(([key, tint]) =>
      scene.add.sprite(0, 0, key as string, WALK_BASE.down).setOrigin(0.5, 1).setTint(tint as number))
    this.sprite = this.layers[0]
    this.shadow = scene.add.ellipse(0, 0, 10, 4, 0x14213d, 0.22)
    this.ring = scene.add.circle(0, 0, 3).setStrokeStyle(1.5, 0xd89b3a).setDepth(DEPTH.tag).setVisible(false)
    this.zz = scene.add.text(0, 0, 'z z', { fontFamily: 'VT323', fontSize: '8px', color: '#35599a' }).setResolution(4).setOrigin(0, 1).setDepth(DEPTH.tag).setVisible(false)
    // Pixel font for names only; resolution 4 keeps the tiny type crisp when the camera zooms in.
    this.tag = scene.add.text(0, 0, name, { fontFamily: 'VT323', fontSize: '7px', color: mine ? '#ffe9a8' : '#ffffff', backgroundColor: mine ? 'rgba(122,86,56,0.82)' : 'rgba(20,33,61,0.62)', padding: { x: 2, y: 0 } })
      .setOrigin(0.5, 1).setResolution(4).setDepth(DEPTH.tag)
  }

  put(x: number, y: number) {
    this.x = Math.round(x); this.y = Math.round(y)
    this.layers.forEach((l, i) => l.setPosition(this.x, this.y).setDepth(DEPTH.entity + this.y + i * 0.01))
    this.shadow.setPosition(this.x, this.y - 1).setDepth(DEPTH.entity + this.y - 0.5)
    this.tag.setPosition(this.x, this.y - 25)
    this.ring.setPosition(this.x, this.y - 40); this.zz.setPosition(this.x + 5, this.y - 29)
  }
  setPresence(p: Presence) { this.presence = p; this.ring.setVisible(p === 'focusing'); this.zz.setVisible(p === 'away') }
  /** Per-frame life: the focus ring breathes, the zz drifts. */
  tick(time: number) { if (this.presence === 'focusing') this.ring.setAlpha(0.55 + 0.45 * Math.sin(time / 500)); if (this.presence === 'away') this.zz.setPosition(this.x + 5, this.y - 29 - (Math.floor(time / 600) % 3)) }
  private frame(f: number) { for (const l of this.layers) l.setFrame(f) }
  walk(dir: Dir, foot: 0 | 1 | 2) { if (this.presence === 'away') return this.asleep(); this.frame(WALK_BASE[dir] + foot); this.shadow.setVisible(true) }
  private asleep() { this.frame(SLEEP); this.shadow.setVisible(false) }
  sit(dir: Dir) { if (this.presence === 'away') return this.asleep(); this.frame(this.presence === 'focusing' && dir === 'down' ? BOOK : SIT[dir]); this.shadow.setVisible(false) }
  idle(dir: Dir, time: number) {
    if (this.presence === 'away') return this.asleep()
    this.shadow.setVisible(true)
    if (this.presence === 'focusing' && dir === 'down') return this.frame(BOOK)
    if (dir !== 'down') return void this.frame(WALK_BASE[dir])
    if (time > this.nextBlink) { this.blinkUntil = time + 160; this.nextBlink = time + 3000 + Math.random() * 3000 } // blink every 3-6 s
    this.frame(time < this.blinkUntil ? BLINK : IDLE)
  }
  setAlpha(a: number) { for (const l of this.layers) l.setAlpha(a); this.shadow.setAlpha(a * 0.22); this.tag.setAlpha(a); this.ring.setAlpha(a); this.zz.setAlpha(a) }
  /** Fade everything together (the shadow keeps its own softness). */
  fade(scene: Phaser.Scene, from: number, to: number, ms: number, done?: () => void) {
    const p = { a: from }; this.setAlpha(from)
    scene.tweens.add({ targets: p, a: to, duration: ms, onUpdate: () => this.setAlpha(p.a), onComplete: done })
  }
  destroy() { for (const l of this.layers) l.destroy(); this.shadow.destroy(); this.tag.destroy(); this.ring.destroy(); this.zz.destroy() }
}
