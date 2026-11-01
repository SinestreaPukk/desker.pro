// Generates apps/village/public/maps/snowy_campus.json (Tiled-compatible, 40x28 tiles, SPEC §4.2). This script is the source: edit and re-run.
//   node scripts/gen-snowy-campus.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { autoMask, gid, TILE_NAMES, TILE_COLS, type TileName } from './village-tiles.ts'

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

// ---- ground: snow with a little variety, cobbled paths and a pond with soft banks ------------------------------------------------------
const pathTiles = new Set<number>(), pondTiles = new Set<number>()
const addPath = (x: number, y: number, w: number, h: number) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pathTiles.add((y + j) * W + x + i) }
addPath(15, 11, 10, 8) // plaza
addPath(8, 11, 2, 4); addPath(6, 14, 9, 2); addPath(6, 16, 2, 3) // library door and lounge door down to the plaza
addPath(30, 11, 2, 4); addPath(25, 14, 7, 2); addPath(28, 16, 2, 5); addPath(28, 20, 4, 1) // tables door, and the garden path down to the pond
addPath(21, 4, 2, 7) // north to the shrine
for (let y = 22; y < 25; y++) for (let x = 32; x < 36; x++) pondTiles.add(y * W + x)
for (const [dx, dy] of [[8, 10], [9, 10], [30, 10], [31, 10], [6, 18], [7, 18]]) pathTiles.add(dy * W + dx) // the paths run under the door mats
const inSet = (set: Set<number>) => (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || set.has(y * W + x)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const r = hash(x, y), i = y * W + x
  if (pathTiles.has(i)) L.ground[i] = gid(`path_${autoMask((dx, dy) => inSet(pathTiles)(x + dx, y + dy))}` as TileName)
  else if (pondTiles.has(i)) L.ground[i] = gid(`water_${autoMask((dx, dy) => inSet(pondTiles)(x + dx, y + dy))}` as TileName)
  else L.ground[i] = gid(r < 60 ? 'snow0' : r < 76 ? 'snow1' : r < 83 ? 'snow2' : r < 88 ? 'snow3' : 'snow4')
}

// ---- buildings: roof, wall faces with decor, side beams, snow-capped south wall, per-room floors --------------------------------------------
function building(x: number, y: number, w: number, h: number, doors: { x: number; side: 'n' | 's' }[], decor: Record<number, TileName>, floor: (x: number, y: number) => TileName) {
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) put('floor', x + i, y + j, floor(x + i, y + j))
  for (let i = 0; i < w; i++) {
    const wx = x + i, first = i === 0, last = i === w - 1
    put('walls', wx, y, first ? 'wall_nw' : last ? 'wall_ne' : decor[wx] ?? 'wall_n')
    put('walls', wx, y + h - 1, first ? 'wall_sw' : last ? 'wall_se' : 'wall_s')
    put('walls', wx, y - 1, first ? 'roof_l' : last ? 'roof_r' : 'roof_m') // the roof's eave above the north wall
  }
  for (let j = 1; j < h - 1; j++) { put('walls', x, y + j, 'wall_w'); put('walls', x + w - 1, y + j, 'wall_e') }
  for (const d of doors) {
    const dy = d.side === 'n' ? y : y + h - 1
    L.walls[dy * W + d.x] = 0; put('floor', d.x, dy, 'door_mat'); if (d.side === 'n') L.walls[(y - 1) * W + d.x] = 0
  }
}
const wood = (x: number, y: number): TileName => (y === 2 ? 'wood_s' : (x + y) % 7 === 0 ? 'wood_d' : 'wood')
const checker = (x: number, y: number): TileName => (y === 2 ? 'tile_s' : (x + y) % 2 ? 'tile_a' : 'tile_b')
const tatami = (_x: number, y: number): TileName => (y === 19 ? 'tatami_s' : 'tatami')
building(1, 1, 15, 10, [{ x: 8, side: 's' }, { x: 9, side: 's' }], { 2: 'wall_banner', 4: 'wall_win', 6: 'wall_poster', 7: 'wall_win', 9: 'wall_clock', 10: 'wall_win', 12: 'wall_poster', 13: 'wall_win' }, wood) // Library
building(24, 1, 15, 10, [{ x: 30, side: 's' }, { x: 31, side: 's' }], { 25: 'wall_poster', 27: 'wall_win', 29: 'wall_clock', 30: 'wall_win', 31: 'wall_boardl', 32: 'wall_boardr', 33: 'wall_win', 35: 'wall_banner', 36: 'wall_win' }, checker) // Group Tables
building(1, 18, 13, 9, [{ x: 6, side: 'n' }, { x: 7, side: 'n' }], { 3: 'wall_win_s', 5: 'wall_poster', 9: 'wall_banner', 10: 'wall_win_s', 12: 'wall_poster' }, tatami) // Lounge

// ---- border: fence all round (the buildings' roofs take the place of the fence along the top) -----------------------------------------------
for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (!L.walls[y * W + x]) put('walls', x, y, x % 8 === 0 ? 'fence_post' : 'fence')
for (let y = 0; y < H; y++) for (const x of [0, W - 1]) put('walls', x, y, y % 8 === 0 ? 'fence_post' : 'fence')
const free = (x: number, y: number) => !L.furniture_below[y * W + x] && !L.walls[y * W + x] && !pathTiles.has(y * W + x) && !pondTiles.has(y * W + x)
const tree = (x: number, y: number) => { put('furniture_below', x, y, 'trunk'); put('furniture_above', x, y - 1, 'canopy') }
const pine = (x: number, y: number, big = true) => { put('furniture_below', x, y, big ? 'pine_b' : 'pine2_b'); put('furniture_above', x, y - 1, big ? 'pine_t' : 'pine2_t') }
const grove = (x: number, y: number) => { if (free(x, y)) (x * 3 + y) % 4 === 0 ? tree(x, y) : pine(x, y, (x + y) % 2 === 0) }
const seat = (name: string, x: number, y: number, kind: string, facing: string, extra: Record<string, string | number | boolean> = {}) => sitSpots.push(rect(name, 'sitSpot', x, y, 1, 1, { kind, facing, ...extra }))

// ---- Library: shelves, rugs, 2 rows x 12 desks, chairs (sit spots) ------------------------------------------------------------------------
const shelves: TileName[] = ['shelf_a', 'shelf_b', 'shelf_c']
for (let x = 2; x <= 14; x++) put('furniture_below', x, 2, shelves[(x * 7 + (x >> 1)) % 3])
for (let x = 2; x <= 14; x++) put('floor', x, 5, x === 2 ? 'carpet_l' : x === 14 ? 'carpet_r' : 'carpet') // a reading-room runner between the desk rows
for (let i = 6; i < 12; i++) { put('floor', i, 8, i === 6 ? 'mat_tl' : i === 11 ? 'mat_tr' : 'mat_t'); put('floor', i, 9, i === 6 ? 'mat_bl' : i === 11 ? 'mat_br' : 'mat_b') }
let n = 0
const desks: TileName[] = ['desk_a', 'desk_b', 'desk_c']
for (const dy of [3, 6]) for (let x = 3; x <= 14; x++) {
  n++; put('furniture_below', x, dy, desks[(x + dy) % 3]); put('furniture_below', x, dy + 1, dy === 3 ? 'chair' : 'chair_b')
  seat(`lib-desk-${String(n).padStart(2, '0')}`, x, dy + 1, 'desk', 'up')
}
put('furniture_below', 2, 9, 'plant_tall_b'); put('furniture_above', 2, 8, 'plant_tall_t'); put('furniture_below', 14, 9, 'plant'); put('furniture_below', 5, 9, 'coats'); put('furniture_below', 13, 9, 'bin'); put('furniture_below', 3, 9, 'globe')

// ---- Group Tables: 4 tables x 4 seats, a whiteboard on the wall, vending machine -------------------------------------------------------------
let t = 0
for (const [tx, ty] of [[27, 4], [33, 4], [27, 7], [33, 7]]) {
  t++; put('furniture_below', tx, ty, 'table_a'); put('furniture_below', tx + 1, ty, 'table_b')
  let s = 0
  for (const [sx, sy, facing] of [[tx, ty - 1, 'down'], [tx + 1, ty - 1, 'down'], [tx, ty + 1, 'up'], [tx + 1, ty + 1, 'up']] as [number, number, string][]) {
    s++; put('furniture_below', sx, sy, 'chair_b'); seat(`table-${t}-seat-${s}`, sx, sy, 'table', facing, { table: t })
  }
}
put('furniture_below', 25, 2, 'plant'); put('furniture_below', 37, 2, 'plant_tall_b'); put('furniture_above', 37, 1, 'plant_tall_t'); put('furniture_below', 25, 8, 'vend_t'); put('furniture_below', 25, 9, 'vend_b'); put('furniture_below', 37, 9, 'plant'); put('furniture_below', 37, 8, 'bin')

// ---- Lounge: rug, kotatsu, 8 cushions, tea counter, stove, sofa ------------------------------------------------------------------------------
for (let y = 20; y <= 25; y++) for (let x = 4; x <= 9; x++) put('floor', x, y, `rug_${y === 20 ? 't' : y === 25 ? 'b' : ''}${x === 4 ? 'l' : x === 9 ? 'r' : ''}`.replace(/^rug_$/, 'rug_c') as TileName)
put('furniture_below', 6, 22, 'kotatsu_tl'); put('furniture_below', 7, 22, 'kotatsu_tr'); put('furniture_below', 6, 23, 'kotatsu_bl'); put('furniture_below', 7, 23, 'kotatsu_br')
let c = 0
for (const [cx, cy, facing] of [[5, 22, 'right'], [5, 23, 'right'], [8, 22, 'left'], [8, 23, 'left'], [6, 21, 'down'], [7, 21, 'down'], [6, 24, 'up'], [7, 24, 'up']] as [number, number, string][]) {
  c++; put('furniture_below', cx, cy, c % 2 ? 'cushion' : 'cushion_b'); seat(`lounge-cushion-${c}`, cx, cy, 'cushion', facing)
}
put('furniture_below', 10, 19, 'counter_l'); put('furniture_below', 11, 19, 'counter_m'); put('furniture_below', 12, 19, 'counter_r')
put('furniture_below', 2, 20, 'stove_b'); put('furniture_below', 2, 19, 'stove_t')
;(['sofa_l', 'sofa_m', 'sofa_r'] as TileName[]).forEach((sf, i) => { put('furniture_below', 10 + i, 23, sf); seat(`lounge-sofa-${i + 1}`, 10 + i, 23, 'sofa', 'down') })
put('furniture_below', 12, 25, 'plant_tall_b'); put('furniture_above', 12, 24, 'plant_tall_t'); put('furniture_below', 2, 25, 'plant'); put('furniture_below', 12, 21, 'bin'); put('furniture_below', 2, 23, 'crate'); put('furniture_below', 2, 24, 'barrel')

// ---- Plaza: Board, lamps, benches, snowman, planters --------------------------------------------------------------------------------------
;(['board0', 'board1', 'board2', 'board3', 'board4', 'board5'] as TileName[]).forEach((b, i) => put('furniture_below', 18 + (i % 3), 11 + Math.floor(i / 3), b))
interactables.push(rect('board', 'interactable', 18, 11, 3, 2, { kind: 'board' }))
for (const lx of [16, 23]) { put('furniture_below', lx, 12, 'lamp_base'); put('furniture_above', lx, 11, 'lamp_top') }
put('furniture_below', 16, 18, 'bench'); seat('plaza-bench-1', 16, 18, 'bench', 'down')
put('furniture_below', 19, 18, 'bench_l'); put('furniture_below', 20, 18, 'bench_r'); seat('plaza-bench-2', 19, 18, 'bench', 'down'); seat('plaza-bench-3', 20, 18, 'bench', 'down')
put('furniture_below', 23, 18, 'bench'); seat('plaza-bench-4', 23, 18, 'bench', 'down')
put('furniture_below', 22, 16, 'snowman_b'); put('furniture_above', 22, 15, 'snowman_t')
put('furniture_below', 15, 11, 'planter'); put('furniture_below', 24, 11, 'planter'); put('furniture_below', 17, 15, 'rock_s')
;[[17, 11], [17, 12], [21, 11], [21, 12], [17, 13], [18, 13], [20, 13], [21, 13]].forEach(([x, y], i) => spawn.push(rect(`spawn-${i + 1}`, 'spawn', x, y)))
for (const [dx, dy, name] of [[8, 10, 'library-door-1'], [9, 10, 'library-door-2'], [30, 10, 'tables-door-1'], [31, 10, 'tables-door-2'], [6, 18, 'lounge-door-1'], [7, 18, 'lounge-door-2']] as [number, number, string][])
  interactables.push(rect(name, 'interactable', dx, dy, 1, 1, { kind: 'door' }))

// ---- North: a small shrine up the path, guarded by lanterns and pines ----------------------------------------------------------------------------
put('furniture_below', 20, 6, 'torii_bl'); put('furniture_below', 23, 6, 'torii_br')
put('furniture_above', 20, 5, 'torii_tl'); put('furniture_above', 21, 5, 'torii_tm'); put('furniture_above', 22, 5, 'torii_tm'); put('furniture_above', 23, 5, 'torii_tr')
put('furniture_below', 21, 3, 'shrine_b'); put('furniture_below', 22, 3, 'shrine_b'); put('furniture_above', 21, 2, 'shrine_t'); put('furniture_above', 22, 2, 'shrine_t')
for (const [lx, ly] of [[20, 9], [23, 9], [20, 4], [23, 4]]) { put('furniture_below', lx, ly, 'lantern_b'); put('furniture_above', lx, ly - 1, 'lantern_t') }
for (const [x, y] of [[17, 4], [18, 8], [16, 6], [18, 3], [17, 9], [19, 6]]) pine(x, y, (x + y) % 2 === 0)
put('furniture_below', 19, 9, 'bush'); put('furniture_below', 16, 9, 'rock'); put('furniture_below', 19, 3, 'sign')

// ---- Garden: trees, pond, benches, stone path, stumps ---------------------------------------------------------------------------------------
put('furniture_below', 30, 22, 'bench_r'); seat('garden-bench-1', 30, 22, 'bench', 'right')
put('furniture_below', 34, 21, 'bench'); seat('garden-bench-2', 34, 21, 'bench', 'down')
for (const [x, y] of [[27, 20], [37, 19], [28, 24], [37, 24], [31, 25], [34, 26 - 1], [26, 22], [37, 21]]) grove(x, y)
for (const [x, y, k] of [[36, 22, 'rock'], [31, 23, 'bush_berry'], [33, 25, 'rock_s'], [27, 25, 'stump'], [29, 19, 'bush'], [36, 20, 'drift'], [35, 25, 'bush']] as [number, number, TileName][]) if (free(x, y)) put('furniture_below', x, y, k)

// ---- Elsewhere outside: fireside, groves, a little life ------------------------------------------------------------------------------------------
put('furniture_below', 20, 23, 'campfire')
for (const [lx, ly, facing] of [[18, 23, 'right'], [22, 23, 'left'], [20, 21, 'down'], [20, 25, 'up']] as [number, number, string][]) { put('furniture_below', lx, ly, 'log'); seat(`camp-log-${lx}-${ly}`, lx, ly, 'log', facing) }
for (const [x, y] of [[12, 15], [14, 20], [16, 21], [23, 20], [25, 22], [16, 25], [24, 25], [22, 25], [3, 14], [2, 12], [37, 14], [35, 13], [33, 16], [4, 16], [13, 22]]) grove(x, y)
for (const [x, y, k] of [[4, 13, 'bush'], [5, 12, 'rock_s'], [34, 14, 'bush_berry'], [38, 13, 'rock'], [36, 16, 'bush'], [15, 22, 'bush'], [24, 23, 'rock_s'], [13, 14, 'drift'], [26, 13, 'drift'], [5, 14, 'sign'], [33, 12, 'barrel'], [34, 12, 'crate'], [16, 19, 'drift'], [24, 19, 'rock']] as [number, number, TileName][]) if (free(x, y)) put('furniture_below', x, y, k)

// ---- zones, in lookup order: first match wins; anywhere else is the plaza -------------------------------------------------------
zones.push(rect('library', 'zone', 1, 1, 15, 10, { zone: 'library', quiet: true }), rect('tables', 'zone', 24, 1, 15, 10, { zone: 'tables' }),
  rect('lounge', 'zone', 1, 18, 13, 9, { zone: 'lounge' }), rect('garden', 'zone', 26, 18, 13, 9, { zone: 'garden' }), rect('plaza', 'zone', 15, 11, 10, 8, { zone: 'plaza' }))

// ---- collision: every wall and every piece of furniture blocks (run-length merged per row) ----------------------------------------------
const collision: Obj[] = []
for (let y = 0; y < H; y++) {
  let x = 0
  while (x < W) {
    const solid = (i: number) => L.walls[y * W + i] || L.furniture_below[y * W + i] || pondTiles.has(y * W + i)
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
