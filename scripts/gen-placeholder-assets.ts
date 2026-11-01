// Draws the placeholder art (original, simple, calm): tileset, six kodama colours, snowflake, lamp glow, and assets/manifest.json.
// An artist replaces the PNGs (same frame sizes and order, see manifest.json) with no code change.
//   node scripts/gen-placeholder-assets.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { Canvas } from './png.ts'
import { TILE_NAMES, TILE_COLS, COLOURS } from './village-tiles.ts'

const out = new URL('../apps/village/public/assets/', import.meta.url).pathname
mkdirSync(out, { recursive: true })

// ~32-colour palette shared with the app: snow whites, soft blues, slate, muted greens, wood browns, one warm lantern amber.
const P = {
  snow: '#f4f7fb', snowL: '#e3ecf6', snowD: '#cddbec', stone: '#c5cfdc', stoneD: '#a3b0c3', slate: '#5b6b86', slateD: '#3c4863', plaster: '#dfe6ef', plasterD: '#c3cfdf',
  wood: '#b98b5e', woodD: '#8d6440', woodL: '#d4ab7c', trunk: '#7a5638', green: '#6f9f78', greenD: '#4c7a58', greenL: '#9cc79f',
  blue: '#9fc3ee', blueL: '#c9e0f7', blueD: '#35599a', water: '#8ab8e6', waterD: '#6a9bd1', amber: '#f2c46d', amberD: '#d89b3a', rose: '#f0a9b8', roseD: '#d98197', red: '#d96a6a', ink: '#14213d', white: '#ffffff',
}
const h = (x: number, y: number) => (Math.imul(x * 73856093 ^ y * 19349663, 83492791) >>> 0) % 100

// ---- tiles -------------------------------------------------------------------------------------------
const tiles = new Canvas(TILE_COLS * 16, Math.ceil(TILE_NAMES.length / TILE_COLS) * 16)
const at = (n: string) => { const i = TILE_NAMES.indexOf(n as never); return [(i % TILE_COLS) * 16, Math.floor(i / TILE_COLS) * 16] as const }
const T: Record<string, (c: Canvas, ox: number, oy: number) => void> = {
  snow0: (c, x, y) => { c.rect(0, 0, 16, 16, P.snow, x, y); for (const [a, b] of [[3, 4], [11, 9], [6, 13], [13, 2]]) c.px(a, b, P.snowL, x, y) },
  snow1: (c, x, y) => { c.rect(0, 0, 16, 16, P.snow, x, y); for (const [a, b] of [[2, 3], [9, 6], [5, 11], [12, 12], [14, 4]]) c.px(a, b, P.snowD, x, y); c.rect(7, 8, 2, 1, P.snowL, x, y) },
  path: (c, x, y) => { c.rect(0, 0, 16, 16, P.stone, x, y); c.rect(0, 7, 16, 1, P.stoneD, x, y); c.rect(0, 15, 16, 1, P.stoneD, x, y); c.rect(5, 0, 1, 8, P.stoneD, x, y); c.rect(11, 8, 1, 8, P.stoneD, x, y) },
  wood: (c, x, y) => { c.rect(0, 0, 16, 16, P.wood, x, y); for (const r of [3, 7, 11, 15]) c.rect(0, r, 16, 1, P.woodD, x, y); c.rect(4, 0, 1, 4, P.woodD, x, y); c.rect(10, 8, 1, 4, P.woodD, x, y); c.rect(7, 4, 3, 1, P.woodL, x, y) },
  wall: (c, x, y) => { c.rect(0, 0, 16, 16, P.plaster, x, y); c.rect(0, 0, 16, 2, P.snow, x, y); c.rect(0, 11, 16, 5, P.slate, x, y); c.rect(0, 11, 16, 1, P.slateD, x, y); c.rect(0, 5, 16, 1, P.plasterD, x, y) },
  window: (c, x, y) => { T.wall(c, x, y); c.rect(3, 3, 10, 8, P.woodD, x, y); c.rect(4, 4, 8, 6, P.blueL, x, y); c.rect(7, 4, 2, 6, P.woodD, x, y); c.rect(4, 6, 8, 1, P.woodD, x, y); c.rect(4, 4, 3, 2, P.white, x, y) },
  fence: (c, x, y) => { c.rect(1, 4, 3, 11, P.woodD, x, y); c.rect(12, 4, 3, 11, P.woodD, x, y); c.rect(0, 6, 16, 2, P.wood, x, y); c.rect(0, 10, 16, 2, P.wood, x, y); c.rect(1, 3, 3, 1, P.snow, x, y); c.rect(12, 3, 3, 1, P.snow, x, y) },
  trunk: (c, x, y) => { c.rect(6, 0, 4, 14, P.trunk, x, y); c.rect(6, 0, 1, 14, P.woodD, x, y); c.rect(4, 13, 8, 2, P.snow, x, y) },
  canopy: (c, x, y) => { c.ellipse(8, 11, 8, 6, P.greenD, x, y); c.ellipse(8, 8, 6.5, 5, P.green, x, y); c.ellipse(8, 4.5, 4.5, 4, P.greenL, x, y); c.rect(3, 9, 4, 2, P.snow, x, y); c.rect(9, 5, 3, 2, P.snow, x, y); c.rect(6, 1, 3, 2, P.snow, x, y) },
  water: (c, x, y) => { c.rect(0, 0, 16, 16, P.water, x, y); for (const [a, b] of [[2, 4], [9, 9], [5, 13], [11, 2]]) c.rect(a, b, 4, 1, P.waterD, x, y); c.rect(6, 6, 2, 1, P.blueL, x, y) },
  bench: (c, x, y) => { c.rect(1, 6, 14, 3, P.woodL, x, y); c.rect(1, 9, 14, 1, P.woodD, x, y); c.rect(2, 10, 2, 5, P.woodD, x, y); c.rect(12, 10, 2, 5, P.woodD, x, y); c.rect(1, 5, 14, 1, P.snow, x, y) },
  desk: (c, x, y) => { c.rect(0, 3, 16, 7, P.woodL, x, y); c.rect(0, 10, 16, 5, P.wood, x, y); c.rect(0, 10, 16, 1, P.woodD, x, y); c.rect(0, 14, 16, 1, P.woodD, x, y); c.rect(3, 4, 4, 3, P.blueD, x, y); c.rect(4, 5, 2, 1, P.blueL, x, y); c.rect(10, 5, 3, 2, P.white, x, y) },
  chair: (c, x, y) => { c.rect(4, 1, 8, 7, P.woodD, x, y); c.rect(5, 2, 6, 5, P.wood, x, y); c.rect(3, 8, 10, 3, P.woodL, x, y); c.rect(3, 11, 10, 1, P.woodD, x, y); c.rect(4, 12, 2, 3, P.woodD, x, y); c.rect(10, 12, 2, 3, P.woodD, x, y) },
  shelf: (c, x, y) => { c.rect(0, 0, 16, 16, P.woodD, x, y); for (const r of [1, 8]) { c.rect(1, r, 14, 6, P.slateD, x, y); [[2, P.red], [4, P.blueD], [6, P.green], [8, P.amber], [10, P.rose], [12, P.blue]].forEach(([a, col], i) => c.rect(a as number, r + (i % 2), 2, 6 - (i % 2), col as string, x, y)) } c.rect(0, 7, 16, 1, P.wood, x, y) },
  lamp_base: (c, x, y) => { c.rect(7, 0, 2, 13, P.slateD, x, y); c.rect(4, 13, 8, 2, P.slate, x, y); c.rect(4, 12, 8, 1, P.snow, x, y) },
  lamp_top: (c, x, y) => { c.rect(7, 8, 2, 8, P.slateD, x, y); c.rect(4, 2, 8, 7, P.amberD, x, y); c.rect(5, 3, 6, 5, P.amber, x, y); c.rect(6, 4, 2, 2, P.white, x, y); c.rect(3, 1, 10, 2, P.slate, x, y); c.rect(4, 0, 8, 1, P.snow, x, y) },
  table: (c, x, y) => { c.rect(0, 2, 16, 10, P.woodL, x, y); c.rect(0, 12, 16, 3, P.wood, x, y); c.rect(0, 12, 16, 1, P.woodD, x, y); c.rect(0, 2, 16, 1, P.snow, x, y); c.rect(5, 5, 6, 4, P.white, x, y); c.rect(6, 6, 4, 1, P.blueD, x, y) },
  kotatsu: (c, x, y) => { c.rect(0, 0, 16, 16, P.rose, x, y); c.rect(0, 0, 16, 2, P.roseD, x, y); c.rect(0, 14, 16, 2, P.roseD, x, y); c.rect(2, 3, 12, 8, P.woodL, x, y); c.rect(3, 4, 10, 6, P.wood, x, y); c.rect(6, 5, 3, 3, P.amber, x, y) },
  cushion: (c, x, y) => { c.ellipse(8, 9, 6.5, 5, P.roseD, x, y); c.ellipse(8, 8, 6, 4.5, P.rose, x, y); c.px(8, 8, P.roseD, x, y) },
  counter: (c, x, y) => { c.rect(0, 4, 16, 4, P.woodL, x, y); c.rect(0, 8, 16, 8, P.wood, x, y); c.rect(0, 8, 16, 1, P.woodD, x, y); c.rect(10, 1, 4, 4, P.slate, x, y); c.rect(14, 2, 1, 2, P.slate, x, y); c.rect(11, 0, 2, 1, P.snowD, x, y) },
  plant: (c, x, y) => { c.rect(5, 10, 6, 5, P.wood, x, y); c.rect(5, 10, 6, 1, P.woodD, x, y); c.ellipse(8, 7, 5, 4, P.green, x, y); c.ellipse(6, 5, 3, 3, P.greenL, x, y); c.ellipse(10, 6, 3, 3, P.greenD, x, y) },
  snowman_b: (c, x, y) => { c.ellipse(8, 9, 6.5, 6, P.snowD, x, y); c.ellipse(8, 8.5, 6, 5.5, P.snow, x, y); c.px(8, 7, P.ink, x, y); c.px(8, 10, P.ink, x, y) },
  snowman_t: (c, x, y) => { c.ellipse(8, 11, 5, 4.5, P.snow, x, y); c.px(6, 10, P.ink, x, y); c.px(10, 10, P.ink, x, y); c.rect(7, 12, 3, 1, P.amberD, x, y); c.rect(4, 6, 8, 1, P.slateD, x, y); c.rect(6, 3, 4, 3, P.slateD, x, y) },
  door_mat: (c, x, y) => { T.wood(c, x, y); c.rect(2, 3, 12, 10, P.slate, x, y); c.rect(3, 4, 10, 8, P.blueD, x, y); c.rect(5, 6, 6, 4, P.slate, x, y) },
}
for (const n of TILE_NAMES) if (T[n]) { const [x, y] = at(n); T[n](tiles, x, y) }
// The Board, drawn at 48x32 then cut into six tiles: a post-and-cork notice board with pinned notes.
const b = new Canvas(48, 32)
b.rect(0, 0, 48, 32, null); b.rect(2, 0, 4, 32, P.woodD); b.rect(42, 0, 4, 32, P.woodD); b.rect(0, 1, 48, 3, P.woodD); b.rect(4, 4, 40, 22, P.wood); b.rect(6, 6, 36, 18, '#c9a37a')
for (const [x, y, c] of [[8, 8, P.white], [19, 9, P.blueL], [31, 8, P.amber], [10, 16, P.rose], [24, 15, P.white], [35, 16, P.greenL]] as [number, number, string][]) { b.rect(x, y, 8, 7, c); b.px(x + 3, y, P.red); b.rect(x + 1, y + 2, 6, 1, P.slate); b.rect(x + 1, y + 4, 4, 1, P.slate) }
b.rect(0, 26, 48, 2, P.snow); b.rect(2, 28, 4, 4, P.woodD); b.rect(42, 28, 4, 4, P.woodD)
for (let i = 0; i < 6; i++) { const [ox, oy] = at(`board${i}`); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = ((Math.floor(i / 3) * 16 + y) * 48 + (i % 3) * 16 + x) * 4; if (b.data[k + 3]) tiles.data.set(b.data.subarray(k, k + 4), ((oy + y) * tiles.w + ox + x) * 4) } }
// Each tile is saved with a 1px extruded border (margin 1, spacing 2) so zoomed rendering never bleeds a neighbour's pixels into a seam.
const ROWS = Math.ceil(TILE_NAMES.length / TILE_COLS), ext = new Canvas(TILE_COLS * 18, ROWS * 18)
for (let i = 0; i < TILE_NAMES.length; i++) {
  const sx = (i % TILE_COLS) * 16, sy = Math.floor(i / TILE_COLS) * 16, dx = (i % TILE_COLS) * 18 + 1, dy = Math.floor(i / TILE_COLS) * 18 + 1
  for (let y = -1; y <= 16; y++) for (let x = -1; x <= 16; x++) {
    const cx = Math.min(15, Math.max(0, x)), cy = Math.min(15, Math.max(0, y)), k = ((sy + cy) * tiles.w + sx + cx) * 4
    ext.data.set(tiles.data.subarray(k, k + 4), ((dy + y) * ext.w + dx + x) * 4)
  }
}
writeFileSync(out + 'tiles.png', ext.toPng())

// ---- kodama: 16x24 frames, 6 columns x 3 rows. A rounded body, two dot eyes, a blush, a leaf. -----------------------
const BODY: Record<string, [string, string, string]> = { // [fill, shade, outline]
  snow: ['#f6f8fc', '#dbe4f0', '#8b9bb5'], sky: ['#bcd7f5', '#92b8e3', '#5f86b8'], moss: ['#bfe0bd', '#98c496', '#5f8f62'],
  rose: ['#f8cdd6', '#eaa6b5', '#b8707f'], amber: ['#f8dfaa', '#e8c176', '#b08a3e'], plum: ['#d9c8f0', '#b9a2dd', '#7f66ab'],
}
const FRAMES = { down: [0, 1, 2], up: [3, 4, 5], left: [6, 7, 8], right: [9, 10, 11], idle: [12, 13], sit: [14], read: [15, 16], sleep: [17] }
type Look = { dir: 'down' | 'up' | 'left' | 'right'; foot?: 0 | 1 | 2; blink?: boolean; sit?: boolean; read?: 0 | 1; sleep?: boolean }
function kodama(c: Canvas, ox: number, oy: number, col: string, k: Look) {
  const [fill, shade, line] = BODY[col]
  const squish = k.sit || k.read !== undefined || k.sleep ? 2 : 0, cy = 14 + squish / 2 + (k.foot === 1 || k.foot === 2 ? -0.5 : 0)
  c.ellipse(8, cy + 0.5, 6.5, 7.3 - squish / 2, line, ox, oy) // outline
  c.ellipse(8, cy, 6, 6.8 - squish / 2, fill, ox, oy)
  c.ellipse(8, cy + 2.5, 5, 3.5 - squish / 4, shade, ox, oy); c.ellipse(8, cy + 1.5, 5.3, 4, fill, ox, oy) // soft belly shade
  const lx = k.dir === 'left' ? 6 : k.dir === 'right' ? 10 : 8 // the leaf on top
  c.rect(lx - 1, 3 + squish, 3, 2, '#6f9f78', ox, oy); c.rect(lx, 2 + squish, 2, 1, '#9cc79f', ox, oy); c.px(lx, 5 + squish, '#4c7a58', ox, oy)
  if (!k.sit && k.read === undefined && !k.sleep) { // feet
    const l = k.foot === 1 ? 20 : 21, r = k.foot === 2 ? 20 : 21
    c.rect(5, l, 2, 2, line, ox, oy); c.rect(9, r, 2, 2, line, ox, oy)
  }
  if (k.dir !== 'up') {
    const ey = Math.round(cy) - 1, [e1, e2] = k.dir === 'left' ? [4, 7] : k.dir === 'right' ? [8, 11] : [5, 10]
    const eyeCol = '#14213d'
    if (k.blink || k.sleep) { c.rect(e1 - 0, ey + 1, 2, 1, eyeCol, ox, oy); if (k.dir === 'down' || k.sleep) c.rect(e2, ey + 1, 2, 1, eyeCol, ox, oy) }
    else if (k.read !== undefined) { c.rect(e1, ey + 1, 2, 1, eyeCol, ox, oy); c.rect(e2, ey + 1, 2, 1, eyeCol, ox, oy) }
    else { c.rect(e1, ey, 1, 2, eyeCol, ox, oy); if (k.dir === 'down') c.rect(e2, ey, 1, 2, eyeCol, ox, oy); else c.rect(k.dir === 'left' ? 4 + 3 : 8 + 3, ey, 1, 2, eyeCol, ox, oy) }
    c.rect(k.dir === 'down' ? 3 : k.dir === 'left' ? 2 : 6, ey + 3, 2, 1, '#f0a9b8', ox, oy); if (k.dir === 'down') c.rect(11, ey + 3, 2, 1, '#f0a9b8', ox, oy)
  } else { c.rect(6, Math.round(cy) - 2, 4, 1, shade, ox, oy) }
  if (k.read !== undefined) { c.rect(3, 18, 10, 4, '#8d6440', ox, oy); c.rect(4, 18, 8, 3, '#ffffff', ox, oy); c.rect(8, 18, 1, 3, '#a3b0c3', ox, oy); if (k.read === 1) c.rect(9, 17, 3, 1, '#ffffff', ox, oy) }
}
const order: Look[] = [
  ...(['down', 'up', 'left', 'right'] as const).flatMap((dir) => ([0, 1, 2] as const).map((foot) => ({ dir, foot }))),
  { dir: 'down' }, { dir: 'down', blink: true }, { dir: 'up', sit: true }, { dir: 'down', read: 0 }, { dir: 'down', read: 1 }, { dir: 'down', sleep: true },
]
for (const col of COLOURS) {
  const sheet = new Canvas(6 * 16, 3 * 24)
  order.forEach((k, i) => kodama(sheet, (i % 6) * 16, Math.floor(i / 6) * 24, col, k))
  writeFileSync(out + `kodama-${col}.png`, sheet.toPng())
}
// ---- snowflake, lamp glow -------------------------------------------------------------------------------------------
const flake = new Canvas(3, 3); flake.px(1, 0, P.white); flake.px(0, 1, P.white); flake.px(1, 1, P.white); flake.px(2, 1, P.white); flake.px(1, 2, P.white); writeFileSync(out + 'snowflake.png', flake.toPng())
const glow = new Canvas(64, 64)
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot(x - 31.5, y - 31.5) / 32, a = Math.max(0, 1 - d) ** 2; if (a > 0) glow.data.set([242, 196, 109, Math.round(a * 255)], (y * 64 + x) * 4) }
writeFileSync(out + 'glow.png', glow.toPng())

writeFileSync(out + 'manifest.json', JSON.stringify({
  note: 'Placeholder art, generated by scripts/gen-placeholder-assets.ts. Replace the files (same frame size and order) without touching code.',
  assets: [
    { key: 'tiles', file: 'tiles.png', frameWidth: 16, frameHeight: 16, margin: 1, spacing: 2, tileOrder: TILE_NAMES },
    ...COLOURS.map((c) => ({ key: `kodama-${c}`, file: `kodama-${c}.png`, frameWidth: 16, frameHeight: 24, animations: FRAMES })),
    { key: 'snowflake', file: 'snowflake.png' }, { key: 'glow', file: 'glow.png' },
  ],
}, null, 2) + '\n')
console.log(`wrote ${out}`)
