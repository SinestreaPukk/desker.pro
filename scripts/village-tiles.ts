// The tileset order, shared by the asset generator and the map generator. gid = index + 1. Replace tiles.png and keep this order, and the map still works.
export const TILE_NAMES = [
  'snow0', 'snow1', 'path', 'wood', 'wall', 'window', 'fence', 'trunk',
  'canopy', 'water', 'bench', 'desk', 'chair', 'shelf', 'lamp_base', 'lamp_top',
  'table', 'kotatsu', 'cushion', 'counter', 'plant', 'snowman_b', 'snowman_t', 'door_mat',
  'board0', 'board1', 'board2', 'board3', 'board4', 'board5', 'void0', 'void1',
] as const
export type TileName = (typeof TILE_NAMES)[number]
export const gid = (n: TileName) => TILE_NAMES.indexOf(n) + 1
export const TILE_COLS = 8
export const COLOURS = ['snow', 'sky', 'moss', 'rose', 'amber', 'plum'] as const
