// Placeholder art for the decor catalogue: one painter per item id, drawn in the same palette and pixel style as the world tiles (world-art.ts).
// Coordinates are inside the item's own box (w*16 x h*16). `f` is the frame (0, or 0/1 for the small idle animations).
import { P, type G } from './world-art.ts'

type Paint = (g: G, f: number, w: number, h: number) => void
const CO = { ice: [P.blue, P.blueD, P.blueL], rose: [P.rose, P.roseD, P.roseL], moss: [P.green, P.greenD, P.greenL], amber: [P.amber, P.amberD, P.amberL] } as const
const cushion = (c: keyof typeof CO): Paint => (g) => { const [m, d, l] = CO[c]; g.r(3, 5, 10, 8, d); g.r(2, 6, 12, 6, m); g.r(3, 5, 10, 2, l); g.r(7, 4, 2, 1, d); g.r(7, 12, 2, 1, d); g.p(2, 6, d); g.p(13, 6, d) }
const rug = (c: keyof typeof CO): Paint => (g, f, w, h) => { const [m, d, l] = CO[c], W = w * 16, H = h * 16; g.r(1, 1, W - 2, H - 2, d); g.r(2, 2, W - 4, H - 4, m); g.r(4, 4, W - 8, H - 8, l); g.r(5, 5, W - 10, H - 10, m); for (let x = 7; x < W - 6; x += 4) { g.p(x, H / 2 - 1, d); g.p(x + 1, H / 2, d) } for (let y = 2; y < H - 2; y += 3) { g.p(0, y, d); g.p(W - 1, y, d) } }
const flame = (g: G, x: number, y: number, f: number) => { g.p(x, y + (f ? 1 : 0), P.amber); g.p(x, y + 1 + (f ? 0 : 0), P.amberL) }
const glowBox = (g: G, x: number, y: number, w: number, h: number, f: number) => { g.r(x, y, w, h, P.amber); g.r(x + 1, y + 1, w - 2, h - 2, f ? P.amberL : P.amber); g.p(x, y, P.amberD) }
const sway = (f: number) => (f ? 1 : 0)
const post = (g: G, x: number, y: number, h: number) => { g.r(x, y, 2, h, P.woodD); g.r(x, y, 1, h, P.wood) }

export const PAINT: Record<string, Paint> = {
  // ---- study
  desk: (g) => { g.r(0, 4, 32, 4, P.woodLL); g.r(0, 8, 32, 3, P.wood); g.r(0, 8, 32, 1, P.woodD); g.r(2, 11, 3, 5, P.woodD); g.r(27, 11, 3, 5, P.woodD); g.r(10, 11, 12, 3, P.woodD); g.r(15, 12, 2, 1, P.amber); g.r(5, 2, 7, 3, P.paper); g.r(6, 3, 5, 1, P.stoneD); g.r(22, 3, 4, 2, P.blueD); g.p(19, 4, P.red) },
  desk_small: (g) => { g.r(2, 5, 12, 3, P.woodLL); g.r(2, 8, 12, 2, P.wood); g.r(3, 10, 2, 5, P.woodD); g.r(11, 10, 2, 5, P.woodD); g.r(5, 3, 5, 2, P.paper) },
  bookshelf: (g) => { g.r(1, 0, 14, 32, P.woodD); g.r(2, 1, 12, 30, P.woodDD); const cs = [P.blueD, P.red, P.greenD, P.amberD, P.roseD, P.slate]; for (let r = 0; r < 4; r++) { g.r(2, 8 * r + 7, 12, 1, P.woodD); for (let x = 0; x < 6; x++) g.r(3 + x * 2, 8 * r + 2 + (x % 3 === 1 ? 1 : 0), 2, 5 - (x % 3 === 1 ? 1 : 0), cs[(x + r * 2) % 6]) } },
  bookshelf_low: (g) => { g.r(0, 5, 32, 11, P.woodD); g.r(1, 6, 30, 9, P.woodDD); g.r(1, 10, 30, 1, P.woodD); const cs = [P.blueD, P.red, P.greenD, P.amberD, P.roseD, P.slate]; for (let x = 0; x < 13; x++) { g.r(2 + x * 2, 7, 2, 3, cs[x % 6]); if (x < 12) g.r(2 + x * 2, 11, 2, 4, cs[(x + 3) % 6]) } g.r(0, 4, 32, 2, P.woodL) },
  lamp: (g, f) => { g.r(5, 13, 6, 2, P.slateD); g.r(7, 7, 2, 6, P.slate); g.r(4, 2, 8, 5, P.amberD); g.r(5, 3, 6, 3, f ? P.amberL : P.amber); g.r(3, 6, 10, 1, P.amberD) },
  whiteboard: (g) => { g.r(1, 1, 30, 13, P.stoneD); g.r(2, 2, 28, 11, P.white); g.r(5, 5, 10, 1, P.blueD); g.r(5, 7, 14, 1, P.red); g.r(5, 9, 8, 1, P.greenD); g.r(21, 4, 6, 6, P.blueL); g.r(3, 13, 26, 1, P.stoneDD); g.r(3, 14, 3, 2, P.slate); g.r(26, 14, 3, 2, P.slate) },
  globe: (g) => { g.r(5, 14, 6, 2, P.woodD); g.r(7, 11, 2, 3, P.woodD); g.e(8, 7, 5, 5, P.blue); g.r(5, 5, 3, 3, P.greenD); g.r(9, 8, 3, 2, P.greenD); g.p(10, 4, P.blueL); g.r(3, 2, 1, 10, P.woodDD) },
  books: (g) => { g.r(2, 11, 12, 3, P.blueD); g.r(3, 11, 10, 1, P.paper); g.r(3, 8, 10, 3, P.red); g.r(4, 8, 8, 1, P.paper); g.r(4, 5, 9, 3, P.greenD); g.r(5, 5, 7, 1, P.paper) },
  cat_bookend: (g) => { g.r(3, 5, 10, 9, P.slateD); g.r(3, 3, 3, 3, P.slateD); g.r(10, 3, 3, 3, P.slateD); g.r(4, 6, 8, 7, P.slate); g.p(5, 8, P.amberL); g.p(10, 8, P.amberL); g.p(8, 10, P.rose); g.r(12, 13, 3, 1, P.slateD) },
  study_chair: (g) => { g.r(3, 2, 10, 7, P.woodD); g.r(4, 3, 8, 5, P.carpetD); g.r(3, 9, 10, 4, P.wood); g.r(3, 9, 10, 1, P.woodL); g.r(4, 13, 2, 3, P.woodDD); g.r(10, 13, 2, 3, P.woodDD) },
  pencil_cup: (g) => { g.r(5, 8, 6, 7, P.blueD); g.r(5, 8, 6, 1, P.blue); g.r(6, 3, 1, 5, P.amber); g.r(8, 2, 1, 6, P.red); g.r(10, 4, 1, 4, P.greenD); g.p(6, 3, P.rose); g.p(8, 2, P.ink) },
  // ---- cosy
  cushion_ice: cushion('ice'), cushion_rose: cushion('rose'), cushion_moss: cushion('moss'), cushion_amber: cushion('amber'),
  kotatsu: (g, f) => { g.r(2, 7, 28, 22, P.carpetD); g.r(2, 7, 28, 3, P.carpetL); g.r(1, 3, 30, 6, P.woodLL); g.r(1, 3, 30, 1, P.cream); g.r(1, 8, 30, 1, P.wood); g.r(3, 10, 26, 18, P.carpet); g.r(4, 12, 24, 2, P.carpetL); g.r(4, 16, 24, 1, P.carpetD); g.r(4, 22, 24, 1, P.carpetD); g.e(16, 3, 3, 1.5, P.amberD); g.r(14, 2, 4, 1, P.amberL); g.r(2, 28, 28, 1, P.woodDD) ; g.r(2, 10, 4, 14, P.blueL); g.r(3, 11, 2, 12, P.blue) },
  low_table: (g) => { g.r(1, 5, 30, 5, P.woodLL); g.r(1, 10, 30, 2, P.wood); g.r(3, 12, 2, 3, P.woodD); g.r(27, 12, 2, 3, P.woodD); g.r(6, 3, 5, 3, P.paper); g.r(20, 3, 3, 3, P.blueL) },
  rug_ice: rug('ice'), rug_rose: rug('rose'), rug_moss: rug('moss'), rug_amber: rug('amber'),
  rug_runner: (g) => { g.r(0, 3, 32, 10, P.blueD); g.r(1, 4, 30, 8, P.blue); for (let x = 3; x < 30; x += 4) { g.r(x, 6, 2, 4, P.blueL); g.p(x + 1, 7, P.blueD) } for (let y = 4; y < 12; y += 2) { g.p(0, y, P.cream); g.p(31, y, P.cream) } },
  tatami_mat: (g) => { g.r(0, 1, 32, 14, P.tatamiE); g.r(1, 2, 30, 12, P.tatami); for (let x = 3; x < 30; x += 3) g.r(x, 2, 1, 12, P.tatamiD); g.r(1, 2, 30, 1, P.cream) },
  tea_set: (g, f) => { g.r(2, 11, 12, 3, P.woodD); g.r(3, 8, 6, 4, P.white); g.r(3, 8, 6, 1, P.stoneL); g.r(9, 9, 2, 2, P.stoneL); g.r(11, 11, 3, 3, P.white); g.r(11, 11, 3, 1, P.greenL); g.p(5 + sway(f), 5 - sway(f), P.snowDD); g.p(5 - sway(f), 3 + sway(f), P.snowM); g.p(6, 2, P.snowM) },
  blanket: (g) => { g.r(2, 3, 12, 10, P.roseD); g.r(3, 4, 10, 8, P.rose); g.r(3, 4, 10, 2, P.roseL); for (let x = 4; x < 13; x += 3) { g.r(x, 7, 1, 5, P.roseD) } g.r(2, 11, 12, 1, P.cream) },
  sleeping_cat: (g, f) => { g.e(8, 10, 6, 4 + sway(f) * 0.4, P.amberD); g.e(8, 9.5, 5.5, 3.5, P.amber); g.r(10, 7, 4, 4, P.amberD); g.p(11, 7, P.amberD); g.p(13, 7, P.amberD); g.r(11, 9, 2, 1, P.ink); g.r(2, 11, 4, 2, P.amberD); g.p(6, 6 + sway(f), P.snowDD); g.p(7, 4, P.snowDD) },
  // ---- nature
  plant_pot: (g, f) => { g.r(4, 10, 8, 5, P.roseD); g.r(3, 9, 10, 2, P.rose); g.r(7 + sway(f), 4, 2, 6, P.greenD); g.r(4 + sway(f), 3, 4, 3, P.green); g.r(9 + sway(f), 5, 4, 3, P.greenD); g.p(5 + sway(f), 3, P.greenL) },
  plant_tall: (g, f) => { g.r(4, 25, 8, 7, P.carpetD); g.r(3, 24, 10, 2, P.carpet); g.r(7, 8, 2, 16, P.greenDD); for (const [x, y, w] of [[3, 20, 5], [8, 17, 5], [2, 13, 5], [9, 11, 5], [4, 6, 5], [7, 3, 4]]) { g.r(x + (y < 14 ? sway(f) : 0), y, w, 3, P.green); g.r(x + (y < 14 ? sway(f) : 0), y, w, 1, P.greenL) } },
  bonsai: (g) => { g.r(3, 12, 10, 3, P.slateD); g.r(3, 12, 10, 1, P.slate); g.r(7, 7, 2, 5, P.trunk); g.r(6, 9, 1, 2, P.trunk); g.r(2, 3, 7, 4, P.greenD); g.r(7, 2, 7, 4, P.green); g.r(3, 3, 5, 1, P.greenL); g.r(8, 2, 5, 1, P.greenL); g.r(9, 5, 4, 2, P.greenDD) },
  shrub_snowy: (g) => { g.e(8, 10, 7, 5, P.greenD); g.e(8, 9, 6, 4, P.green); g.r(3, 5, 10, 3, P.snow); g.r(5, 4, 6, 1, P.snowL); g.p(4, 9, P.snow); g.p(11, 10, P.snow); g.p(7, 12, P.greenDD) },
  shrub_snowy_wide: (g) => { g.e(16, 10, 15, 5, P.greenD); g.e(16, 9, 14, 4, P.green); g.r(3, 5, 26, 3, P.snow); g.r(6, 4, 8, 1, P.snowL); g.r(18, 4, 7, 1, P.snowL); g.p(9, 11, P.greenDD); g.p(22, 12, P.greenDD) },
  stones: (g) => { g.e(6, 11, 4, 3, P.stoneD); g.e(6, 10, 3.5, 2.5, P.stone); g.e(11, 12, 3, 2, P.stoneDD); g.e(11, 11.5, 2.5, 1.5, P.stoneD); g.r(4, 8, 4, 1, P.snow); g.r(10, 10, 2, 1, P.snow) },
  pine_small: (g) => { g.r(7, 26, 2, 6, P.trunk); g.r(7, 3, 2, 2, P.greenD); g.r(5, 5, 6, 5, P.green); g.r(3, 10, 10, 6, P.greenD); g.r(1, 16, 14, 8, P.green); g.r(0, 22, 16, 5, P.greenD); for (const [x, y, w] of [[5, 5, 3], [3, 10, 4], [1, 16, 5], [9, 17, 4], [0, 22, 5], [10, 23, 5]]) g.r(x, y, w, 1, P.snow) },
  koi_pond: (g, f) => { g.r(0, 2, 32, 28, P.stoneD); g.r(1, 3, 30, 26, P.stone); g.r(3, 5, 26, 22, P.waterD); g.r(4, 6, 24, 20, P.water); g.r(5, 7, 12, 1, P.waterL); g.r(20, 22, 6, 1, P.waterL); const o = f ? 2 : 0; g.r(9 + o, 12, 5, 2, P.amberD); g.r(8 + o, 12, 1, 2, P.amber); g.r(14 + o, 11, 2, 1, P.amber); g.r(19 - o, 19, 5, 2, P.snow); g.r(24 - o, 19, 1, 2, P.snowM); g.e(8, 21, 2.5, 1.5, P.greenD); g.p(7, 20, P.rose); g.r(0, 2, 32, 1, P.snow); g.r(0, 29, 32, 1, P.stoneDD) },
  flower_pot: (g, f) => { g.r(4, 10, 8, 5, P.woodD); g.r(3, 9, 10, 2, P.wood); g.r(8, 5, 1, 5, P.greenDD); g.p(5, 7, P.greenD); g.p(10, 6, P.greenD); const s = sway(f); g.r(7 + s, 3, 3, 3, P.rose); g.p(8 + s, 4, P.amber); g.r(3, 5, 3, 3, P.blueL); g.p(4, 6, P.amber); g.r(10, 6, 3, 3, P.white); g.p(11, 7, P.amber) },
  snow_bench: (g) => { g.r(1, 5, 30, 4, P.woodL); g.r(1, 5, 30, 1, P.woodLL); g.r(1, 9, 30, 2, P.wood); g.r(3, 11, 2, 4, P.woodD); g.r(27, 11, 2, 4, P.woodD); g.r(2, 3, 12, 2, P.snow); g.r(19, 3, 9, 2, P.snow) },
  firewood: (g) => { g.r(2, 10, 12, 4, P.trunk); for (let i = 0; i < 4; i++) { g.e(4 + i * 3, 12, 1.5, 1.8, P.woodL); g.p(4 + i * 3, 12, P.woodD) } g.r(3, 7, 10, 3, P.woodD); for (let i = 0; i < 3; i++) g.e(5 + i * 3, 8.5, 1.5, 1.5, P.woodLL); g.r(4, 6, 8, 1, P.snow) },
  // ---- lights
  paper_lantern: (g, f) => { g.r(7, 1, 2, 2, P.woodDD); g.e(8, 8, 4.5, 5.5, P.amberD); g.e(8, 8, 3.5, 4.5, f ? P.amberL : P.amber); g.r(5, 6, 6, 1, P.amberD); g.r(5, 10, 6, 1, P.amberD); g.r(6, 13, 4, 2, P.woodDD) },
  string_lights: (g, f) => { for (let x = 0; x < 32; x++) g.p(x, 3 + Math.round(Math.sin(x / 32 * Math.PI * 4) * 1.2), P.slateD); for (let i = 0; i < 6; i++) { const x = 2 + i * 5, y = 5 + Math.round(Math.sin(x / 32 * Math.PI * 4) * 1.2), on = (i + f) % 2 === 0; g.p(x, y, on ? P.amberL : P.amberD); g.p(x, y + 1, on ? P.amber : P.amberD) } },
  candle: (g, f) => { g.r(6, 12, 4, 3, P.stoneD); g.r(7, 7, 2, 5, P.cream); g.p(8, 6, P.ink); g.p(8, 5 + (f ? 1 : 0), P.amber); g.p(8, 4 + (f ? 1 : 0), P.amberL); g.p(7, 5, P.amberD) },
  stone_lantern: (g, f) => { g.r(4, 13, 8, 2, P.stoneDD); g.r(6, 8, 4, 5, P.stoneD); g.r(5, 4, 6, 4, P.stoneD); g.r(6, 5, 4, 2, f ? P.amberL : P.amber); g.r(3, 2, 10, 3, P.stone); g.r(5, 0, 6, 2, P.stoneD); g.r(3, 2, 10, 1, P.snow); g.r(5, 0, 6, 1, P.snowL) },
  floor_lamp: (g, f) => { g.r(5, 29, 6, 3, P.slateD); g.r(7, 11, 2, 18, P.slate); g.r(3, 2, 10, 9, P.amberD); g.r(4, 3, 8, 7, f ? P.amberL : P.amber); g.r(3, 2, 10, 1, P.amberL); g.r(5, 10, 6, 1, P.amberD) },
  fairy_jar: (g, f) => { g.r(4, 4, 8, 10, P.blueL); g.r(5, 3, 6, 1, P.stoneD); g.r(4, 4, 1, 10, P.white); g.p(6 + f, 8, P.amberL); g.p(9 - f, 10, P.amberL); g.p(7, 6 + f, P.amber); g.p(10, 7, P.amber); g.r(4, 13, 8, 1, P.blueD) },
  hanging_lantern: (g, f) => { g.r(7, 0, 2, 4, P.slateD); g.r(5, 4, 6, 1, P.woodDD); g.r(5, 5, 6, 7, P.amberD); g.r(6, 6, 4, 5, f ? P.amberL : P.amber); g.r(5, 12, 6, 1, P.woodDD); g.p(8, 13, P.red); g.p(8, 14, P.red) },
  brazier: (g, f) => { g.r(3, 8, 10, 3, P.slateD); g.r(4, 11, 8, 2, P.slate); g.r(3, 13, 2, 3, P.slateDD); g.r(11, 13, 2, 3, P.slateDD); g.r(5, 5 + (f ? 1 : 0), 6, 3, P.red); g.r(6, 3 + (f ? 1 : 0), 4, 3, P.amber); g.r(7, 2 + (f ? 1 : 0), 2, 2, P.amberL) },
  // ---- signs
  sign_wood: (g) => { g.r(7, 7, 2, 8, P.woodD); g.r(2, 2, 12, 7, P.woodL); g.r(2, 2, 12, 1, P.woodLL); g.r(2, 8, 12, 1, P.woodD); g.r(4, 4, 8, 1, P.woodD); g.r(4, 6, 5, 1, P.woodD) },
  course_pennant: (g) => { post(g, 3, 1, 14); g.r(5, 2, 9, 2, P.blueD); g.r(5, 4, 8, 2, P.blue); g.r(5, 6, 6, 2, P.blue); g.r(5, 8, 4, 1, P.blueD); g.r(7, 4, 3, 1, P.white) },
  notice_stand: (g) => { post(g, 3, 8, 8); post(g, 27, 8, 8); g.r(1, 1, 30, 9, P.woodD); g.r(2, 2, 28, 7, P.cream); g.r(4, 3, 7, 4, P.white); g.r(13, 3, 6, 5, P.blueL); g.r(21, 3, 7, 4, P.roseL); g.p(7, 3, P.red); g.p(16, 3, P.red); g.p(24, 3, P.red) },
  welcome_mat: (g) => { g.r(1, 4, 14, 8, P.woodDD); g.r(2, 5, 12, 6, P.tatami); for (let x = 3; x < 13; x += 2) g.p(x, 8, P.woodD); g.r(2, 5, 12, 1, P.cream) },
  direction_post: (g) => { post(g, 7, 1, 15); g.r(1, 2, 8, 3, P.woodL); g.p(0, 3, P.woodL); g.r(8, 7, 7, 3, P.woodLL); g.p(15, 8, P.woodLL); g.r(3, 3, 4, 1, P.woodD); g.r(9, 8, 4, 1, P.woodD) },
  name_plate: (g) => { g.r(2, 6, 12, 6, P.stoneDD); g.r(3, 7, 10, 4, P.stoneL); g.r(5, 8, 6, 1, P.slateD); g.r(5, 10, 4, 1, P.slate); g.r(4, 12, 2, 2, P.stoneDD); g.r(10, 12, 2, 2, P.stoneDD) },
  // ---- seasonal
  snowman: (g) => { g.e(8, 12, 5, 3.5, P.snowDD); g.e(8, 11.5, 4.6, 3.2, P.snow); g.e(8, 6.5, 3.5, 3.2, P.snowDD); g.e(8, 6, 3.2, 3, P.snowL); g.p(7, 5, P.ink); g.p(9, 5, P.ink); g.p(8, 6, P.amberD); g.r(5, 3, 6, 1, P.ink); g.r(6, 1, 4, 2, P.ink); g.r(5, 9, 6, 1, P.red); g.p(8, 11, P.ink); g.p(8, 13, P.ink) },
  kadomatsu: (g) => { g.r(3, 24, 10, 8, P.woodD); g.r(3, 24, 10, 1, P.woodL); for (let i = 0; i < 3; i++) { g.r(4 + i * 3, 8 + (i === 1 ? -3 : 0), 3, 17 - (i === 1 ? -3 : 0), P.green); g.r(4 + i * 3, 8 + (i === 1 ? -3 : 0), 1, 17, P.greenL); g.r(4 + i * 3, 8 + (i === 1 ? -3 : 0), 3, 1, P.stoneL) } g.r(6, 6, 1, 6, P.greenDD); g.r(9, 5, 1, 7, P.greenDD); g.r(2, 1, 12, 5, P.greenD); g.r(4, 0, 8, 2, P.green); g.r(5, 20, 6, 3, P.red); g.r(5, 22, 6, 1, P.white) },
  mochi: (g) => { g.r(4, 12, 8, 3, P.red); g.r(4, 12, 8, 1, P.roseD); g.r(3, 9, 10, 3, P.white); g.r(5, 6, 6, 3, P.white); g.r(3, 11, 10, 1, P.snowDD); g.r(5, 8, 6, 1, P.snowDD); g.r(7, 3, 2, 3, P.amberD); g.r(7, 2, 2, 1, P.greenD) },
  snow_pile: (g) => { g.e(8, 12, 7, 4, P.snowDD); g.e(8, 11, 6.5, 3.5, P.snow); g.r(4, 9, 6, 1, P.snowL); g.p(11, 12, P.snowD); g.p(5, 13, P.snowD) },
  cherry_tree: (g, f) => { g.r(14, 14, 4, 17, P.trunk); g.r(14, 14, 1, 17, P.woodD); g.r(10, 20, 4, 2, P.trunk); const s = sway(f); g.e(16, 9, 14, 8, P.rose); g.e(16, 8, 12.5, 6.5, P.roseL); for (const [x, y] of [[6, 6], [12, 3], [20, 5], [25, 9], [9, 11], [17, 11], [22, 13], [14, 7]]) { g.p(x, y, P.white); g.p(x + 1, y + 1, P.roseD) } g.p(5 + s, 18 + s * 2, P.rose); g.p(24 - s, 20 + s * 3, P.roseL); g.p(10, 24 + s, P.rose) },
  sakura_petals: (g) => { for (const [x, y] of [[3, 4], [8, 6], [12, 3], [5, 10], [11, 11], [8, 14], [2, 13]]) { g.p(x, y, P.rose); g.p(x + 1, y, P.roseL) } },
  exam_banner: (g) => { g.r(0, 1, 32, 2, P.woodDD); g.r(2, 3, 28, 9, P.red); g.r(2, 3, 28, 1, P.redD); g.r(2, 11, 28, 1, P.redD); for (const x of [6, 10, 14, 18, 22]) g.r(x, 5, 2, 5, P.cream); g.r(6, 7, 18, 1, P.cream); g.p(2, 12, P.red); g.p(29, 12, P.red) },
  omamori: (g) => { g.r(5, 3, 6, 11, P.red); g.r(5, 3, 6, 2, P.redD); g.r(7, 1, 2, 3, P.amber); g.r(7, 6, 2, 5, P.cream); g.r(6, 8, 4, 1, P.cream); g.r(6, 13, 4, 2, P.amber) },
}
