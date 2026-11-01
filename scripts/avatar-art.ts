// Draws the villager avatar as four greyscale layers (body, outfit, face, hair short, hair long), 16x24 frames, 6 columns x 3 rows.
// The game tints each layer at runtime (skin tone, outfit colour, hair colour), so one set of sheets makes thousands of looks and the
// customiser in a later phase only has to pick tints and a hair style. An artist can replace the PNGs (same frame order) with no code change.
import { writeFileSync } from 'node:fs'
import { Canvas } from './png.ts'

export const AVATAR_FRAMES = { down: [0, 1, 2], up: [3, 4, 5], left: [6, 7, 8], right: [9, 10, 11], idle: [12, 13], sit: { down: 14, up: 15, left: 16, right: 17 } }
type Dir = 'down' | 'up' | 'left' | 'right'
type Look = { dir: Dir; foot?: 0 | 1 | 2; blink?: boolean; sit?: boolean }

const C = { white: '#ffffff', skin: '#ffffff', skinD: '#dcdcdc', eye: '#2b2440', blush: '#e8a0a8', top: '#ffffff', topD: '#d2d2d2', pants: '#8e8e8e', shoe: '#3b3b3b', hair: '#ffffff', hairD: '#c9c9c9', line: '#2b2440' }

/** A layer that can draw mirrored (left = the right-facing art flipped). */
class Layer {
  c: Canvas; ox: number; oy: number; flip: boolean
  constructor(c: Canvas, ox: number, oy: number, flip: boolean) { this.c = c; this.ox = ox; this.oy = oy; this.flip = flip }
  rect(x: number, y: number, w: number, h: number, col: string) { this.c.rect(this.flip ? 16 - x - w : x, y, w, h, col, this.ox, this.oy) }
  px(x: number, y: number, col: string) { this.rect(x, y, 1, 1, col) }
}

/** One frame into three layer canvases (hair style is chosen by which hair canvas is passed). */
function person(B: Layer, O: Layer, H: Layer, F: Layer, k: Look, long: boolean) {
  const f = k.foot ?? 0, sit = !!k.sit
  const bob = sit ? 3 : f === 0 ? -1 : 0 // upper body rises a pixel between steps
  const y0 = 4 + bob, y1 = y0 + 8 // head top row, torso top row
  const side = k.dir === 'left' || k.dir === 'right'

  // ---- legs first (the torso overlaps their top) ----
  if (!sit) {
    if (!side) {
      O.rect(5, 17, 6, 2, C.pants)
      for (const [x, lifted, sx] of [[5, f === 1, 4], [9, f === 2, 9]] as const) {
        const up = lifted ? 1 : 0
        O.rect(x, 19, 2, 2 - up, C.pants); O.rect(sx, 21 - up, 3, 2, C.shoe)
      }
    } else {
      O.rect(6, 17, 5, 2, C.pants)
      const legs: [number, number, boolean][] = f === 0 ? [[7, 7, false], [8, 8, false]] : f === 1 ? [[5, 4, false], [9, 9, true]] : [[6, 6, true], [8, 8, false]]
      for (const [x, sx, lifted] of legs) { const up = lifted ? 1 : 0; O.rect(x, 19, 2, 2 - up, C.pants); O.rect(sx, 21 - up, 3, 2, C.shoe) }
    }
  } else if (!side) {
    O.rect(5, 20, 6, k.dir === 'up' ? 1 : 2, C.pants)
    if (k.dir === 'down') { O.rect(4, 22, 3, 2, C.shoe); O.rect(9, 22, 3, 2, C.shoe) }
  } else { O.rect(6, 20, 7, 2, C.pants); O.rect(11, 22, 2, 1, C.pants); O.rect(11, 23, 3, 1, C.shoe) }

  // ---- torso and arms ----
  if (!side) {
    O.rect(5, y1, 6, 6, C.top); O.rect(5, y1 + 5, 6, 1, C.topD)
    const la = sit ? 0 : f === 1 ? 1 : 0, ra = sit ? 0 : f === 2 ? 1 : 0
    O.rect(4, y1 + la, 1, 4, C.top); O.rect(11, y1 + ra, 1, 4, C.top)
    B.px(4, y1 + la + 4, C.skin); B.px(11, y1 + ra + 4, C.skin)
    if (k.dir === 'down') B.rect(7, y1, 2, 1, C.skinD)
  } else {
    O.rect(6, y1, 5, 6, C.top); O.rect(6, y1 + 5, 5, 1, C.topD)
    const ax = sit ? 9 : f === 1 ? 9 : f === 2 ? 6 : 8 // the near arm swings opposite the legs
    O.rect(ax, y1 + 1, 1, 4, C.topD); B.px(ax, y1 + 5, C.skin)
  }

  // ---- head ----
  B.rect(4, y0, 8, 7, C.skin); B.rect(5, y0 + 7, 6, 1, C.skin)
  if (k.dir === 'down') {
    if (k.blink) { F.rect(5, y0 + 5, 2, 1, C.eye); F.rect(9, y0 + 5, 2, 1, C.eye) } // eyes are a white and a dark pixel each, so they read on every skin tone
    else { F.rect(5, y0 + 4, 1, 2, C.white); F.rect(6, y0 + 4, 1, 2, C.eye); F.rect(9, y0 + 4, 1, 2, C.eye); F.rect(10, y0 + 4, 1, 2, C.white) }
    F.px(4, y0 + 6, C.blush); F.px(11, y0 + 6, C.blush)
  } else if (side) {
    B.px(12, y0 + 5, C.skin) // nose
    if (k.blink) F.rect(8, y0 + 5, 2, 1, C.eye); else { F.rect(8, y0 + 4, 1, 2, C.white); F.rect(9, y0 + 4, 1, 2, C.eye) }
    F.px(7, y0 + 6, C.blush)
  }

  // ---- hair ----
  if (k.dir === 'down') {
    H.rect(4, y0 - 1, 8, 1, C.hair); H.rect(3, y0, 10, 2, C.hair); H.rect(4, y0 + 1, 8, 1, C.hairD)
    H.rect(3, y0 + 2, 2, 2, C.hair); H.rect(11, y0 + 2, 2, 2, C.hair); H.rect(5, y0 + 2, 3, 1, C.hair); H.rect(9, y0 + 2, 2, 1, C.hair)
    if (long) { H.rect(3, y0 + 4, 2, 5, C.hair); H.rect(11, y0 + 4, 2, 5, C.hair) }
  } else if (k.dir === 'up') {
    H.rect(4, y0 - 1, 8, 1, C.hair); H.rect(3, y0, 10, 7, C.hair); H.rect(4, y0 + 7, 8, 1, C.hair); H.rect(4, y0 + 2, 8, 1, C.hairD)
    if (long) { H.rect(3, y0 + 7, 10, 3, C.hair); H.rect(4, y0 + 8, 8, 1, C.hairD) }
  } else {
    H.rect(4, y0 - 1, 8, 1, C.hair); H.rect(3, y0, 9, 2, C.hair); H.rect(4, y0 + 1, 7, 1, C.hairD); H.rect(3, y0 + 2, 5, 5, C.hair); H.rect(9, y0 + 2, 3, 1, C.hair)
    if (long) H.rect(3, y0 + 7, 5, 3, C.hair)
  }
}

/** 1px dark outline around whatever a layer drew, inside each 16x24 frame (so every layer carries its own edge). */
function outline(c: Canvas, cols: number, rows: number) {
  const add: [number, number][] = []
  for (let fy = 0; fy < rows; fy++) for (let fx = 0; fx < cols; fx++) for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) {
    const X = fx * 16 + x, Y = fy * 24 + y
    if (c.data[(Y * c.w + X) * 4 + 3]) continue
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < 16 && ny < 24 && c.data[((Y + dy) * c.w + X + dx) * 4 + 3]) { add.push([X, Y]); break }
    }
  }
  for (const [x, y] of add) c.px(x, y, C.line)
}

const ORDER: Look[] = [
  ...(['down', 'up', 'left', 'right'] as const).flatMap((dir) => ([0, 1, 2] as const).map((foot) => ({ dir, foot }))),
  { dir: 'down' }, { dir: 'down', blink: true },
  { dir: 'down', sit: true }, { dir: 'up', sit: true }, { dir: 'left', sit: true }, { dir: 'right', sit: true },
]

export function writeAvatarSheets(out: string) {
  const mk = () => new Canvas(6 * 16, 3 * 24)
  const sheets = { body: mk(), outfit: mk(), face: mk(), 'hair-short': mk(), 'hair-long': mk() }
  const scratch = mk()
  ORDER.forEach((k, i) => {
    const ox = (i % 6) * 16, oy = Math.floor(i / 6) * 24, flip = k.dir === 'left'
    const L = (c: Canvas) => new Layer(c, ox, oy, flip)
    person(L(sheets.body), L(sheets.outfit), L(sheets['hair-short']), L(sheets.face), k, false)
    person(L(scratch), L(mk()), L(sheets['hair-long']), L(mk()), k, true) // body/outfit are identical; only the long hair is kept
  })
  for (const [name, c] of Object.entries(sheets)) { if (name !== 'face') outline(c, 6, 3); writeFileSync(out + `avatar-${name}.png`, c.toPng()) }
  return Object.keys(sheets).map((name) => ({ key: `avatar-${name}`, file: `avatar-${name}.png`, frameWidth: 16, frameHeight: 24, animations: AVATAR_FRAMES }))
}
