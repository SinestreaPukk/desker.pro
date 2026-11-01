// One kodama on screen: sprite + name tag + blink/bob. Used for me and for everyone else, so both look and animate the same.
import Phaser from 'phaser'
import type { Colour, Dir } from '@desker/shared'

export const WALK_BASE: Record<Dir, number> = { down: 0, up: 3, left: 6, right: 9 }
const IDLE = 12, BLINK = 13
export const DEPTH = { entity: 1000, above: 100000, tag: 100500 }

export class Kodama {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly tag: Phaser.GameObjects.Text
  private nextBlink = 0
  private blinkUntil = 0
  x = 0; y = 0 // bottom-centre in world pixels

  constructor(scene: Phaser.Scene, colour: Colour, name: string, mine: boolean) {
    this.sprite = scene.add.sprite(0, 0, `kodama-${colour}`, WALK_BASE.down).setOrigin(0.5, 1)
    // Pixel font for names only; resolution 3 keeps the tiny type crisp when the camera zooms in.
    this.tag = scene.add.text(0, 0, name, { fontFamily: 'VT323', fontSize: '7px', color: mine ? '#ffe9a8' : '#ffffff', backgroundColor: mine ? 'rgba(122,86,56,0.82)' : 'rgba(20,33,61,0.62)', padding: { x: 2, y: 0 } })
      .setOrigin(0.5, 1).setResolution(4).setDepth(DEPTH.tag)
  }

  put(x: number, y: number) {
    this.x = Math.round(x); this.y = Math.round(y)
    this.sprite.setPosition(this.x, this.y).setDepth(DEPTH.entity + this.y)
    this.tag.setPosition(this.x, this.y - 25)
  }
  walk(dir: Dir, frame: 0 | 1 | 2) { this.sprite.setFrame(WALK_BASE[dir] + frame) }
  idle(dir: Dir, time: number) {
    if (dir !== 'down') return void this.sprite.setFrame(WALK_BASE[dir])
    if (time > this.nextBlink) { this.blinkUntil = time + 160; this.nextBlink = time + 3000 + Math.random() * 3000 } // blink every 3-6 s
    this.sprite.setFrame(time < this.blinkUntil ? BLINK : IDLE)
    this.sprite.y = this.y - (Math.floor(time / 700) % 2) // a gentle one-pixel bob
  }
  setAlpha(a: number) { this.sprite.setAlpha(a); this.tag.setAlpha(a) }
  destroy() { this.sprite.destroy(); this.tag.destroy() }
}
