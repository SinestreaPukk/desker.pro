#!/usr/bin/env python3
"""Draw a calm mountain and lake scene (192x80): sky, one range of peaks, still water, a thin shore and a near bank. Nothing else (192x80) plane by plane, back to front, then colour it three ways.

The art is drawn once with *roles* (sky0, snow-lit, thatch...), never colours. Night, morning and dusk are
three role->yuki16 tables, so the pixels are identical and only the palette changes. Night is the master:
the moon is upper-left, so every lit face on every object faces upper-left.

Planes: sky and stars and clouds and moon -> far peaks -> forest ridge -> far shore (house, pines) -> lake
(reflections, glints) -> sailboat -> near bank (drifts, footprints, post) -> foreground
framing (rock, reeds, pine branch). The avatar is a live overlay (blink) standing on the post.

Output: public/pixel/scene-{morning,dusk,night}.png, scene.json, src/scene-motion.json.
Usage: python3 art/scene_build.py   [--check  prints role pairs that merge in a variant]
"""
import json, math, pathlib, random, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAL = json.loads((ROOT / 'art/palette/scene.json').read_text())['colors']
W, H = 192, 80

# role: (night, morning, dusk)
R = {
    'sky0': ('yoru-2', 'kori-2', 'yoru-1'), 'sky1': ('yoru-1', 'kori-1', 'yoru-0'), 'sky2': ('yoru-0', 'yuki-2', 'hada-1'),
    'halo': ('yoru-0', 'yuki-1', 'hada-1'), 'star': ('yuki-1', 'kori-1', 'yuki-3'), 'starb': ('yuki-0', 'kori-1', 'yuki-2'),
    'moon': ('yuki-0', 'hada-0', 'daidai-0'), 'moon_s': ('yuki-2', 'hada-0', 'daidai-0'), 'moon_c': ('yuki-1', 'hada-0', 'daidai-0'), 'halo2': ('yoru-0', 'hada-0', 'daidai-0'),
    'cloud_l': ('yuki-3', 'yuki-0', 'hada-0'), 'cloud': ('yoru-0', 'yuki-1', 'hada-1'), 'cloud_s': ('yoru-1', 'yuki-2', 'yoru-0'),
    'rock_l': ('yuki-3', 'yuki-3', 'yuki-3'), 'rock_m': ('yoru-0', 'yoru-0', 'yoru-0'), 'rock_s': ('yoru-2', 'yoru-1', 'yoru-1'), 'rim': ('yuki-3', 'yuki-1', 'hada-1'),
    'ridge': ('yuki-2', 'yuki-1', 'hada-1'),     # a 1px light edge along every ridge, so a peak never melts into the sky behind it
    'snow_fl': ('yuki-2', 'yuki-0', 'hada-0'), 'snow_fs': ('yuki-3', 'yuki-2', 'yuki-3'),
    'hill': ('matsu-2', 'matsu-1', 'matsu-2'), 'hill_l': ('matsu-1', 'matsu-0', 'matsu-1'),
    'w_far': ('yoru-0', 'yuki-2', 'hada-1'), 'w_mid': ('yoru-1', 'kori-1', 'yoru-0'), 'w_near': ('yoru-2', 'kori-2', 'yoru-1'), 'glint': ('yuki-3', 'yuki-1', 'hada-0'),
    'sn_hi': ('yuki-1', 'yuki-0', 'hada-0'), 'sn_l': ('yuki-2', 'yuki-1', 'yuki-2'), 'sn_m': ('yuki-3', 'yuki-2', 'yuki-3'), 'sn_s': ('yoru-0', 'yuki-3', 'yoru-0'), 'sn_d': ('yoru-1', 'yoru-0', 'yoru-1'),
    'pine': ('matsu-1', 'matsu-0', 'matsu-1'), 'pine_s': ('matsu-2', 'matsu-1', 'matsu-2'), 'pine_d': ('yoru-2', 'matsu-2', 'yoru-2'),
    'thatch': ('kuri', 'kuri', 'kuri'), 'thatch_s': ('yoru-1', 'yoru-1', 'yoru-1'), 'wood': ('kuri', 'kuri', 'kuri'), 'wood_s': ('yoru-1', 'yoru-1', 'yoru-1'), 'shade': ('yoru-2', 'yoru-2', 'yoru-2'),
    'log': ('hada-1', 'hada-1', 'hada-1'), 'log_s': ('kuri', 'kuri', 'kuri'), 'wall_d': ('kuri', 'kuri', 'kuri'), 'wall_s': ('yoru-1', 'yoru-1', 'yoru-1'),
    'wr_hi': ('hada-0', 'hada-0', 'hada-0'), 'wr_l': ('hada-1', 'hada-1', 'hada-1'), 'wr_m': ('kuri', 'kuri', 'kuri'), 'wr_s': ('yoru-1', 'yoru-1', 'yoru-1'),
    'smoke_l': ('yuki-2', 'yuki-0', 'hada-0'), 'smoke': ('yoru-0', 'yuki-1', 'hada-1'), 'smoke_s': ('yoru-1', 'yuki-2', 'yoru-0'),
    'win': ('hada-0', 'hada-0', 'hada-0'), 'win_g': ('hada-1', 'hada-1', 'hada-1'), 'pool0': ('hada-1', 'yuki-2', 'hada-1'), 'pool1': ('hada-0', 'yuki-1', 'hada-0'),
    'sail': ('yuki-2', 'yuki-0', 'hada-0'), 'sail_s': ('yuki-3', 'yuki-2', 'yuki-3'),
    'tor': ('beni', 'beni', 'beni'), 'tor_s': ('yoru-1', 'yoru-1', 'yoru-1'), 'tor_h': ('hada-1', 'hada-1', 'hada-1'),
    'stone_l': ('yuki-3', 'yuki-3', 'yuki-3'), 'stone_s': ('yoru-0', 'yoru-0', 'yoru-0'), 'stone_d': ('yoru-1', 'yoru-1', 'yoru-1'),
    'reed': ('matsu-1', 'matsu-0', 'matsu-1'), 'reed_s': ('matsu-2', 'matsu-1', 'matsu-2'), 'reed_h': ('yuki-3', 'yuki-2', 'yuki-3'),
}
for new, old in (('rf_hi', 'sn_hi'), ('rf_l', 'sn_l'), ('rf_m', 'sn_m'), ('rf_s', 'sn_s'), ('cap_hi', 'sn_hi'), ('cap_l', 'sn_l'), ('cap_s', 'sn_s'),
                 ('pn_hi', 'sn_hi'), ('pn_l', 'sn_l'), ('pn_s', 'sn_s'), ('br', 'pine'), ('br_s', 'pine_s'), ('br_d', 'pine_d')):
    R[new] = R[old]
R.update({
    # the low tree line on the far shore: three tones (lit left, body, shade), and a second set so spring and autumn can mix two colours
    'tree_l': ('yoru-1', 'yoru-0', 'yoru-1'), 'tree': ('yoru-2', 'yoru-0', 'yoru-2'), 'tree_s': ('yoru-2', 'yoru-1', 'yoru-2'),
    'tb_l': ('yoru-1', 'yoru-0', 'yoru-1'), 'tb': ('yoru-2', 'yoru-0', 'yoru-2'), 'tb_s': ('yoru-2', 'yoru-1', 'yoru-2'),
    'fleck': ('yuki-2', 'yuki-1', 'yuki-2'),     # scattered on the near bank: blossom in spring, fallen leaves in autumn; the ground's own colour otherwise
})
BASE = dict(R)   # winter

# Seasons recolour the same pixels. Each override is (night, morning, dusk). Winter is BASE.
GREEN_GROUND = {'pool0': ('hada-1', 'matsu-0', 'hada-1'), 'pool1': ('hada-0', 'yuki-1', 'hada-0'),
                'sn_hi': ('matsu-0', 'yuki-1', 'hada-0'), 'sn_l': ('matsu-1', 'matsu-0', 'matsu-1'), 'sn_m': ('matsu-2', 'matsu-1', 'matsu-2'), 'sn_s': ('yoru-2', 'matsu-2', 'yoru-1'), 'sn_d': ('yoru-2', 'matsu-2', 'yoru-2'),
                'cap_hi': ('matsu-0', 'yuki-1', 'hada-0'), 'cap_l': ('matsu-0', 'matsu-0', 'hada-1'), 'cap_s': ('matsu-1', 'matsu-1', 'matsu-1'),
                'pn_hi': ('matsu-0', 'matsu-0', 'hada-0'), 'pn_l': ('matsu-0', 'matsu-0', 'matsu-0'), 'pn_s': ('matsu-1', 'matsu-1', 'matsu-1'),
                'reed': ('matsu-1', 'matsu-0', 'matsu-1'), 'reed_s': ('matsu-2', 'matsu-1', 'matsu-2'),
                'fleck': ('matsu-1', 'matsu-0', 'matsu-1')}
CLEAR_SKY = {'sky0': ('yoru-2', 'kori-2', 'yoru-1'), 'sky1': ('yoru-1', 'kori-1', 'yoru-0'), 'sky2': ('yoru-0', 'yuki-1', 'hada-0'), 'halo': ('yoru-0', 'yuki-0', 'hada-0')}
SEASONS = {
    'winter': {},
    # Spring: fresh green banks scattered with blossom, a tree line of pink and green, the snow gone from the lower peaks, a clear pale sky.
    'spring': {**GREEN_GROUND, **CLEAR_SKY, 'sn_hi': ('matsu-0', 'yuki-0', 'hada-0'), 'fleck': ('hada-1', 'hada-0', 'hada-0'),
        'tree_l': ('hada-1', 'hada-0', 'hada-0'), 'tree': ('hada-1', 'hada-1', 'hada-1'), 'tree_s': ('kuri', 'kuri', 'kuri'),
        'tb_l': ('matsu-0', 'matsu-0', 'matsu-0'), 'tb': ('matsu-1', 'matsu-0', 'matsu-1'), 'tb_s': ('matsu-2', 'matsu-1', 'matsu-2')},
    # Summer: deep green banks and trees, a clear sky, snow only on the highest tops.
    'summer': {**GREEN_GROUND, **CLEAR_SKY, 'sn_hi': ('matsu-0', 'yuki-0', 'hada-0'),
        'tree_l': ('matsu-1', 'matsu-0', 'matsu-0'), 'tree': ('matsu-2', 'matsu-1', 'matsu-1'), 'tree_s': ('yoru-2', 'matsu-2', 'matsu-2'),
        'tb_l': ('matsu-1', 'matsu-0', 'matsu-0'), 'tb': ('matsu-2', 'matsu-1', 'matsu-1'), 'tb_s': ('yoru-2', 'matsu-2', 'matsu-2')},
    # Autumn: warm banks with fallen leaves, a tree line of red and rust, a peach morning sky, the first snow on the tops.
    'autumn': {'sky0': ('yoru-2', 'kori-2', 'yoru-1'), 'sky1': ('yoru-1', 'yuki-2', 'yoru-0'), 'sky2': ('yoru-0', 'hada-0', 'hada-1'), 'halo': ('yoru-0', 'hada-0', 'hada-0'),
        'sn_hi': ('hada-0', 'hada-0', 'hada-0'), 'sn_l': ('daidai-0',)*3, 'sn_m': ('daidai-1',)*3, 'sn_s': ('yoru-1', 'yoru-1', 'yoru-1'), 'sn_d': ('yoru-2', 'yoru-2', 'yoru-2'),
        'cap_hi': ('hada-0', 'hada-0', 'hada-0'), 'cap_l': ('daidai-0',)*3, 'cap_s': ('daidai-2',)*3,
        'reed': ('daidai-2',)*3, 'reed_s': ('yoru-1', 'yoru-1', 'yoru-1'), 'fleck': ('daidai-0',)*3,
        'tree_l': ('daidai-0',)*3, 'tree': ('daidai-1',)*3, 'tree_s': ('daidai-2',)*3,
        'tb_l': ('daidai-1',)*3, 'tb': ('daidai-2',)*3, 'tb_s': ('beni',)*3},
}
SNOWLINE_AT = {'winter': 31, 'spring': 25, 'summer': 18, 'autumn': 23}   # how far down the peaks the snow reaches
FALL = {'winter': 'snow', 'spring': 'none', 'summer': 'none', 'autumn': 'none'}   # rain is weather, not a season: the app adds it on top of any of them
CUR = 'winter'
def table(season): return {**BASE, **SEASONS[season]}

NAMES = list(R); IDX = {n: i + 1 for i, n in enumerate(NAMES)}
VARIANTS = ('night', 'morning', 'dusk')
rng = random.Random(7)
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
dith = lambda x, y, t: BAYER[y % 4][x % 4] < t * 16

def new(): return np.zeros((H, W), dtype=np.uint8)
def put(A, x, y, r):
    if 0 <= x < W and 0 <= y < H: A[y, x] = IDX[r]
def poly(A, pts, r):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([(int(a), int(b)) for a, b in pts], fill=255); A[np.array(m) > 0] = IDX[r]
def rect(A, x0, y0, x1, y1, r):
    A[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = IDX[r]
def stamp(A, L): A[L > 0] = L[L > 0]
is_ = lambda A, x, y, *rs: 0 <= x < W and 0 <= y < H and A[y, x] in [IDX[r] for r in rs]

def ridge(pts, seed, amp=1):
    g = random.Random(seed); xs = np.arange(W)
    base = np.interp(xs, [p[0] for p in pts], [p[1] for p in pts])
    noise = np.interp(xs, range(0, W + 4, 3), [g.uniform(-amp, amp) for _ in range(0, W + 4, 3)])
    return np.round(base + noise).astype(int)

# ---------------------------------------------------------------- sky
def sky(A):
    for y in range(0, 44):
        for x in range(W):
            r = 'sky0'
            if y >= 14 or (y >= 8 and dith(x, y, ((y - 8) // 2 + 1) / 4)): r = 'sky1'
            if y >= 42 or (y >= 36 and dith(x, y, ((y - 36) // 2 + 1) / 4)): r = 'sky2'
            put(A, x, y, r)
    # moon, upper left, with a graduated dither halo
    cx, cy, rr = 26, 27, 5
    for y in range(cy - 14, cy + 15):
        for x in range(cx - 14, cx + 15):
            d = math.hypot(x - cx, y - cy)
            if d > rr + 0.5 and d <= rr + 6 and is_(A, x, y, 'sky0', 'sky1', 'sky2'):
                if d <= rr + 1.6: put(A, x, y, 'halo2')
    for y in range(cy - rr - 1, cy + rr + 2):
        for x in range(cx - rr - 1, cx + rr + 2):
            d = math.hypot(x - cx, y - cy)
            if d <= rr + .5:
                ring = d > rr - .6
                put(A, x, y, 'moon_s' if ((ring and (x - cx) + (y - cy) > 1) or (x, y) in ((cx + 1, cy + 1), (cx + 2, cy - 1), (cx - 2, cy + 2), (cx + 1, cy + 3))) else 'moon_c' if (x, y) in ((cx - 2, cy - 1), (cx - 1, cy - 1), (cx - 2, cy), (cx + 2, cy + 2), (cx + 1, cy - 3), (cx - 1, cy + 3)) else 'moon')
    # stars: 1px dots and three 3px plus shapes, kept off the moon and the cloud lanes
    for _ in range(12):
        x, y = rng.randint(2, W - 3), rng.randint(1, 24)
        if math.hypot(x - cx, y - cy) > 16: put(A, x, y, 'star')
    for x, y in ((74, 4), (158, 7), (10, 10), (182, 21)):
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): put(A, x + dx, y + dy, 'starb')
    # clouds: flat-bottomed lenses, lit rim upper-left, shaded belly
    for ccx, ccy, w, h, bumps in ((66, 10, 42, 7, (-12, 2, 11)), (146, 16, 34, 6, (-8, 7)), (20, 6, 22, 4, (-3,)), (118, 3, 20, 4, (4,)), (178, 10, 22, 5, (-4, 5))):
        sh = np.zeros((H, W), bool)
        for j in range(h):
            for x in range(ccx - w // 2, ccx + w // 2 + 1):
                lens = 1 - abs(x - ccx) / (w / 2)                                  # tapered ends, flat belly
                top = h - 1 - int((h - 2) * lens ** .7)
                for bx in bumps:
                    top = min(top, h - 1 - int((h - 1) * max(0, 1 - abs(x - ccx - bx) / (h * 1.1)) ** .6))
                if j >= top and 0 <= x < W: sh[ccy + j, x] = True
        for y in range(H):
            for x in range(W):
                if not sh[y, x]: continue
                up = y > 0 and sh[y - 1, x]; lf = x > 0 and sh[y, x - 1]; dn = y < H - 1 and sh[y + 1, x]
                put(A, x, y, 'cloud_l' if (not up or not lf) and dn else 'cloud_s' if not dn else 'cloud')

# ---------------------------------------------------------------- far peaks (one dominant, smaller ones overlapping it)
SNOWLINE = lambda x: SNOWLINE_AT[CUR] + 2.5 * math.sin(x / 6.3) + 1.5 * math.sin(x / 2.9 + 1)
def mountain(A, pts, seed, base=46):
    """A peak with real faces. Light comes from the upper left, so a face that rises to the right is lit and one that falls away is in shade.
    The lit/shade edge is not a vertical line: it is looked up along a spur that runs down and to the right from each summit and wobbles as it goes,
    with a mid tone between the two so the turn is soft. A few short crag strokes break up the big faces."""
    top = ridge(pts, seed)
    g = random.Random(seed + 7); jit = []; j = 0
    for _ in range(H):
        j = max(-3, min(3, j + g.choice((-1, 0, 0, 1)))); jit.append(j)
    def slope(x): x = max(5, min(W - 6, x)); return top[x + 5] - top[x - 5]            # < 0 rises to the right (lit); > 0 falls away (shade)
    tone = {}
    for x in range(W):
        if top[x] >= base: continue
        for y in range(top[x], base):
            v = slope(int(round(x - .75 * (y - top[x]))) + jit[y])
            t = 'l' if v <= -2 else 'm' if v <= 1 else 's'
            tone[(x, y)] = t
            snow = y < SNOWLINE(x) - (0 if t != 's' else 1)
            put(A, x, y, ('snow_fl' if t != 's' else 'snow_fs') if snow else {'l': 'rock_l', 'm': 'rock_m', 's': 'rock_s'}[t])
    for _ in range(9):                                                                   # crag strokes: dark on lit faces, light on shaded ones
        x = g.randint(pts[0][0] + 4, pts[-1][0] - 4)
        if top[x] >= base - 12: continue
        y = top[x] + g.randint(4, 12)
        for i in range(g.randint(3, 6)):
            xx, yy = x + i // 2, y + i
            t = tone.get((xx, yy))
            if t and is_(A, xx, yy, 'rock_l', 'rock_s', 'rock_m'): put(A, xx, yy, 'rock_m' if t == 'l' else 'rock_l' if t == 's' else 'rock_s')
    for x in range(W):                                                                   # the ridge line, continuous, one pixel
        if top[x] >= base: continue
        lo = max(top[x], top[x + 1]) if x < W - 1 else top[x]; lo2 = max(top[x], top[x - 1]) if x else top[x]
        for y in range(top[x], max(lo, lo2) + 1):
            pass

def peaks(A):
    mountain(A, [(40, 46), (58, 38), (68, 31), (75, 27), (80, 28), (87, 19), (92, 15), (95, 17), (100, 11), (103, 13), (107, 19), (111, 17), (115, 23), (121, 21), (127, 27), (135, 33), (144, 40), (160, 46)], 3)
    mountain(A, [(0, 40), (8, 38), (20, 37), (34, 34), (44, 28), (51, 23), (56, 25), (60, 24), (66, 32), (78, 41), (84, 46)], 5)
    mountain(A, [(118, 46), (130, 37), (142, 29), (150, 23), (155, 21), (161, 24), (168, 28), (176, 30), (184, 28), (191, 31), (192, 46)], 9)

# ---------------------------------------------------------------- the tree line: one low, soft band of round crowns on the far shore
def treeline(A):
    g = random.Random(41); x = -4
    while x < W + 4:
        r = g.randint(3, 5); cy = 44 - g.randint(0, 1); alt = g.random() < .4
        lo, mid, sh = ('tb_l', 'tb', 'tb_s') if alt else ('tree_l', 'tree', 'tree_s')
        for y in range(cy - r, 47):
            for xx in range(x - r - 1, x + r + 2):
                if (xx - x) ** 2 / (r + 1.4) ** 2 + (y - cy) ** 2 / r ** 2 <= 1:
                    put(A, xx, y, lo if (xx < x and y < cy) else sh if (xx > x + 1 and y > cy - 1) else mid)
        x += g.randint(5, 8)

def flecks(A):
    """A few scattered specks on the near bank (blossom, fallen leaves; invisible in winter and summer)."""
    g = random.Random(53)
    for _ in range(46):
        x, y = g.randint(0, W - 1), g.randint(68, H - 3)
        if is_(A, x, y, 'sn_l', 'sn_m', 'sn_hi'): put(A, x, y, 'fleck')

# ---------------------------------------------------------------- lake
BANK = lambda x: int(round(66 + 2 * math.sin(x / 24 + .5) - 6 * math.exp(-((x - 12) / 22) ** 2)))
def lake(A):
    for x in range(W):
        for y in range(46, BANK(x)):
            r = 'w_far'
            if y >= 52 or (y >= 49 and dith(x, y, (y - 48) / 4)): r = 'w_mid'
            if y >= 61 or (y >= 58 and dith(x, y, (y - 57) / 4)): r = 'w_near'
            put(A, x, y, r)
    # moonlit glints under the moon (the animated ones are added in scene.json)
    for x, y, w in ((24, 47, 6), (22, 49, 9), (25, 52, 5), (23, 55, 7), (26, 58, 3), (22, 60, 5)):
        for i in range(w): put(A, x + i, y, 'glint')
    g = random.Random(5)
    for _ in range(12):                                                  # calm surface: sparse 1px ripples
        x, y = g.randint(0, W - 6), g.randint(47, 64)
        if is_(A, x, y, 'w_far', 'w_mid', 'w_near'):
            for i in range(g.randint(3, 7)): put(A, x + i, y, 'w_far' if y > 53 else 'w_mid' if y > 49 else 'w_mid')

REFL = {'sail': 'sail_s', 'sail_s': 'w_near', 'rf_hi': 'rf_l', 'rf_l': 'rf_m', 'rf_m': 'rf_s', 'rf_s': 'w_near', 'cap_hi': 'cap_l', 'cap_l': 'cap_s', 'cap_s': 'w_near', 'pn_hi': 'pn_l', 'pn_l': 'pn_s', 'pn_s': 'pine_s', 'br': 'br_s', 'br_s': 'br_d', 'br_d': 'w_near', 'sn_hi': 'sn_l', 'sn_l': 'sn_m', 'sn_m': 'sn_s', 'sn_s': 'sn_d', 'sn_d': 'w_near', 'thatch': 'thatch_s', 'thatch_s': 'w_near', 'wood': 'wood_s', 'wood_s': 'w_near', 'wr_hi': 'wr_l', 'wr_l': 'wr_m', 'wr_m': 'wr_s', 'wr_s': 'w_near', 'shade': 'w_near', 'log': 'log_s', 'log_s': 'w_near', 'wall_d': 'w_near', 'wall_s': 'w_near', 'smoke_l': 'smoke', 'smoke': 'smoke_s', 'smoke_s': 'w_near',
        'win': 'win_g', 'win_g': 'win_g', 'tor': 'tor_s', 'tor_s': 'thatch_s', 'tor_h': 'tor', 'pine': 'pine_s', 'pine_s': 'pine_d', 'pine_d': 'w_near', 'stone_l': 'stone_s', 'stone_s': 'stone_d'}
def reflect(A, L, base, shear=1):
    """Mirror an object layer about its waterline: one ramp step darker, 1px ripple gaps, a gentle sideways wobble."""
    inv = {IDX[k]: k for k in IDX}
    for y in range(0, base + 1):
        for x in range(W):
            v = L[y, x]
            if not v: continue
            ry = base + (base - y) + 1
            if ry >= H or ry % 3 == 2: continue
            sx = x + (0, shear, 0, -shear)[(ry // 2) % 4]
            if 0 <= sx < W and ry < BANK(sx) and is_(A, sx, ry, 'w_far', 'w_mid', 'w_near', 'glint'): put(A, sx, ry, REFL.get(inv[v], 'w_near'))

# ---------------------------------------------------------------- far shore: snow spit, house, pines
def runs(seed, lo, hi):
    """Uneven run lengths (lo..hi) as a per-column index, so edges step where a hand would step instead of every n pixels."""
    g = random.Random(seed); out = []; k = 0
    while len(out) < W + hi: out += [k] * g.randint(lo, hi); k += 1
    return out
def shore(A):
    step, speck = runs(31, 4, 13), runs(32, 2, 9)
    for x in range(W):
        lip = 45 + (1 if step[x] % 2 else 0) - (1 if 120 <= x <= 180 else 0)
        for y in range(lip, 47):
            put(A, x, y, 'sn_hi' if y == lip else 'sn_l' if y == 46 or speck[x] % 3 else 'sn_m')
        if speck[x] % 4 == 1 and speck[x] != speck[x - 1]: put(A, x, 46, 'sn_m')

def pine(L, cx, base, h, seed, w_scale=1.0):
    """Irregular snow-laden fir: uneven tiers, drooping ragged boughs, snow lit on the left and clumped on top, dark under each tier."""
    g = random.Random(seed); top = base - h; tiers = max(3, h // 6)
    def s(x, y, r):
        if 0 <= x < W and 0 <= y < H: L[y, x] = IDX[r]
    def at(x, y): return L[y, x] if 0 <= x < W and 0 <= y < H else 1
    for y in range(base - 5, base + 1): s(cx, y, 'pine_d'); s(cx + 1, y, 'pine_d') if y > base - 3 else None
    for k in range(tiers):
        t0 = top + int(k * (h - 5) / tiers) + g.randint(-1, 1); t1 = min(base - 1, top + int((k + 1) * (h - 5) / tiers) + 5)
        wmax = int((2 + (k + 1) * (h * .36) / tiers) * w_scale) + g.randint(0, 1); lean = g.randint(-1, 1)
        rows = []
        for y in range(t0, t1):
            f = (y - t0) / max(1, t1 - t0 - 1); hw = max(1, int(1 + f * wmax))
            if y >= t1 - 2: hw += g.randint(0, 1)
            rows.append((y, cx - hw + lean, cx + hw + lean))
        for i, (y, a, b) in enumerate(rows):
            for x in range(a, b + 1):
                if i >= len(rows) - 2 and g.random() < .35: continue    # drooping, broken lower edge
                s(x, y, 'pine' if x < cx else 'pine_s')
        y, a, b = rows[-1]                                               # shadow band cast under the tier
        for x in range(a + 1, b):
            if k < tiers - 1 and at(x, y + 1) == 0: s(x, y + 1, 'pine_d')
        depth = max(2, (t1 - t0) // 2)                                   # snow: lit left, shaded right, ragged lower boundary
        for i, (y, a, b) in enumerate(rows[:depth]):
            for x in range(a, b + 1):
                if g.random() < (1 - i / (depth + 1)) + .25 - (.15 if x > cx else 0):
                    s(x, y, 'pn_hi' if (i == 0 and x < cx) else 'pn_l' if x < cx + 1 else 'pn_s')
        for y, a, b in rows[depth - 1:depth + 1]:                        # clumps hanging past the edge
            for x in (a - 1, b + 1):
                if g.random() < .5 and at(x, y) == 0: s(x, y, 'pn_l' if x < cx else 'pn_s')
    return L

# ---------------------------------------------------------------- near bank
def bank(A):
    g = random.Random(13); crest = runs(33, 2, 6)
    for x in range(W):
        b = BANK(x)
        for y in range(b, H):
            d = y - b
            r = 'sn_l' if d < 5 else 'sn_m' if d < 12 or (d < 14 and (x + y) % 2 == 0) else 'sn_l'
            put(A, x, y, r)
        put(A, x, b, 'sn_hi'); put(A, x, b + 1, 'sn_hi' if crest[x] % 3 else 'sn_l')
    # drifts: 1px highlight on the lit crest, a shaded lee below it
    for cx, cy, w in ((50, 73, 34), (150, 74, 34)):
        for x in range(cx - w // 2, cx + w // 2 + 1):
            t = (x - cx) / (w / 2); yy = cy - round(2.5 * (1 - t * t)) - (1 if t < 0 else 0)
            put(A, x, yy, 'sn_hi'); put(A, x, yy + 1, 'sn_l'); put(A, x + 1, yy + 2, 'sn_m'); put(A, x + 2, yy + 3, 'sn_s' if x % 2 else 'sn_m')

# ---------------------------------------------------------------- foreground framing
def rock_and_reeds(A):
    poly(A, [(0, 71), (5, 66), (13, 64), (22, 66), (29, 70), (34, 75), (36, 80), (0, 80)], 'stone_l')
    poly(A, [(23, 67), (29, 70), (34, 75), (36, 80), (21, 80), (24, 74)], 'stone_s'); poly(A, [(28, 76), (36, 80), (22, 80)], 'stone_d')
    for x in range(1, 30):                                                                               # snow cap
        t = (x - 15) / 15; y0 = 64 + round(5 * t * t) + (0 if x > 3 else 3)
        put(A, x, y0, 'cap_hi'); put(A, x, y0 + 1, 'cap_l');
        if x % 3: put(A, x, y0 + 2, 'cap_l' if x < 22 else 'cap_s')
    for y in range(70, 78): put(A, 8 + (y % 3), y, 'stone_s') if y % 2 else None                           # cracks
    g = random.Random(3)
    for i, (x, h, lean) in enumerate(((3, 17, 1), (8, 12, -1), (13, 15, 1), (34, 18, 1), (40, 12, -1))):
        for j in range(h):
            xx = x + (lean * j) // 5; yy = 79 - j
            put(A, xx, yy, 'reed' if i % 2 else 'reed_s')
        tx = x + (lean * h) // 5
        for k in range(3): put(A, tx, 79 - h - k, 'reed_h'); put(A, tx + (1 if k == 1 else 0), 79 - h - k, 'reed_h')
        put(A, tx, 79 - h - 3, 'cap_l')

def branch(A):
    """Pine bough hanging into the top-right corner: bark line, fans of drooping needles (lit above, dark below), snow clumped on top."""
    g = random.Random(17)
    pts = [(191, 1), (183, 2), (174, 4), (165, 6), (157, 9), (150, 13)]
    ys = lambda x: round(1 + (191 - x) * .29)
    for x in range(150, 192): put(A, x, ys(x), 'wood_s')
    for x in range(152, 192, 3):
        y = ys(x)
        for k, (dx, dy) in enumerate(((0, 1), (-1, 2), (-1, 3), (-2, 4), (-2, 6), (-3, 7), (-3, 8))):
            if k > 3 and g.random() < .45: continue
            put(A, x + dx, y + dy, 'br' if k < 3 else 'br_s'); put(A, x + dx + 1, y + dy, 'br_s'); put(A, x + dx + 2, y + dy + 1, 'br_d')
            if k < 2: put(A, x + dx + 2, y + dy, 'br_s')
        for dx, dy in ((2, 1), (3, 2), (4, 3)): put(A, x + dx, y + dy, 'br_s')
    gap, clump = runs(34, 1, 4), runs(35, 3, 8)
    for x in range(150, 191):
        if gap[x] % 4: put(A, x, ys(x) - 1, 'pn_hi' if gap[x] % 2 else 'pn_l')
        if clump[x] % 3 == 0: put(A, x, ys(x) - 2, 'pn_l')

# ---------------------------------------------------------------- compose
def build(season='winter'):
    global CUR
    CUR = season
    A = new()
    sky(A); peaks(A); lake(A); shore(A); treeline(A); bank(A); flecks(A)
    return A

SHIMMER = [[25, 51, 6], [23, 54, 8], [24, 57, 5]]       # [x, y, width] dashes on the moon's path that slide 1px at 2 fps

def colour(A, v, season='winter'):
    T = table(season); lut = np.zeros((len(NAMES) + 1, 3), dtype=np.uint8)
    for n in NAMES:
        h = PAL[T[n][VARIANTS.index(v)]].lstrip('#'); lut[IDX[n]] = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return Image.fromarray(lut[A], 'RGB')

def check(A, season):
    """Role pairs that touch and share a colour in some variant: where a variant may stop reading."""
    T = table(season)
    for v in VARIANTS:
        merged = {}; i = VARIANTS.index(v)
        for y in range(H):
            for x in range(W - 1):
                a, b = A[y, x], A[y, x + 1]
                if a and b and a != b and T[NAMES[a - 1]][i] == T[NAMES[b - 1]][i]:
                    k = tuple(sorted((NAMES[a - 1], NAMES[b - 1]))); merged[k] = merged.get(k, 0) + 1
        print(season, v, sorted(merged.items(), key=lambda t: -t[1])[:6])

def main():
    out = ROOT / 'public/pixel'; out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('scene-*.png'): old.unlink()
    motion = {}
    for season in SEASONS:
        A = build(season)
        assert (A > 0).all(), 'unpainted pixels'
        T = table(season); motion[season] = {'fall': FALL[season]}
        for v in VARIANTS:
            colour(A, v, season).save(out / f'scene-{season}-{v}.png')
            hexof = lambda n: '#%s' % PAL[T[n][VARIANTS.index(v)]].lstrip('#')
            fall = ('sn_m', 'sn_hi')
            col = lambda n: ('#%s' % PAL[n].lstrip('#')) if n in PAL else hexof(n)
            motion[season][v] = {'back': col(fall[0]), 'front': col(fall[1]), 'glint': hexof('glint'), 'rainBack': col('kori-1'), 'rainFront': col('yuki-2')}
        if '--check' in sys.argv: check(A, season)
    motion['shimmer'] = SHIMMER
    (ROOT / 'src/scene-motion.json').write_text(json.dumps(motion, indent=2) + '\n')
    (out / 'scene.json').write_text(json.dumps({'width': W, 'height': H, 'seasons': list(SEASONS), 'variants': list(VARIANTS)}))
    print('built scene', len(SEASONS), 'seasons x', len(VARIANTS), W, H)

if __name__ == '__main__':
    main()
