// The tile art for the village: original, warm, pixel-clean. One painter per tile name (see village-tiles.ts for the order).
// An artist can replace tiles.png with real art in the same order; nothing here is needed at runtime.
import { Canvas } from './png.ts'
import type { TileName } from './village-tiles.ts'

export const P = {
  snow: '#f4f7fb', snowL: '#ffffff', snowM: '#e3ecf6', snowD: '#cddbec', snowDD: '#b4c6de', stone: '#c5cfdc', stoneL: '#d8e0ea', stoneD: '#a3b0c3', stoneDD: '#8795ad',
  slate: '#5b6b86', slateD: '#3c4863', slateDD: '#2a3350', roof: '#4a5878', roofL: '#6a7ba0', roofD: '#364263',
  plaster: '#efe6d3', plasterD: '#d9ccb2', plasterDD: '#bfae8f', beam: '#8d6440', beamD: '#6e4a2c',
  wood: '#b98b5e', woodD: '#8d6440', woodDD: '#6e4a2c', woodL: '#d4ab7c', woodLL: '#e6c598', trunk: '#7a5638',
  green: '#6f9f78', greenD: '#4c7a58', greenDD: '#37604a', greenL: '#9cc79f',
  blue: '#9fc3ee', blueL: '#c9e0f7', blueD: '#35599a', blueDD: '#27437a', water: '#8ab8e6', waterD: '#6a9bd1', waterL: '#b6d6f2',
  amber: '#f2c46d', amberD: '#d89b3a', amberL: '#ffe3a0', rose: '#f0a9b8', roseD: '#d98197', roseL: '#f8cdd6', red: '#d96a6a', redD: '#b04a52',
  tatami: '#d3c993', tatamiD: '#b4aa73', tatamiE: '#6f7f4c', tileA: '#eef2f8', tileB: '#d9e2ee', carpet: '#5b8f6a', carpetD: '#467656', carpetL: '#7fb08c',
  ink: '#14213d', white: '#ffffff', cream: '#f6efe0', paper: '#fffaf0',
}
const h = (x: number, y: number) => (Math.imul(x * 73856093 ^ y * 19349663, 83492791) >>> 0) % 100

/** What a painter draws with: coordinates are inside the 16x16 tile. */
export interface G { r(x: number, y: number, w: number, h: number, c: string): void; p(x: number, y: number, c: string): void; e(cx: number, cy: number, rx: number, ry: number, c: string): void; sh(x: number, y: number, w: number, h: number, a: number, c?: string): void }
export const painter = (cv: Canvas, ox: number, oy: number): G => ({
  r: (x, y, w, hh, c) => cv.rect(x, y, w, hh, c, ox, oy),
  p: (x, y, c) => cv.px(x, y, c, ox, oy),
  e: (cx, cy, rx, ry, c) => cv.ellipse(cx, cy, rx, ry, c, ox, oy),
  sh: (x, y, w, hh, a, c = P.ink) => cv.blend(x, y, w, hh, c, a, ox, oy), // a soft translucent shadow
})
type Paint = (g: G, seed: number) => void

const snowBase = (g: G, seed: number, kind: number) => {
  g.r(0, 0, 16, 16, P.snow)
  const spots: [number, number][] = [[3, 4], [11, 9], [6, 13], [13, 2], [2, 10], [9, 5]]
  spots.forEach(([a, b], i) => { if ((seed + i * 7 + kind) % 3 === 0) g.p(a, b, P.snowM) })
  if (kind === 1) { g.r(7, 8, 2, 1, P.snowM); g.p(2, 3, P.snowD); g.p(12, 12, P.snowD) }
  if (kind === 2) { g.p(4, 5, P.stoneD); g.p(5, 5, P.stone); g.p(11, 10, P.stoneD); g.p(10, 11, P.stone); g.p(12, 11, P.stoneL) } // pebbles
  if (kind === 3) { for (const [a, b] of [[4, 11], [9, 6]]) { g.p(a, b, P.tatamiE); g.p(a - 1, b - 1, P.tatamiE); g.p(a + 1, b - 1, P.tatamiE); g.p(a, b - 1, P.greenD) } } // grass tufts poking out
  if (kind === 4) { g.p(3, 3, P.snowL); g.p(10, 8, P.snowL); g.p(5, 12, P.snowL); g.p(13, 4, P.snowL); g.r(0, 14, 16, 1, P.snowM); g.r(0, 15, 16, 1, P.snowD) } // a gentle drift line
}

/** Cobbles with snow banked against the sides that are not path. */
const cobble = (g: G, m: number, seed: number) => {
  g.r(0, 0, 16, 16, P.stone)
  for (const [x, y, w] of [[0, 0, 7], [8, 0, 8], [0, 5, 4], [5, 5, 7], [13, 5, 3], [0, 10, 8], [9, 10, 7]] as [number, number, number][]) { g.r(x, y + 4, w, 1, P.stoneD); g.r(x + w, y, 1, 5, P.stoneD); g.r(x, y, w, 1, P.stoneL) }
  for (let i = 0; i < 4; i++) { const a = (seed * 7 + i * 5) % 16, b = (seed * 3 + i * 9) % 16; g.p(a, b, P.stoneDD) }
  const bank = (x: number, y: number, w: number, hh: number, edge: [number, number, number, number]) => { g.r(x, y, w, hh, P.snow); g.r(edge[0], edge[1], edge[2], edge[3], P.stoneDD) }
  if (m & 1) { bank(0, 0, 16, 3, [0, 3, 16, 1]); g.r(0, 4, 16, 1, P.stoneD) }
  if (m & 4) { bank(0, 13, 16, 3, [0, 12, 16, 1]); g.r(0, 11, 16, 1, P.stoneD) }
  if (m & 8) { bank(0, 0, 3, 16, [3, 0, 1, 16]) }
  if (m & 2) { bank(13, 0, 3, 16, [12, 0, 1, 16]) }
  if (m & 1 && m & 8) g.r(3, 3, 1, 1, P.stoneDD)
}
/** Pond water with a rim of ice and snow on the banks. */
const pond = (g: G, m: number, seed: number) => {
  g.r(0, 0, 16, 16, P.water)
  for (const [a, b] of [[2, 4], [9, 9], [5, 13], [11, 2]]) if ((seed + a) % 2 === 0 || true) g.r(a, b, 4, 1, P.waterD)
  g.r(6, 6, 2, 1, P.waterL); g.r(12, 12, 2, 1, P.waterL)
  const rim = (x: number, y: number, w: number, hh: number) => { g.r(x, y, w, hh, P.snowM) }
  if (m & 1) { rim(0, 0, 16, 3); g.r(0, 3, 16, 1, P.waterL) }
  if (m & 4) { rim(0, 13, 16, 3); g.r(0, 12, 16, 1, P.waterL) }
  if (m & 8) { rim(0, 0, 3, 16); g.r(3, 0, 1, 16, P.waterL) }
  if (m & 2) { rim(13, 0, 3, 16); g.r(12, 0, 1, 16, P.waterL) }
}

const plank = (g: G, base: string, dark: string, light: string, seed: number) => {
  g.r(0, 0, 16, 16, base)
  for (const r of [3, 7, 11, 15]) g.r(0, r, 16, 1, dark)
  for (const [x, y] of [[4, 0], [11, 4], [3, 8], [9, 12]] as [number, number][]) g.r(((x + seed) % 14) + 1, y, 1, 3, dark)
  g.r(7, 5, 3, 1, light); g.r(2, 13, 3, 1, light)
}
const wallShadow = (g: G) => { g.sh(0, 0, 16, 5, 0.22); g.sh(0, 5, 16, 3, 0.1) }

const wallFace = (g: G) => { // north wall: cream plaster, wood wainscot, dark snow-capped base
  g.r(0, 0, 16, 16, P.plaster); g.r(0, 0, 16, 1, P.white); g.r(0, 1, 16, 1, P.plasterD)
  g.r(0, 9, 16, 7, P.wood); g.r(0, 8, 16, 1, P.woodL); g.r(0, 9, 16, 1, P.woodD)
  for (const x of [3, 8, 13]) g.r(x, 10, 1, 6, P.woodD)
  g.r(0, 15, 16, 1, P.woodDD)
}
const T: Partial<Record<TileName, Paint>> = {
  snow0: (g, s) => snowBase(g, s, 0), snow1: (g, s) => snowBase(g, s, 1), snow2: (g, s) => snowBase(g, s, 2), snow3: (g, s) => snowBase(g, s, 3), snow4: (g, s) => snowBase(g, s, 4),
  door_mat: (g) => { plank(g, P.wood, P.woodD, P.woodL, 0); g.r(2, 3, 12, 10, P.slate); g.r(3, 4, 10, 8, P.blueD); g.r(5, 6, 6, 4, P.slate); g.r(7, 7, 2, 2, P.amber) },
  wood: (g, s) => plank(g, P.wood, P.woodD, P.woodL, s), wood_s: (g, s) => { plank(g, P.wood, P.woodD, P.woodL, s); wallShadow(g) },
  wood_d: (g, s) => plank(g, '#a37a52', P.woodDD, P.wood, s),
  tile_a: (g) => { g.r(0, 0, 16, 16, P.tileA); g.r(0, 15, 16, 1, P.tileB); g.r(15, 0, 1, 16, P.tileB); g.r(2, 2, 3, 1, P.white) },
  tile_b: (g) => { g.r(0, 0, 16, 16, P.tileB); g.r(0, 15, 16, 1, P.snowDD); g.r(15, 0, 1, 16, P.snowDD); g.r(10, 9, 3, 1, P.tileA) },
  tile_s: (g) => { g.r(0, 0, 16, 16, P.tileA); g.r(0, 15, 16, 1, P.tileB); wallShadow(g) },
  tatami: (g) => { g.r(0, 0, 16, 16, P.tatami); for (let y = 2; y < 16; y += 3) g.r(0, y, 16, 1, P.tatamiD); g.r(0, 0, 1, 16, P.tatamiE); g.r(15, 0, 1, 16, P.tatamiE) },
  tatami_s: (g) => { g.r(0, 0, 16, 16, P.tatami); for (let y = 2; y < 16; y += 3) g.r(0, y, 16, 1, P.tatamiD); g.r(0, 0, 1, 16, P.tatamiE); g.r(15, 0, 1, 16, P.tatamiE); wallShadow(g) },
  carpet: (g) => { g.r(0, 0, 16, 16, P.carpet); for (const [x, y] of [[2, 3], [9, 6], [5, 11], [12, 13], [13, 2]] as [number, number][]) g.p(x, y, P.carpetD); g.r(0, 0, 16, 1, P.carpetL); g.r(0, 15, 16, 1, P.carpetD) },
  carpet_s: (g) => { g.r(0, 0, 16, 16, P.carpet); wallShadow(g) },
  carpet_l: (g) => { g.r(0, 0, 16, 16, P.carpet); g.r(0, 0, 2, 16, P.amber); g.r(2, 0, 1, 16, P.carpetD); g.r(8, 7, 2, 2, P.carpetL) },
  carpet_r: (g) => { g.r(0, 0, 16, 16, P.carpet); g.r(14, 0, 2, 16, P.amber); g.r(13, 0, 1, 16, P.carpetD); g.r(6, 7, 2, 2, P.carpetL) },
  wall_n: (g) => wallFace(g),
  wall_win: (g) => { wallFace(g); g.r(2, 2, 12, 11, P.beamD); g.r(3, 3, 10, 9, P.blueL); g.r(7, 3, 2, 9, P.beamD); g.r(3, 7, 10, 1, P.beamD); g.r(3, 3, 4, 3, P.white); g.r(2, 13, 12, 2, P.woodL); g.r(2, 13, 12, 1, P.white); g.r(10, 4, 2, 1, P.snowL) },
  wall_win_s: (g) => { wallFace(g); g.r(2, 2, 12, 11, P.beamD); g.r(3, 3, 10, 9, P.amber); g.r(7, 3, 2, 9, P.beamD); g.r(3, 7, 10, 1, P.beamD); g.r(3, 3, 10, 2, P.amberL); g.r(2, 13, 12, 2, P.woodL) }, // warm lit window
  wall_poster: (g) => { wallFace(g); g.r(3, 2, 10, 11, P.white); g.r(3, 2, 10, 1, P.red); g.r(4, 4, 8, 4, P.blue); g.r(5, 5, 3, 2, P.snowL); g.r(4, 9, 8, 1, P.slate); g.r(4, 11, 5, 1, P.stoneD); g.p(8, 1, P.redD) },
  wall_clock: (g) => { wallFace(g); g.e(8, 6, 5, 5, P.beamD); g.e(8, 6, 4, 4, P.white); g.r(8, 3, 1, 4, P.ink); g.r(8, 6, 3, 1, P.ink); g.p(8, 6, P.red) },
  wall_banner: (g) => { wallFace(g); g.r(4, 1, 8, 1, P.beamD); g.r(5, 2, 6, 10, P.red); g.r(5, 2, 6, 1, P.redD); g.r(7, 5, 2, 4, P.amber); g.r(5, 12, 2, 2, P.red); g.r(9, 12, 2, 2, P.red) },
  wall_boardl: (g) => { wallFace(g); g.r(1, 2, 15, 11, P.beamD); g.r(2, 3, 14, 9, P.white); g.r(4, 5, 8, 1, P.blue); g.r(4, 7, 5, 1, P.red); g.r(4, 9, 9, 1, P.green) },
  wall_boardr: (g) => { wallFace(g); g.r(0, 2, 15, 11, P.beamD); g.r(0, 3, 14, 9, P.white); g.r(2, 5, 4, 3, P.amberL); g.r(8, 6, 3, 3, P.blueL); g.r(2, 13, 12, 1, P.stoneD) },
  wall_w: (g) => { g.r(0, 0, 16, 16, P.plaster); g.r(0, 0, 5, 16, P.beam); g.r(0, 0, 1, 16, P.beamD); g.r(4, 0, 1, 16, P.beamD); g.r(5, 0, 2, 16, P.plasterDD) },
  wall_e: (g) => { g.r(0, 0, 16, 16, P.plaster); g.r(11, 0, 5, 16, P.beam); g.r(15, 0, 1, 16, P.beamD); g.r(11, 0, 1, 16, P.beamD); g.r(9, 0, 2, 16, P.plasterDD) },
  wall_s: (g) => { g.r(0, 0, 16, 16, P.snow); g.r(0, 4, 16, 8, P.roof); g.r(0, 4, 16, 1, P.roofL); g.r(0, 11, 16, 1, P.roofD); g.r(0, 12, 16, 2, P.snowM); for (const x of [3, 7, 11]) g.r(x, 5, 1, 6, P.roofD); g.r(0, 3, 16, 1, P.snowM) },
  wall_nw: (g) => { wallFace(g); g.r(0, 0, 4, 16, P.beam); g.r(0, 0, 1, 16, P.beamD); g.r(3, 0, 1, 16, P.beamD) },
  wall_ne: (g) => { wallFace(g); g.r(12, 0, 4, 16, P.beam); g.r(15, 0, 1, 16, P.beamD); g.r(12, 0, 1, 16, P.beamD) },
  wall_sw: (g) => { T.wall_s!(g, 0); g.r(0, 0, 4, 16, P.beam); g.r(0, 0, 1, 16, P.beamD); g.r(3, 0, 1, 16, P.beamD); g.r(0, 12, 4, 4, P.snow) },
  wall_se: (g) => { T.wall_s!(g, 0); g.r(12, 0, 4, 16, P.beam); g.r(15, 0, 1, 16, P.beamD); g.r(12, 0, 1, 16, P.beamD); g.r(12, 12, 4, 4, P.snow) },
  roof_m: (g) => { g.r(0, 0, 16, 16, P.roof); for (let y = 0; y < 16; y += 4) { g.r(0, y + 3, 16, 1, P.roofD); for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) g.r(x, y, 1, 3, P.roofD) } g.r(0, 0, 16, 3, P.snow); g.r(0, 3, 16, 1, P.snowM); g.r(3, 5, 4, 1, P.roofL); g.r(10, 9, 4, 1, P.roofL); g.r(0, 14, 16, 2, P.roofD) },
  roof_l: (g) => { T.roof_m!(g, 0); g.r(0, 0, 3, 16, P.roofD); g.r(0, 0, 2, 3, P.snow) },
  roof_r: (g) => { T.roof_m!(g, 0); g.r(13, 0, 3, 16, P.roofD); g.r(14, 0, 2, 3, P.snow) },
  fence: (g) => { g.r(1, 4, 3, 11, P.woodD, ); g.r(12, 4, 3, 11, P.woodD); g.r(0, 6, 16, 2, P.wood); g.r(0, 10, 16, 2, P.wood); g.r(0, 6, 16, 1, P.woodL); g.r(0, 10, 16, 1, P.woodL); g.r(1, 3, 3, 1, P.snow); g.r(12, 3, 3, 1, P.snow); g.r(0, 8, 16, 1, P.woodDD) },
  fence_post: (g) => { g.r(6, 3, 4, 12, P.woodD); g.r(6, 2, 4, 1, P.snow); g.r(6, 3, 1, 12, P.wood); g.r(5, 14, 6, 1, P.snowD) },
  desk_a: (g) => { desk(g); g.r(3, 3, 6, 4, P.slate); g.r(4, 4, 4, 2, P.blueL); g.r(3, 7, 6, 1, P.slateD); g.r(11, 5, 3, 2, P.white); g.p(12, 5, P.stoneD) }, // laptop and a note
  desk_b: (g) => { desk(g); g.r(2, 4, 5, 3, P.red); g.r(2, 4, 5, 1, P.redD); g.r(3, 2, 5, 3, P.blueD); g.r(3, 2, 5, 1, P.blue); g.r(10, 4, 4, 3, P.paper); g.r(11, 5, 2, 1, P.stoneD) }, // stacked books
  desk_c: (g) => { desk(g); g.r(2, 3, 5, 4, P.paper); g.r(3, 4, 3, 1, P.stoneD); g.r(3, 6, 2, 1, P.stoneD); g.r(10, 1, 2, 3, P.slateD); g.r(9, 0, 4, 2, P.amber); g.r(10, 4, 2, 3, P.slateD); g.r(11, 6, 4, 1, P.amberL) }, // reading lamp
  chair: (g) => { g.sh(3, 12, 10, 3, 0.18); g.r(4, 1, 8, 7, P.woodD); g.r(5, 2, 6, 5, P.wood); g.r(3, 8, 10, 3, P.woodL); g.r(3, 11, 10, 1, P.woodD); g.r(4, 12, 2, 3, P.woodD); g.r(10, 12, 2, 3, P.woodD) },
  chair_b: (g) => { g.sh(3, 12, 10, 3, 0.18); g.r(4, 1, 8, 7, P.blueDD); g.r(5, 2, 6, 5, P.blueD); g.r(3, 8, 10, 3, P.blue); g.r(3, 11, 10, 1, P.blueDD); g.r(4, 12, 2, 3, P.slateD); g.r(10, 12, 2, 3, P.slateD) },
  shelf_a: (g) => shelf(g, [P.red, P.blueD, P.green, P.amber, P.rose, P.blue], [P.amber, P.blue, P.redD, P.green, P.roseD, P.blueD]),
  shelf_b: (g) => shelf(g, [P.blueD, P.blue, P.slate, P.blueL, P.blueD, P.slate], [P.green, P.greenD, P.greenL, P.green, P.amber, P.greenD]),
  shelf_c: (g) => { shelf(g, [P.rose, P.roseD, P.amber, P.red, P.rose, P.amberD], [P.slate, P.stoneD, P.slateD, P.stone, P.slate, P.slateD]); g.r(5, 7, 3, 1, P.white) },
  plant: (g) => { g.sh(4, 13, 9, 2, 0.2); g.r(5, 10, 6, 5, P.wood); g.r(5, 10, 6, 1, P.woodD); g.e(8, 7, 5, 4, P.green); g.e(6, 5, 3, 3, P.greenL); g.e(10, 6, 3, 3, P.greenD) },
  plant_tall_b: (g) => { g.sh(3, 13, 11, 2, 0.2); g.r(4, 7, 8, 8, P.woodD); g.r(4, 7, 8, 1, P.wood); g.r(5, 8, 6, 6, P.wood); g.r(6, 0, 4, 8, P.greenD); g.e(8, 3, 4, 3, P.green) },
  plant_tall_t: (g) => { g.e(8, 12, 6, 4, P.greenD); g.e(5, 9, 4, 4, P.green); g.e(11, 9, 4, 4, P.green); g.e(8, 6, 4, 4, P.greenL); g.r(7, 12, 2, 4, P.greenDD) },
  table_a: (g) => { g.sh(1, 13, 14, 3, 0.2); g.r(0, 2, 16, 10, P.woodL); g.r(0, 12, 16, 3, P.wood); g.r(0, 12, 16, 1, P.woodD); g.r(0, 2, 16, 1, P.woodLL); g.r(3, 5, 4, 4, P.white); g.r(4, 6, 2, 1, P.blueD); g.r(10, 4, 3, 3, P.white); g.r(11, 5, 1, 1, P.woodD) },
  table_b: (g) => { g.sh(1, 13, 14, 3, 0.2); g.r(0, 2, 16, 10, P.woodL); g.r(0, 12, 16, 3, P.wood); g.r(0, 12, 16, 1, P.woodD); g.r(0, 2, 16, 1, P.woodLL); g.r(2, 4, 5, 4, P.paper); g.r(3, 5, 3, 1, P.stoneD); g.r(10, 5, 3, 3, P.amber); g.r(10, 5, 3, 1, P.amberL) },
  cushion: (g) => { g.sh(2, 11, 12, 3, 0.15); g.e(8, 9, 6.5, 5, P.roseD); g.e(8, 8, 6, 4.5, P.rose); g.p(8, 8, P.roseD); g.r(5, 6, 3, 1, P.roseL) },
  cushion_b: (g) => { g.sh(2, 11, 12, 3, 0.15); g.e(8, 9, 6.5, 5, P.blueD); g.e(8, 8, 6, 4.5, P.blue); g.p(8, 8, P.blueD); g.r(5, 6, 3, 1, P.blueL) },
  kotatsu_tl: (g) => { g.r(0, 0, 16, 16, P.rose); g.r(0, 0, 16, 2, P.roseD); g.r(0, 0, 2, 16, P.roseD); g.r(2, 3, 14, 13, P.woodL); g.r(3, 4, 13, 12, P.wood); g.r(8, 6, 3, 3, P.amber) },
  kotatsu_tr: (g) => { g.r(0, 0, 16, 16, P.rose); g.r(0, 0, 16, 2, P.roseD); g.r(14, 0, 2, 16, P.roseD); g.r(0, 3, 14, 13, P.woodL); g.r(0, 4, 13, 12, P.wood); g.r(3, 6, 4, 3, P.white); g.r(4, 7, 2, 1, P.blueD) },
  kotatsu_bl: (g) => { g.r(0, 0, 16, 16, P.rose); g.r(0, 14, 16, 2, P.roseD); g.r(0, 0, 2, 16, P.roseD); g.r(2, 0, 14, 13, P.woodL); g.r(3, 0, 13, 12, P.wood); g.r(6, 3, 4, 4, P.amber); g.r(7, 4, 2, 2, P.white) },
  kotatsu_br: (g) => { g.r(0, 0, 16, 16, P.rose); g.r(0, 14, 16, 2, P.roseD); g.r(14, 0, 2, 16, P.roseD); g.r(0, 0, 14, 13, P.woodL); g.r(0, 0, 13, 12, P.wood); g.r(4, 4, 4, 4, P.paper); g.r(5, 5, 2, 1, P.stoneD) },
  counter_l: (g) => { g.sh(0, 14, 16, 2, 0.2); g.r(0, 4, 16, 4, P.woodL); g.r(0, 8, 16, 8, P.wood); g.r(0, 8, 16, 1, P.woodD); g.r(0, 4, 1, 12, P.woodD); g.r(6, 1, 5, 4, P.slate); g.r(11, 2, 1, 2, P.slate); g.r(7, 0, 3, 1, P.snowM); g.r(2, 10, 5, 5, P.woodD) },
  counter_m: (g) => { g.sh(0, 14, 16, 2, 0.2); g.r(0, 4, 16, 4, P.woodL); g.r(0, 8, 16, 8, P.wood); g.r(0, 8, 16, 1, P.woodD); g.r(2, 2, 3, 2, P.white); g.r(3, 3, 1, 1, P.woodD); g.r(10, 2, 3, 2, P.white); g.r(5, 10, 6, 5, P.woodD) },
  counter_r: (g) => { g.sh(0, 14, 16, 2, 0.2); g.r(0, 4, 16, 4, P.woodL); g.r(0, 8, 16, 8, P.wood); g.r(0, 8, 16, 1, P.woodD); g.r(15, 4, 1, 12, P.woodD); g.r(3, 1, 8, 3, P.amberD); g.r(4, 0, 6, 1, P.amber); g.r(9, 10, 5, 5, P.woodD) },
  sofa_l: (g) => { g.sh(0, 13, 16, 3, 0.2); g.r(0, 3, 16, 7, P.roseD); g.r(1, 4, 15, 6, P.rose); g.r(0, 10, 16, 5, P.rose); g.r(0, 10, 16, 1, P.roseD); g.r(0, 3, 3, 12, P.roseD); g.r(1, 4, 2, 10, P.roseL) },
  sofa_m: (g) => { g.sh(0, 13, 16, 3, 0.2); g.r(0, 3, 16, 7, P.roseD); g.r(0, 4, 16, 6, P.rose); g.r(0, 10, 16, 5, P.rose); g.r(0, 10, 16, 1, P.roseD); g.r(7, 10, 1, 5, P.roseD) },
  sofa_r: (g) => { g.sh(0, 13, 16, 3, 0.2); g.r(0, 3, 16, 7, P.roseD); g.r(0, 4, 15, 6, P.rose); g.r(0, 10, 16, 5, P.rose); g.r(0, 10, 16, 1, P.roseD); g.r(13, 3, 3, 12, P.roseD); g.r(13, 4, 2, 10, P.roseL) },
  stove_b: (g) => { g.sh(1, 13, 14, 3, 0.25); g.r(2, 0, 12, 15, P.slateD); g.r(3, 1, 10, 13, P.slate); g.r(4, 5, 8, 7, P.ink); g.r(5, 7, 6, 4, P.amberD); g.r(6, 8, 4, 2, P.amber); g.r(7, 9, 2, 1, P.amberL) },
  stove_t: (g) => { g.r(5, 4, 6, 12, P.slateD); g.r(6, 4, 4, 12, P.slate); g.r(4, 2, 8, 3, P.slateD); g.r(5, 0, 6, 3, P.slate) },
  vend_b: (g) => { g.sh(1, 13, 14, 3, 0.25); g.r(2, 0, 12, 15, P.blueDD); g.r(3, 0, 8, 10, P.ink); g.r(4, 1, 6, 8, P.blueL); for (const [x, y, c] of [[4, 1, P.red], [6, 1, P.amber], [8, 1, P.green], [4, 4, P.green], [6, 4, P.red], [8, 4, P.amber]] as [number, number, string][]) g.r(x, y, 2, 2, c); g.r(11, 2, 2, 5, P.slate); g.r(4, 11, 6, 3, P.ink) },
  vend_t: (g) => { g.r(2, 5, 12, 11, P.blueDD); g.r(3, 5, 10, 11, P.blueD); g.r(4, 6, 8, 4, P.snowL); g.r(5, 7, 6, 2, P.amber); g.r(2, 3, 12, 3, P.blueDD); g.r(3, 4, 10, 1, P.blue) },
  coats: (g) => { g.sh(2, 13, 12, 2, 0.2); g.r(7, 0, 2, 15, P.woodD); g.r(3, 14, 10, 1, P.woodD); g.r(4, 2, 8, 1, P.woodD); g.r(3, 3, 3, 8, P.red); g.r(10, 3, 3, 9, P.blueD); g.r(3, 3, 3, 1, P.redD); g.r(10, 3, 3, 1, P.blueDD) },
  globe: (g) => { g.sh(3, 13, 10, 2, 0.2); g.r(7, 11, 2, 3, P.woodD); g.r(4, 14, 8, 1, P.woodD); g.e(8, 7, 5, 5, P.beamD); g.e(8, 7, 4, 4, P.blue); g.r(6, 5, 3, 2, P.green); g.r(9, 8, 2, 2, P.green) },
  bin: (g) => { g.sh(3, 13, 10, 2, 0.2); g.r(4, 5, 8, 10, P.slate); g.r(4, 5, 8, 2, P.slateD); g.r(3, 4, 10, 2, P.stoneD); g.r(6, 8, 1, 5, P.slateD); g.r(9, 8, 1, 5, P.slateD) },
  trunk: (g) => { g.sh(2, 12, 12, 3, 0.2); g.r(6, 0, 4, 14, P.trunk); g.r(6, 0, 1, 14, P.woodD); g.r(4, 13, 8, 2, P.snow) },
  canopy: (g) => { g.e(8, 11, 8, 6, P.greenDD); g.e(8, 8, 6.5, 5, P.greenD); g.e(8, 4.5, 4.5, 4, P.green); g.r(2, 9, 5, 2, P.snow); g.r(9, 5, 4, 2, P.snow); g.r(6, 1, 4, 2, P.snow); g.r(11, 9, 3, 1, P.snowM) },
  pine_b: (g) => { g.sh(1, 12, 14, 4, 0.22); g.r(6, 8, 4, 8, P.trunk); g.r(6, 8, 1, 8, P.woodD); g.r(3, 11, 10, 2, P.greenDD); g.r(1, 13, 14, 3, P.greenD); g.r(1, 13, 14, 1, P.snow); g.r(3, 11, 3, 1, P.snow); g.r(9, 11, 3, 1, P.snow); g.r(5, 15, 6, 1, P.snowM) },
  pine_t: (g) => { g.r(7, 0, 2, 2, P.greenD); g.r(5, 2, 6, 3, P.green); g.r(3, 5, 10, 3, P.greenD); g.r(1, 8, 14, 4, P.green); g.r(0, 12, 16, 4, P.greenD); for (const [x, y, w] of [[7, 0, 2], [5, 2, 3], [3, 5, 4], [9, 6, 3], [1, 8, 5], [9, 9, 4], [1, 12, 4], [10, 13, 4]] as [number, number, number][]) g.r(x, y, w, 1, P.snow); g.r(6, 3, 1, 1, P.greenL); g.r(11, 10, 1, 1, P.greenL) },
  pine2_b: (g) => { g.sh(2, 12, 12, 4, 0.2); g.r(7, 9, 2, 7, P.trunk); g.r(4, 12, 8, 3, P.greenD); g.r(4, 12, 8, 1, P.snow); g.r(3, 14, 10, 2, P.greenDD); g.r(4, 14, 8, 1, P.snow) },
  pine2_t: (g) => { g.r(7, 5, 2, 2, P.greenD); g.r(5, 7, 6, 3, P.green); g.r(3, 10, 10, 3, P.greenD); g.r(7, 5, 2, 1, P.snow); g.r(5, 7, 3, 1, P.snow); g.r(3, 10, 4, 1, P.snow); g.r(9, 11, 3, 1, P.snow); g.r(6, 8, 1, 1, P.greenL) },
  bush: (g) => { g.sh(1, 12, 14, 3, 0.2); g.e(8, 10, 7, 5, P.greenDD); g.e(8, 9, 6, 4.5, P.greenD); g.e(6, 8, 3, 3, P.green); g.r(3, 5, 5, 2, P.snow); g.r(9, 6, 4, 2, P.snow); g.r(6, 4, 3, 1, P.snowM) },
  bush_berry: (g) => { T.bush!(g, 0); for (const [x, y] of [[4, 9], [8, 11], [11, 9], [6, 7]] as [number, number][]) { g.p(x, y, P.red); g.p(x + 1, y, P.redD) } },
  rock: (g) => { g.sh(1, 12, 14, 3, 0.22); g.e(8, 10, 6, 4.5, P.stoneDD); g.e(8, 9, 5.5, 4, P.stoneD); g.e(7, 8, 3, 2, P.stone); g.r(4, 5, 7, 2, P.snow); g.r(5, 4, 4, 1, P.snowL) },
  rock_s: (g) => { g.sh(3, 12, 10, 2, 0.2); g.e(6, 11, 3.5, 2.5, P.stoneD); g.e(11, 12, 2.5, 2, P.stone); g.r(4, 9, 4, 1, P.snow); g.r(10, 10, 3, 1, P.snow) },
  lantern_b: (g) => { g.sh(3, 13, 10, 2, 0.2); g.r(4, 13, 8, 2, P.stoneDD); g.r(6, 3, 4, 10, P.stoneD); g.r(6, 3, 1, 10, P.stoneL); g.r(5, 1, 6, 2, P.stone); g.r(5, 1, 6, 1, P.snow) },
  lantern_t: (g) => { g.r(3, 11, 10, 2, P.stoneDD); g.r(4, 13, 8, 3, P.stoneD); g.r(5, 5, 6, 6, P.stoneD); g.r(6, 6, 4, 4, P.amber); g.r(7, 7, 2, 2, P.amberL); g.r(2, 3, 12, 3, P.stone); g.r(4, 1, 8, 2, P.stoneD); g.r(2, 3, 12, 1, P.snow); g.r(4, 1, 8, 1, P.snow) },
  lamp_base: (g) => { g.sh(3, 13, 10, 2, 0.2); g.r(7, 0, 2, 13, P.slateD); g.r(4, 13, 8, 2, P.slate); g.r(4, 12, 8, 1, P.snow) },
  lamp_top: (g) => { g.r(7, 8, 2, 8, P.slateD); g.r(4, 2, 8, 7, P.amberD); g.r(5, 3, 6, 5, P.amber); g.r(6, 4, 2, 2, P.white); g.r(3, 1, 10, 2, P.slate); g.r(4, 0, 8, 1, P.snow) },
  bench: (g) => { g.sh(0, 13, 16, 2, 0.2); g.r(1, 4, 14, 3, P.woodL); g.r(1, 7, 14, 1, P.woodD); g.r(1, 8, 14, 3, P.wood); g.r(2, 11, 2, 4, P.woodD); g.r(12, 11, 2, 4, P.woodD); g.r(1, 3, 14, 1, P.snow) },
  bench_l: (g) => { g.sh(0, 13, 16, 2, 0.2); g.r(3, 4, 13, 3, P.woodL); g.r(3, 7, 13, 1, P.woodD); g.r(3, 8, 13, 3, P.wood); g.r(4, 11, 2, 4, P.woodD); g.r(3, 3, 13, 1, P.snow); g.r(1, 3, 2, 8, P.woodD) },
  bench_r: (g) => { g.sh(0, 13, 16, 2, 0.2); g.r(0, 4, 13, 3, P.woodL); g.r(0, 7, 13, 1, P.woodD); g.r(0, 8, 13, 3, P.wood); g.r(10, 11, 2, 4, P.woodD); g.r(0, 3, 13, 1, P.snow); g.r(13, 3, 2, 8, P.woodD) },
  log: (g) => { g.sh(0, 12, 16, 3, 0.22); g.r(0, 5, 16, 8, P.woodD); g.r(0, 5, 16, 3, P.wood); g.r(0, 5, 16, 1, P.woodL); g.e(14, 9, 2, 4, P.woodL); g.p(14, 9, P.woodD); g.r(2, 3, 9, 2, P.snow) },
  campfire: (g) => { g.sh(2, 12, 12, 3, 0.25); g.e(8, 12, 6, 2.5, P.stoneDD); g.r(3, 10, 10, 2, P.stoneD); g.r(4, 9, 8, 2, P.woodDD); g.r(5, 11, 6, 1, P.woodD); g.e(8, 7, 3, 4, P.amberD); g.e(8, 7, 2, 3, P.amber); g.r(7, 5, 2, 3, P.amberL); g.p(8, 2, P.amberD); g.p(8, 3, P.amber) },
  snowman_b: (g) => { g.sh(2, 13, 12, 2, 0.15); g.e(8, 9, 6.5, 6, P.snowD); g.e(8, 8.5, 6, 5.5, P.snow); g.p(8, 7, P.ink); g.p(8, 10, P.ink); g.r(2, 5, 3, 1, P.woodD); g.r(11, 5, 3, 1, P.woodD) },
  snowman_t: (g) => { g.e(8, 11, 5, 4.5, P.snow); g.p(6, 10, P.ink); g.p(10, 10, P.ink); g.r(7, 12, 4, 1, P.amberD); g.r(4, 6, 8, 1, P.slateD); g.r(6, 3, 4, 3, P.slateD); g.r(6, 5, 4, 1, P.red) },
  torii_bl: (g) => { g.sh(1, 13, 14, 3, 0.2); g.r(3, 0, 3, 16, P.red); g.r(3, 0, 1, 16, P.redD); g.r(2, 14, 5, 2, P.stoneD) },
  torii_br: (g) => { g.sh(1, 13, 14, 3, 0.2); g.r(10, 0, 3, 16, P.red); g.r(10, 0, 1, 16, P.redD); g.r(9, 14, 5, 2, P.stoneD) },
  torii_tl: (g) => { g.r(3, 4, 3, 12, P.red); g.r(3, 4, 1, 12, P.redD); g.r(0, 2, 16, 3, P.slateDD); g.r(0, 1, 16, 1, P.snow); g.r(0, 5, 16, 1, P.redD); g.r(3, 6, 13, 2, P.red) },
  torii_tr: (g) => { g.r(10, 4, 3, 12, P.red); g.r(10, 4, 1, 12, P.redD); g.r(0, 2, 16, 3, P.slateDD); g.r(0, 1, 16, 1, P.snow); g.r(0, 5, 16, 1, P.redD); g.r(0, 6, 13, 2, P.red) },
  torii_tm: (g) => { g.r(0, 2, 16, 3, P.slateDD); g.r(0, 1, 16, 1, P.snow); g.r(0, 5, 16, 1, P.redD); g.r(0, 6, 16, 2, P.red); g.r(6, 8, 4, 4, P.slateDD); g.r(7, 9, 2, 2, P.amber) },
  shrine_b: (g) => { g.sh(0, 13, 16, 3, 0.25); g.r(2, 6, 12, 9, P.plasterD); g.r(2, 6, 12, 1, P.woodD); g.r(3, 8, 10, 6, P.woodD); g.r(5, 9, 6, 5, P.ink); g.r(7, 11, 2, 2, P.amber); g.r(1, 14, 14, 2, P.stoneD) },
  shrine_t: (g) => { g.r(0, 10, 16, 6, P.roof); g.r(0, 10, 16, 2, P.snow); g.r(2, 6, 12, 5, P.roofL); g.r(2, 6, 12, 2, P.snow); g.r(5, 2, 6, 5, P.roof); g.r(5, 2, 6, 2, P.snow); g.r(0, 15, 16, 1, P.roofD) },
  sign: (g) => { g.sh(3, 13, 10, 2, 0.2); g.r(7, 8, 2, 7, P.woodD); g.r(2, 2, 12, 7, P.woodL); g.r(2, 2, 12, 1, P.snow); g.r(2, 8, 12, 1, P.woodD); g.r(4, 4, 8, 1, P.woodDD); g.r(4, 6, 5, 1, P.woodDD); g.p(12, 5, P.amber) },
  crate: (g) => { g.sh(1, 13, 14, 2, 0.2); g.r(2, 4, 12, 11, P.woodL); g.r(2, 4, 12, 1, P.snow); g.r(2, 5, 12, 1, P.woodD); g.r(2, 14, 12, 1, P.woodD); g.r(2, 5, 1, 10, P.woodD); g.r(13, 5, 1, 10, P.woodD); g.r(7, 5, 2, 10, P.woodD) },
  barrel: (g) => { g.sh(2, 13, 12, 2, 0.2); g.e(8, 9, 6, 6, P.woodD); g.e(8, 8, 5, 6, P.wood); g.r(3, 7, 10, 1, P.slate); g.r(3, 11, 10, 1, P.slate); g.r(4, 2, 8, 2, P.snow); g.r(5, 4, 6, 1, P.snowM) },
  lights_l: (g) => { g.r(0, 4, 16, 1, P.slateD); for (const x of [3, 9, 14]) { g.p(x, 5, P.amber); g.p(x, 6, P.amberL) } g.r(0, 1, 2, 15, P.slateD) },
  lights_m: (g) => { g.r(0, 5, 16, 1, P.slateD); for (const x of [2, 8, 13]) { g.p(x, 6, P.amber); g.p(x, 7, P.amberL) } },
  lights_r: (g) => { g.r(0, 4, 16, 1, P.slateD); for (const x of [2, 7, 13]) { g.p(x, 5, P.amber); g.p(x, 6, P.amberL) } g.r(14, 1, 2, 15, P.slateD) },
  planter: (g) => { g.sh(1, 13, 14, 2, 0.2); g.r(1, 8, 14, 7, P.woodD); g.r(1, 8, 14, 2, P.wood); g.r(2, 5, 12, 4, P.snow); for (const [x, y, c] of [[3, 3, P.rose], [7, 2, P.amber], [11, 3, P.blue], [5, 5, P.red]] as [number, number, string][]) { g.r(x, y, 2, 2, c); g.p(x, y + 2, P.greenD) } },
  stump: (g) => { g.sh(2, 12, 12, 3, 0.2); g.e(8, 10, 5.5, 4, P.woodD); g.e(8, 8, 5.5, 4, P.woodL); g.e(8, 8, 3, 2, P.wood); g.p(8, 8, P.woodD); g.r(4, 5, 8, 1, P.snow) },
  drift: (g) => { g.e(5, 12, 6, 3, P.snowM); g.e(11, 13, 5, 2.5, P.snowM); g.e(5, 11, 5, 2, P.snow); g.e(11, 12, 4, 2, P.snowL) },
}
function desk(g: G) { g.sh(0, 13, 16, 3, 0.2); g.r(0, 3, 16, 7, P.woodL); g.r(0, 3, 16, 1, P.woodLL); g.r(0, 10, 16, 5, P.wood); g.r(0, 10, 16, 1, P.woodD); g.r(0, 14, 16, 1, P.woodD); g.r(2, 11, 4, 3, P.woodD); g.r(10, 11, 4, 3, P.woodD) }
function shelf(g: G, top: string[], bottom: string[]) {
  g.r(0, 0, 16, 16, P.woodD); g.r(0, 0, 16, 1, P.woodDD)
  for (const [r, books] of [[1, top], [8, bottom]] as [number, string[]][]) { g.r(1, r, 14, 6, P.woodDD); books.forEach((col, i) => g.r(2 + i * 2, r + (i % 3 === 0 ? 1 : 0), 2, 6 - (i % 3 === 0 ? 1 : 0), col)) }
  g.r(0, 7, 16, 1, P.wood); g.r(0, 15, 16, 1, P.woodDD)
}

// the Board, drawn at 48x32 then cut into six tiles: a post-and-cork notice board with pinned notes
function board(): Canvas {
  const b = new Canvas(48, 32)
  b.rect(2, 0, 4, 32, P.woodD); b.rect(42, 0, 4, 32, P.woodD); b.rect(0, 1, 48, 3, P.woodD); b.rect(0, 1, 48, 1, P.wood); b.rect(4, 4, 40, 22, P.wood); b.rect(6, 6, 36, 18, '#c9a37a')
  for (const [x, y, c] of [[8, 8, P.white], [19, 9, P.blueL], [31, 8, P.amber], [10, 16, P.rose], [24, 15, P.white], [35, 16, P.greenL]] as [number, number, string][]) { b.rect(x, y, 8, 7, c); b.px(x + 3, y, P.red); b.rect(x + 1, y + 2, 6, 1, P.slate); b.rect(x + 1, y + 4, 4, 1, P.slate) }
  b.rect(0, 26, 48, 2, P.snow); b.rect(2, 28, 4, 4, P.woodD); b.rect(42, 28, 4, 4, P.woodD)
  return b
}

/** Paint every tile into `tiles`; `at(name)` gives its pixel origin. */
export function paintTiles(tiles: Canvas, at: (n: string) => readonly [number, number], names: readonly string[]) {
  const rug = (pre: string, c: string, cd: string, cl: string, edge: string) => {
    const parts: Record<string, [boolean, boolean, boolean, boolean]> = { tl: [1, 0, 0, 1], t: [1, 0, 0, 0], tr: [1, 1, 0, 0], l: [0, 0, 0, 1], c: [0, 0, 0, 0], r: [0, 1, 0, 0], bl: [0, 0, 1, 1], b: [0, 0, 1, 0], br: [0, 1, 1, 0] } as never
    for (const [k, [n, e, s, w]] of Object.entries(parts)) T[`${pre}_${k}` as TileName] = (g, seed) => {
      g.r(0, 0, 16, 16, c)
      for (const [x, y] of [[3, 4], [10, 9], [6, 13], [12, 3]] as [number, number][]) g.p(x, y, cl)
      if (n) { g.r(0, 0, 16, 2, edge); g.r(0, 2, 16, 1, cd) } if (s) { g.r(0, 14, 16, 2, edge); g.r(0, 13, 16, 1, cd) }
      if (w) { g.r(0, 0, 2, 16, edge); g.r(2, 0, 1, 16, cd) } if (e) { g.r(14, 0, 2, 16, edge); g.r(13, 0, 1, 16, cd) }
      if (!n && !s && !w && !e && seed % 3 === 0) g.p(8, 8, cd)
    }
  }
  rug('rug', P.roseL, P.rose, P.white, P.roseD); rug('mat', '#e0a487', '#c97b6a', '#f0c3a8', '#a85a4e')
  names.forEach((n, i) => {
    const [ox, oy] = at(n), g = painter(tiles, ox, oy)
    const auto = /^(path|water)_(\d+)$/.exec(n)
    if (auto) return (auto[1] === 'path' ? cobble : pond)(g, Number(auto[2]), i)
    T[n as TileName]?.(g, i)
  })
  const b = board()
  for (let i = 0; i < 6; i++) { const [ox, oy] = at(`board${i}`); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = ((Math.floor(i / 3) * 16 + y) * 48 + (i % 3) * 16 + x) * 4; if (b.data[k + 3]) tiles.data.set(b.data.subarray(k, k + 4), ((oy + y) * tiles.w + ox + x) * 4) } }
}
void h
