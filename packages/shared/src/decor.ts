// The decor catalogue as the logic sees it. Checkpoint 2 replaces this with the generated assets/decor/manifest.json; the fields are final.
import type { Dir } from './types.ts'

export interface Decor {
  id: string; w: number; h: number; walkable: boolean
  sit?: { dx: number; dy: number; facing: Dir }[] // offsets from the item's top-left corner, as drawn at rotation 0
  price: number
}
export const DECOR: Record<string, Decor> = Object.fromEntries(([
  { id: 'lantern', w: 1, h: 1, walkable: false, price: 20 },
  { id: 'plant', w: 1, h: 1, walkable: false, price: 15 },
  { id: 'cushion', w: 1, h: 1, walkable: false, sit: [{ dx: 0, dy: 0, facing: 'down' }], price: 30 },
  { id: 'rug', w: 2, h: 2, walkable: true, price: 50 },
  { id: 'desk', w: 2, h: 1, walkable: false, price: 60 },
  { id: 'bookshelf', w: 1, h: 2, walkable: false, price: 70 },
] as Decor[]).map((d) => [d.id, d]))
