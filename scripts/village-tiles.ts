// The tileset order, shared by the asset generator and the map generator. gid = index + 1. Replace tiles.png and keep this order, and the map still works.
const mask16 = (p: string) => Array.from({ length: 16 }, (_, i) => `${p}_${i}`) // autotiles: bit 1 = north is not the same stuff, 2 = east, 4 = south, 8 = west
export const TILE_NAMES = [
  // ground
  'snow0', 'snow1', 'snow2', 'snow3', 'snow4', 'door_mat', 'void0', 'void1',
  ...mask16('path'), ...mask16('water'),
  // floors (the _s variants sit under a north wall and carry its shadow)
  'wood', 'wood_s', 'wood_d', 'tile_a', 'tile_b', 'tile_s', 'tatami', 'tatami_s', 'carpet', 'carpet_s', 'carpet_l', 'carpet_r',
  'rug_tl', 'rug_t', 'rug_tr', 'rug_l', 'rug_c', 'rug_r', 'rug_bl', 'rug_b', 'rug_br',
  'mat_tl', 'mat_t', 'mat_tr', 'mat_l', 'mat_c', 'mat_r', 'mat_bl', 'mat_b', 'mat_br',
  // walls and roofs
  'roof_l', 'roof_m', 'roof_r', 'wall_n', 'wall_win', 'wall_poster', 'wall_clock', 'wall_banner', 'wall_boardl', 'wall_boardr', 'wall_w', 'wall_e', 'wall_s', 'wall_nw', 'wall_ne', 'wall_sw', 'wall_se', 'wall_win_s', 'fence', 'fence_post',
  // furniture
  'desk_a', 'desk_b', 'desk_c', 'chair', 'chair_b', 'shelf_a', 'shelf_b', 'shelf_c', 'plant', 'plant_tall_b', 'plant_tall_t', 'table_a', 'table_b', 'cushion', 'cushion_b',
  'kotatsu_tl', 'kotatsu_tr', 'kotatsu_bl', 'kotatsu_br', 'counter_l', 'counter_m', 'counter_r', 'sofa_l', 'sofa_m', 'sofa_r', 'stove_b', 'stove_t', 'vend_b', 'vend_t', 'coats', 'globe', 'bin',
  // outdoors
  'trunk', 'canopy', 'pine_b', 'pine_t', 'pine2_b', 'pine2_t', 'bush', 'bush_berry', 'rock', 'rock_s', 'lantern_b', 'lantern_t', 'lamp_base', 'lamp_top', 'bench', 'bench_l', 'bench_r', 'log', 'campfire', 'snowman_b', 'snowman_t',
  'torii_bl', 'torii_br', 'torii_tl', 'torii_tr', 'torii_tm', 'shrine_b', 'shrine_t', 'sign', 'crate', 'barrel', 'lights_l', 'lights_m', 'lights_r', 'planter', 'stump', 'drift',
  'board0', 'board1', 'board2', 'board3', 'board4', 'board5',
] as const
export type TileName = (typeof TILE_NAMES)[number]
export const gid = (n: TileName) => TILE_NAMES.indexOf(n) + 1
export const TILE_COLS = 12
export const COLOURS = ['snow', 'sky', 'moss', 'rose', 'amber', 'plum'] as const
/** Bits for an autotile: which sides are NOT the same stuff (so they get an edge). */
export const autoMask = (same: (dx: number, dy: number) => boolean) => (same(0, -1) ? 0 : 1) | (same(1, 0) ? 0 : 2) | (same(0, 1) ? 0 : 4) | (same(-1, 0) ? 0 : 8)
