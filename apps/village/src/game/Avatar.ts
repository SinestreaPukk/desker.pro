// One villager on screen: three tinted layers (body, outfit, hair) + a soft shadow + a name tag. Used for me and for everyone else, so both look and animate the same.
import Phaser from 'phaser'
import type { Appearance, Dir, Presence } from '@desker/shared'

export const WALK_BASE: Record<Dir, number> = { down: 0, up: 3, left: 6, right: 9 }
const IDLE = 12, BLINK = 13, SLEEP = 18, BOOK = 19, SIT: Record<Dir, number> = { down: 14, up: 15, left: 16, right: 17 }
const ICON: Record<string, string> = { reading: '📖', practising: '✏️', writing: '📝', revising: '🔁', lab_report: '🧪', group_work: '👥', admin: '📋', other: '📚' } // the activity icon over someone's head
export const DEPTH = { entity: 1000, above: 100000, tag: 100500 }

export class Avatar {
  readonly layers: Phaser.GameObjects.Sprite[]
  readonly sprite: Phaser.GameObjects.Sprite // the body layer: the camera follows it
  readonly tag: Phaser.GameObjects.Text
  private shadow: Phaser.GameObjects.Ellipse
  private ring: Phaser.GameObjects.Arc // a small amber ring over someone who is focusing
  private zz: Phaser.GameObjects.Text // and 'zz' over someone who is away
  private arc: Phaser.GameObjects.Graphics // the timer ring: what is left of a focus timer, so friends can see how long they have
  private icon: Phaser.GameObjects.Text // what they are working on
  private shh: Phaser.GameObjects.Text // headphones and a little "shh" sign for Do Not Disturb
  focus: { startedAt: number; endsAt: number; pausedAt?: number } | null = null
  presence: Presence = 'available'
  private arcAt = 0
  private nextBlink = 0
  private blinkUntil = 0
  x = 0; y = 0 // bottom-centre in world pixels

  constructor(scene: Phaser.Scene, look: Appearance, name: string, mine: boolean) {
    this.layers = [['avatar-body', look.skin], ['avatar-outfit', look.outfit], ['avatar-face', 0xffffff], [`avatar-hair-${look.hairStyle}`, look.hair]].map(([key, tint]) =>
      scene.add.sprite(0, 0, key as string, WALK_BASE.down).setOrigin(0.5, 1).setTint(tint as number))
    this.sprite = this.layers[0]
    this.shadow = scene.add.ellipse(0, 0, 10, 4, 0x14213d, 0.22)
    this.ring = scene.add.circle(0, 0, 3).setStrokeStyle(1.5, 0xd89b3a).setDepth(DEPTH.tag).setVisible(false)
    this.arc = scene.add.graphics().setDepth(DEPTH.tag).setVisible(false)
    this.icon = scene.add.text(0, 0, '', { fontSize: '8px' }).setResolution(4).setOrigin(0.5, 1).setDepth(DEPTH.tag).setVisible(false)
    this.shh = scene.add.text(0, 0, '🎧 shh', { fontFamily: 'VT323', fontSize: '8px', color: '#14213d', backgroundColor: '#ffe9a8', padding: { x: 2, y: 0 } }).setResolution(4).setOrigin(0, 1).setDepth(DEPTH.tag).setVisible(false)
    this.zz = scene.add.text(0, 0, 'z z', { fontFamily: 'VT323', fontSize: '8px', color: '#35599a' }).setResolution(4).setOrigin(0, 1).setDepth(DEPTH.tag).setVisible(false)
    // Pixel font for names only; resolution 4 keeps the tiny type crisp when the camera zooms in.
    this.tag = scene.add.text(0, 0, name, { fontFamily: 'VT323', fontSize: '7px', color: mine ? '#ffe9a8' : '#ffffff', backgroundColor: document.documentElement.classList.contains('hc') ? '#000000' : mine ? 'rgba(122,86,56,0.82)' : 'rgba(20,33,61,0.62)', padding: { x: 2, y: 0 } })
      .setOrigin(0.5, 1).setResolution(4).setDepth(DEPTH.tag)
  }

  put(x: number, y: number) {
    this.x = Math.round(x); this.y = Math.round(y)
    this.layers.forEach((l, i) => l.setPosition(this.x, this.y).setDepth(DEPTH.entity + this.y + i * 0.01))
    this.shadow.setPosition(this.x, this.y - 1).setDepth(DEPTH.entity + this.y - 0.5)
    this.tag.setPosition(this.x, this.y - 25)
    this.ring.setPosition(this.x, this.y - 40); this.arc.setPosition(this.x, this.y - 40); this.icon.setPosition(this.x, this.y - 46); this.zz.setPosition(this.x + 5, this.y - 29); this.shh.setPosition(this.x + 7, this.y - 15)
  }
  setPresence(p: Presence) { this.presence = p; this.ring.setVisible(p === 'focusing' && !this.focus); this.zz.setVisible(p === 'away'); this.shh.setVisible(p === 'dnd') }
  setFocus(f: { startedAt: number; endsAt: number; pausedAt?: number } | null) { this.focus = f; this.arcAt = 0; this.arc.setVisible(!!f); this.ring.setVisible(this.presence === 'focusing' && !f); if (!f) this.arc.clear() }
  setStatus(activity: string | null) { this.icon.setText(activity ? ICON[activity] ?? ICON.other : '').setVisible(!!activity) }
  private drawArc() {
    const f = this.focus!, left = Math.min(1, Math.max(0, (f.endsAt - (f.pausedAt ?? Date.now())) / (f.endsAt - f.startedAt)))
    this.arc.clear().lineStyle(1.5, 0xffffff, 0.35).strokeCircle(0, 0, 3.5).lineStyle(1.5, 0xd89b3a, 1)
    if (left > 0) this.arc.beginPath().arc(0, 0, 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left).strokePath()
  }
  /** Per-frame life: the focus ring breathes, the zz drifts. */
  tick(time: number) { if (this.focus && time - this.arcAt > 1000) { this.arcAt = time; this.drawArc() }
     if (this.presence === 'focusing') this.ring.setAlpha(0.55 + 0.45 * Math.sin(time / 500)); if (this.presence === 'away') this.zz.setPosition(this.x + 5, this.y - 29 - (Math.floor(time / 600) % 3)) }
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
  setAlpha(a: number) { for (const l of this.layers) l.setAlpha(a); this.shadow.setAlpha(a * 0.22); this.tag.setAlpha(a); this.ring.setAlpha(a); this.arc.setAlpha(a); this.icon.setAlpha(a); this.zz.setAlpha(a); this.shh.setAlpha(a) }
  /** Fade everything together (the shadow keeps its own softness). */
  fade(scene: Phaser.Scene, from: number, to: number, ms: number, done?: () => void) {
    const p = { a: from }; this.setAlpha(from)
    scene.tweens.add({ targets: p, a: to, duration: ms, onUpdate: () => this.setAlpha(p.a), onComplete: done })
  }
  destroy() { for (const l of this.layers) l.destroy(); this.shadow.destroy(); this.tag.destroy(); this.ring.destroy(); this.arc.destroy(); this.icon.destroy(); this.zz.destroy(); this.shh.destroy() }
}
