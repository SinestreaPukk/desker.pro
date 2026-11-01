// Generates apps/village/public/maps/snowy_campus.json (Tiled-compatible, 40x28 tiles, SPEC §4.2). This script is the source: edit and re-run.
//   node scripts/gen-snowy-campus.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { gid, TILE_NAMES, TILE_COLS, type TileName } from './village-tiles.ts'

const W = 40, H = 28, T = 16
const layer = () => new Array<number>(W * H).fill(0)
const L = { ground: layer(), floor: layer(), walls: layer(), furniture_below: layer(), furniture_above: layer() }
type LayerName = keyof typeof L
const put = (l: LayerName, x: number, y: number, n: TileName) => { if (x >= 0 && y >= 0 && x < W && y < H) L[l][y * W + x] = gid(n) }
const fill = (l: LayerName, x: number, y: number, w: number, h: number, n: TileName) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(l, x + i, y + j, n) }
const hash = (x: number, y: number) => (Math.imul(x * 73856093 ^ y * 19349663, 83492791) >>> 0) % 100

type Obj = { id: number; name: string; type: string; x: number; y: number; width: number; height: number; visible: boolean; rotation: 0; properties?: { name: string; type: string; value: string | number | boolean }[] }
let nextId = 1
const rect = (name: string, type: string, x: number, y: number, w = 1, h = 1, props: Record<string, string | number | boolean> = {}): Obj => ({
  id: nextId++, name, type, x: x * T, y: y * T, width: w * T, height: h * T, visible: true, rotation: 0,
  ...(Object.keys(props).length && { properties: Object.entries(props).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'int' : typeof value === 'boolean' ? 'bool' : 'string', value })) }),
})
const zones: Obj[] = [], sitSpots: Obj[] = [], spawn: Obj[] = [], interactables: Obj[] = []

// ---- ground: snow everywhere, stone paths ---------------------------------------------------------------------------
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put('ground', x, y, hash(x, y) < 22 ? 'snow1' : 'snow0')
const path = (x: number, y: number, w: number, h: number) => fill('ground', x, y, w, h, 'path')
path(15, 11, 10, 8) // plaza
path(8, 11, 2, 4); path(6, 14, 9, 2); path(6, 16, 2, 2) // library door and lounge door down to the plaza
path(30, 11, 2, 4); path(25, 14, 7, 2); path(28, 16, 2, 2) // tables door and the garden entrance

// ---- buildings: wall ring, wood floor, door gap -----------------------------------------------------------------------
function building(x: number, y: number, w: number, h: number, doorX: number[], doorY: number, windows: number[], windowY: number) {
  fill('floor', x + 1, y + 1, w - 2, h - 2, 'wood')
  for (let i = 0; i < w; i++) for (const j of [0, h - 1]) put('walls', x + i, y + j, 'wall')
  for (let j = 0; j < h; j++) for (const i of [0, w - 1]) put('walls', x + i, y + j, 'wall')
  for (const wx of windows) put('walls', wx, windowY, 'window')
  for (const dx of doorX) { put('walls', dx, doorY, 'wall'); L.walls[doorY * W + dx] = 0; put('floor', dx, doorY, 'door_mat'); put('furniture_below', dx, doorY, 'snow0'); L.furniture_below[doorY * W + dx] = 0 }
}
building(1, 1, 15, 10, [8, 9], 10, [4, 7, 10, 13], 1) // Library
building(24, 1, 15, 10, [30, 31], 10, [27, 30, 33, 36], 1) // Group Tables
building(1, 18, 13, 9, [6, 7], 18, [3, 10], 26) // Lounge

// ---- border: fence all round -----------------------------------------------------------------------------------------
for (let x = 0; x < W; x++) { put('walls', x, 0, 'fence'); put('walls', x, H - 1, 'fence') }
for (let y = 0; y < H; y++) { put('walls', 0, y, 'fence'); put('walls', W - 1, y, 'fence') }

// ---- Library: shelves, 2 rows x 12 desks, chairs (sit spots) ------------------------------------------------------------
for (let x = 2; x <= 14; x++) put('furniture_below', x, 2, 'shelf')
let n = 0
for (const dy of [3, 6]) for (let x = 3; x <= 14; x++) {
  n++; put('furniture_below', x, dy, 'desk'); put('furniture_below', x, dy + 1, 'chair')
  sitSpots.push(rect(`lib-desk-${String(n).padStart(2, '0')}`, 'sitSpot', x, dy + 1, 1, 1, { kind: 'desk', facing: 'up' }))
}
put('furniture_below', 2, 9, 'plant'); put('furniture_below', 14, 9, 'plant')

// ---- Group Tables: 4 tables x 4 seats --------------------------------------------------------------------------------------
let t = 0
for (const [tx, ty] of [[27, 4], [33, 4], [27, 7], [33, 7]]) {
  t++; fill('furniture_below', tx, ty, 2, 1, 'table')
  let s = 0
  for (const [sx, sy, facing] of [[tx, ty - 1, 'down'], [tx + 1, ty - 1, 'down'], [tx, ty + 1, 'up'], [tx + 1, ty + 1, 'up']] as [number, number, string][]) {
    s++; put('furniture_below', sx, sy, 'chair'); sitSpots.push(rect(`table-${t}-seat-${s}`, 'sitSpot', sx, sy, 1, 1, { kind: 'table', table: t, facing }))
  }
}
put('furniture_below', 25, 2, 'plant'); put('furniture_below', 37, 2, 'plant'); put('furniture_below', 37, 9, 'plant')

// ---- Lounge: kotatsu, 8 cushions, tea counter ---------------------------------------------------------------------------
fill('furniture_below', 6, 22, 2, 2, 'kotatsu')
let c = 0
for (const [cx, cy, facing] of [[5, 22, 'right'], [5, 23, 'right'], [8, 22, 'left'], [8, 23, 'left'], [6, 21, 'down'], [7, 21, 'down'], [6, 24, 'up'], [7, 24, 'up']] as [number, number, string][]) {
  c++; put('furniture_below', cx, cy, 'cushion'); sitSpots.push(rect(`lounge-cushion-${c}`, 'sitSpot', cx, cy, 1, 1, { kind: 'cushion', facing }))
}
fill('furniture_below', 10, 19, 3, 1, 'counter'); put('furniture_below', 2, 19, 'plant'); put('furniture_below', 12, 25, 'plant')

// ---- Plaza: Board, lamps, benches, snowman --------------------------------------------------------------------------------
;(['board0', 'board1', 'board2', 'board3', 'board4', 'board5'] as TileName[]).forEach((b, i) => put('furniture_below', 18 + (i % 3), 11 + Math.floor(i / 3), b))
interactables.push(rect('board', 'interactable', 18, 11, 3, 2, { kind: 'board' }))
for (const lx of [16, 23]) { put('furniture_below', lx, 12, 'lamp_base'); put('furniture_above', lx, 11, 'lamp_top') }
put('furniture_below', 16, 17, 'bench'); put('furniture_below', 23, 17, 'bench')
put('furniture_below', 22, 16, 'snowman_b'); put('furniture_above', 22, 15, 'snowman_t')
;[[17, 11], [17, 12], [21, 11], [21, 12], [17, 13], [18, 13], [20, 13], [21, 13]].forEach(([x, y], i) => spawn.push(rect(`spawn-${i + 1}`, 'spawn', x, y)))
for (const [dx, dy, name] of [[8, 10, 'library-door-1'], [9, 10, 'library-door-2'], [30, 10, 'tables-door-1'], [31, 10, 'tables-door-2'], [6, 18, 'lounge-door-1'], [7, 18, 'lounge-door-2']] as [number, number, string][])
  interactables.push(rect(name, 'interactable', dx, dy, 1, 1, { kind: 'door' }))

// ---- Garden: trees, pond, frozen bench -----------------------------------------------------------------------------------
fill('furniture_below', 32, 21, 4, 3, 'water')
for (const [x, y] of [[27, 20], [36, 19], [28, 24], [37, 24], [31, 25], [34, 26 - 1], [26, 22], [38 - 1, 21]]) { put('furniture_below', x, y, 'trunk'); put('furniture_above', x, y - 1, 'canopy') }
put('furniture_below', 30, 22, 'bench')
for (const [x, y] of [[12, 15], [14, 16], [20, 20], [22, 22], [16, 24], [3, 14], [37, 14], [21, 26 - 1]]) { put('furniture_below', x, y, 'trunk'); put('furniture_above', x, y - 1, 'canopy') } // a few outside trees

// ---- zones, in lookup order: first match wins; anywhere else is the plaza -------------------------------------------------------
zones.push(rect('library', 'zone', 1, 1, 15, 10, { zone: 'library', quiet: true }), rect('tables', 'zone', 24, 1, 15, 10, { zone: 'tables' }),
  rect('lounge', 'zone', 1, 18, 13, 9, { zone: 'lounge' }), rect('garden', 'zone', 26, 18, 13, 9, { zone: 'garden' }), rect('plaza', 'zone', 15, 11, 10, 8, { zone: 'plaza' }))

// ---- collision: every wall and every piece of furniture blocks (run-length merged per row) ----------------------------------------------
const collision: Obj[] = []
for (let y = 0; y < H; y++) {
  let x = 0
  while (x < W) {
    const solid = (i: number) => L.walls[y * W + i] || L.furniture_below[y * W + i]
    if (!solid(x)) { x++; continue }
    let e = x; while (e < W && solid(e)) e++
    collision.push(rect('wall', 'collision', x, y, e - x, 1)); x = e
  }
}
// sit spots stay out of the way: you stand beside a chair and press X, you do not walk onto it.

const tl = (name: LayerName, id: number) => ({ id, name, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: L[name] })
const ol = (name: string, id: number, objects: Obj[]) => ({ id, name, type: 'objectgroup', draworder: 'topdown', opacity: 1, visible: true, x: 0, y: 0, objects })
const map = {
  compressionlevel: -1, width: W, height: H, tilewidth: T, tileheight: T, infinite: false, orientation: 'orthogonal', renderorder: 'right-down', tiledversion: '1.10.2', type: 'map', version: '1.10', nextlayerid: 11, nextobjectid: nextId,
  tilesets: [{ firstgid: 1, name: 'tiles', image: '../assets/tiles.png', imagewidth: TILE_COLS * (T + 2), imageheight: Math.ceil(TILE_NAMES.length / TILE_COLS) * (T + 2), tilewidth: T, tileheight: T, tilecount: TILE_NAMES.length, columns: TILE_COLS, margin: 1, spacing: 2 }],
  layers: [tl('ground', 1), tl('floor', 2), tl('walls', 3), tl('furniture_below', 4), tl('furniture_above', 5), ol('collision', 6, collision), ol('zones', 7, zones), ol('sitSpots', 8, sitSpots), ol('spawn', 9, spawn), ol('interactables', 10, interactables)],
}
const out = new URL('../apps/village/public/maps/', import.meta.url).pathname
mkdirSync(out, { recursive: true }); writeFileSync(out + 'snowy_campus.json', JSON.stringify(map) + '\n')
console.log(`snowy_campus.json: ${collision.length} collision runs, ${sitSpots.length} sit spots (${sitSpots.filter((s) => s.name.startsWith('lib')).length} desks), ${spawn.length} spawns`)
