#!/usr/bin/env python3
"""Draw the lakeside snow scene (192x80) plane by plane, back to front, then colour it three ways.

The art is drawn once with *roles* (sky0, snow-lit, thatch...), never colours. Night, morning and dusk are
three role->yuki16 tables, so the pixels are identical and only the palette changes. Night is the master:
the moon is upper-left, so every lit face on every object faces upper-left.

Planes: sky and stars and clouds and moon -> far peaks -> forest ridge -> far shore (house, pines) -> lake
(reflections, glints) -> torii in the shallows -> near bank (drifts, footprints, post) -> foreground
framing (rock, reeds, pine branch). The avatar is a live overlay (blink) standing on the post.

Output: public/pixel/scene-{morning,dusk,night}.png, scene.json, src/scene-motion.json.
Usage: python3 art/scene_build.py   [--check  prints role pairs that merge in a variant]
"""
import json, math, pathlib, random, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAL = json.loads((ROOT / 'pixel-kit/art/palette/yuki16.json').read_text())['colors']
W, H = 192, 80

# role: (night, morning, dusk)
R = {
    'sky0': ('yoru-2', 'kori-2', 'yoru-1'), 'sky1': ('yoru-1', 'kori-1', 'yoru-0'), 'sky2': ('yoru-0', 'yuki-2', 'hada-1'),
    'halo': ('yoru-0', 'yuki-1', 'hada-1'), 'star': ('yuki-1', 'kori-1', 'yuki-3'), 'starb': ('yuki-0', 'kori-1', 'yuki-2'),
    'moon': ('yuki-0', 'yuki-0', 'hada-0'), 'moon_s': ('yuki-2', 'yuki-1', 'hada-1'),
    'cloud_l': ('yuki-3', 'yuki-0', 'hada-0'), 'cloud': ('yoru-0', 'yuki-1', 'hada-1'), 'cloud_s': ('yoru-1', 'yuki-2', 'yoru-0'),
    'rock_l': ('yoru-0', 'yuki-3', 'yoru-0'), 'rock_s': ('yoru-1', 'yoru-0', 'yoru-1'), 'rim': ('yuki-3', 'yuki-1', 'hada-1'),
    'snow_fl': ('yuki-2', 'yuki-0', 'hada-0'), 'snow_fs': ('yuki-3', 'yuki-2', 'yuki-3'),
    'hill': ('matsu-2', 'matsu-1', 'matsu-2'), 'hill_l': ('matsu-1', 'matsu-0', 'matsu-1'),
    'w_far': ('yoru-0', 'yuki-2', 'hada-1'), 'w_mid': ('yoru-1', 'kori-1', 'yoru-0'), 'w_near': ('yoru-2', 'kori-2', 'yoru-1'), 'glint': ('yuki-3', 'yuki-1', 'hada-0'),
    'sn_hi': ('yuki-1', 'yuki-0', 'hada-0'), 'sn_l': ('yuki-2', 'yuki-1', 'yuki-2'), 'sn_m': ('yuki-3', 'yuki-2', 'yuki-3'), 'sn_s': ('yoru-0', 'yuki-3', 'yoru-0'), 'sn_d': ('yoru-1', 'yoru-0', 'yoru-1'),
    'pine': ('matsu-1', 'matsu-0', 'matsu-1'), 'pine_s': ('matsu-2', 'matsu-1', 'matsu-2'), 'pine_d': ('yoru-2', 'matsu-2', 'yoru-2'),
    'thatch': ('kuri', 'kuri', 'kuri'), 'thatch_s': ('yoru-1', 'yoru-1', 'yoru-1'), 'wood': ('kuri', 'kuri', 'kuri'), 'wood_s': ('yoru-1', 'yoru-1', 'yoru-1'),
    'win': ('hada-0', 'hada-0', 'hada-0'), 'win_g': ('hada-1', 'hada-1', 'hada-1'), 'pool0': ('hada-1', 'yuki-2', 'hada-1'), 'pool1': ('hada-0', 'yuki-1', 'hada-0'),
    'tor': ('beni', 'beni', 'beni'), 'tor_s': ('kuri', 'kuri', 'kuri'), 'tor_h': ('hada-1', 'hada-1', 'hada-1'),
    'stone_l': ('yuki-3', 'yuki-3', 'yuki-3'), 'stone_s': ('yoru-0', 'yoru-0', 'yoru-0'), 'stone_d': ('yoru-1', 'yoru-1', 'yoru-1'),
    'reed': ('matsu-1', 'matsu-0', 'matsu-1'), 'reed_s': ('matsu-2', 'matsu-1', 'matsu-2'), 'reed_h': ('kuri', 'kuri', 'kuri'),
}
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
                t = .5 if d <= rr + 3 else .25
                if dith(x, y, t): put(A, x, y, 'halo')
    for y in range(cy - rr - 1, cy + rr + 2):
        for x in range(cx - rr - 1, cx + rr + 2):
            d = math.hypot(x - cx, y - cy)
            if d <= rr + .5:
                ring = d > rr - .6
                put(A, x, y, 'moon_s' if ((ring and (x - cx) + (y - cy) > 1) or (x, y) in ((cx + 1, cy + 1), (cx + 2, cy - 1), (cx - 2, cy + 2), (cx + 1, cy + 3))) else 'moon')
    # stars: 1px dots and three 3px plus shapes, kept off the moon and the cloud lanes
    for _ in range(26):
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
SNOWLINE = lambda x: 31 + 2.5 * math.sin(x / 6.3) + 1.5 * math.sin(x / 2.9 + 1)
def mountain(A, pts, seed, base=46):
    top = ridge(pts, seed)
    for x in range(W):
        if top[x] >= base: continue
        slope = top[min(W - 1, x + 2)] - top[max(0, x - 2)]           # <0: rising to the right = faces upper-left = lit
        lit = slope < 0 or (slope == 0 and x < 100)
        for y in range(top[x], base):
            snow = y < SNOWLINE(x) - (0 if lit else 1)
            if snow: put(A, x, y, 'snow_fl' if lit else 'snow_fs')
            else: put(A, x, y, 'rock_l' if lit else 'rock_s')
        if lit and slope < 0: put(A, x, top[x], 'rim' if top[x] >= SNOWLINE(x) else 'sn_hi')
    # strata and gullies: short 1px diagonals running down-right in shade colour
    g = random.Random(seed + 1)
    for _ in range(6):
        x = g.randint(pts[0][0] + 6, pts[-1][0] - 6)
        if top[x] >= base - 10: continue
        y = top[x] + g.randint(2, 4); n = g.randint(8, 13)
        for i in range(n):
            if is_(A, x + i // 2, y + i, 'rock_l', 'snow_fl'): put(A, x + i // 2, y + i, 'rock_s' if is_(A, x + i // 2, y + i, 'rock_l') else 'snow_fs')

def peaks(A):
    mountain(A, [(40, 46), (62, 36), (74, 28), (86, 19), (94, 14), (100, 11), (105, 14), (110, 20), (115, 18), (122, 24), (130, 30), (144, 40), (160, 46)], 3)
    mountain(A, [(0, 40), (8, 38), (20, 37), (34, 34), (44, 28), (51, 23), (56, 25), (60, 24), (66, 32), (78, 41), (84, 46)], 5)
    mountain(A, [(118, 46), (130, 37), (142, 29), (150, 23), (155, 21), (161, 24), (168, 28), (176, 30), (184, 28), (191, 31), (192, 46)], 9)

def mini_pine(A, cx, base, h, r_l='hill_l', r='hill'):
    for i in range(h):
        hw = (i + 1) * 2 // 3; y = base - h + 1 + i
        for x in range(cx - hw, cx + hw + 1): put(A, x, y, r_l if x < cx else r)

def forest(A):
    top = ridge([(0, 42), (30, 40), (60, 42), (96, 43), (130, 41), (160, 40), (192, 41)], 11, 1)
    for x in range(W):
        for y in range(top[x], 47): put(A, x, y, 'hill')
    g = random.Random(21)
    for gx, n in ((12, 4), (52, 3), (84, 5), (108, 3), (186, 3)):                  # clumps of three or four, uneven heights, gaps between
        for i in range(n):
            x = gx + i * g.randint(3, 6)
            if 118 <= x <= 176: continue
            mini_pine(A, x, top[min(x, W - 1)] + 1, g.randint(4, 12))

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
    for _ in range(34):                                                  # calm surface: sparse 1px ripples
        x, y = g.randint(0, W - 6), g.randint(47, 64)
        if is_(A, x, y, 'w_far', 'w_mid', 'w_near'):
            for i in range(g.randint(3, 7)): put(A, x + i, y, 'w_far' if y > 53 else 'w_mid' if y > 49 else 'w_mid')

REFL = {'sn_hi': 'sn_l', 'sn_l': 'sn_m', 'sn_m': 'sn_s', 'sn_s': 'sn_d', 'sn_d': 'w_near', 'thatch': 'thatch_s', 'thatch_s': 'w_near', 'wood': 'wood_s', 'wood_s': 'w_near',
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
def shore(A):
    for x in range(W):
        lip = 45 + (1 if (x // 9) % 2 else 0) - (1 if 120 <= x <= 180 else 0)
        for y in range(lip, 47):
            put(A, x, y, 'sn_hi' if y == lip else 'sn_l' if y == 46 or x % 7 else 'sn_m')
        if x % 5 == 2: put(A, x, 46, 'sn_m')

def spit(A):
    for y in range(46, 50):
        for x in range(HOUSE_X - 8, HOUSE_X + 40):
            e = (x - (HOUSE_X + 16)) / 24
            if y - 46 <= 3 * (1 - e * e) and is_(A, x, y, 'w_far', 'w_mid', 'sn_hi', 'sn_l', 'sn_m'): put(A, x, y, 'sn_hi' if y == 46 else 'sn_l' if y < 49 else 'sn_m')

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
                    s(x, y, 'sn_hi' if (i == 0 and x < cx) else 'sn_l' if x < cx + 1 else 'sn_s')
        for y, a, b in rows[depth - 1:depth + 1]:                        # clumps hanging past the edge
            for x in (a - 1, b + 1):
                if g.random() < .5 and at(x, y) == 0: s(x, y, 'sn_l' if x < cx else 'sn_s')
    return L

HOUSE_X, HOUSE_Y = 133, 46     # front-left corner of the front wall, waterline of the far shore
def house(L):
    """Gassho-zukuri: front gable under a thick snow load, thatch showing at the eaves, timber-framed walls, warm windows, long roof going back."""
    x0, yb, W1, HW, HG, DX, DY = HOUSE_X, HOUSE_Y, 18, 5, 17, 14, -5
    ax, ay = x0 + W1 // 2, yb - HW - HG
    ex, ey = x0 + W1 + 2, yb - HW
    def P(pts, r): poly(L, pts, r)
    P([(x0 + W1, yb - HW), (x0 + W1 + DX, yb - HW + DY), (x0 + W1 + DX, yb + DY), (x0 + W1, yb)], 'wood_s')        # right wall, in shade
    P([(ax, ay), (ax + DX, ay + DY), (ex + DX, ey + DY), (ex, ey)], 'thatch_s')                                    # side roof: straw...
    P([(ax, ay), (ax + DX, ay + DY), (ex + DX, ey + DY - 4), (ex - 2, ey - 4)], 'sn_s')                              # ...under a heavy shaded snow load
    for i in range(DX + 1):                                                                                          # lit crest along the ridge, ragged lower lip
        put(L, ax + i, ay + round(i * DY / DX), 'sn_m')
        y = ey - 4 - round(i * 5 / DX) + (1 if i % 3 == 0 else 0); put(L, ex - 2 + i, y, 'sn_m'); put(L, ex - 2 + i, y + 1, 'sn_s')
    for i in range(0, DX + 1):
        for k in range(3): put(L, ex + i, ey - round(i * 5 / DX) - k, 'thatch' if (i + k) % 3 else 'thatch_s')
    for i in range(0, DX + 1, 2): put(L, ex + i, ey - round(i * 5 / DX) - 1, 'thatch'); put(L, ex + i + 1, ey - round(i * 5 / DX) - 2, 'thatch_s')
    rect(L, x0, yb - HW, x0 + W1, yb, 'wood')                                                                        # front wall, timber frame
    for px_ in range(x0, x0 + W1 + 1, 6): rect(L, px_, yb - HW, px_, yb, 'wood_s')
    rect(L, x0, yb - 2, x0 + W1, yb - 2, 'wood_s')
    for wx in (x0 + 1, x0 + 7, x0 + 13):
        rect(L, wx + 1, yb - 4, wx + 3, yb - 3, 'win'); put(L, wx + 2, yb - 1, 'win_g') if wx == x0 + 7 else None
    rect(L, x0 + 12, yb - 1, x0 + 14, yb, 'wood_s')
    P([(x0 - 3, yb - HW), (x0 + W1 + 3, yb - HW), (ax, ay)], 'sn_l')                                                 # front gable: snow...
    P([(x0 + 2, yb - HW), (x0 + W1 - 2, yb - HW), (ax, ay + 7)], 'thatch')                                            # ...with the straw face showing inside
    for yy in range(ay + 8, yb - HW):
        for x in range(x0 + 3, x0 + W1 - 2):
            if (x * 2 + yy // 3) % 5 == 0 and L[yy, x] == IDX['thatch']: L[yy, x] = IDX['thatch_s']
    rect(L, ax - 2, ay + 9, ax + 2, ay + 10, 'wood_s'); rect(L, ax - 1, ay + 9, ax + 1, ay + 10, 'win')               # attic window
    for i in range(HG):                                                                                              # snow thickness on the rafters: lit left, cool right, crisp rim
        y = ay + i; hw = (i * (W1 // 2 + 3)) // HG
        put(L, ax - hw, y, 'sn_hi'); put(L, ax - hw + 1, y, 'sn_hi' if i > 3 else 'sn_l'); put(L, ax + hw, y, 'sn_m'); put(L, ax + hw - 1, y, 'sn_s')
    for x in range(x0 - 3, x0 + W1 + 4):                                                                             # eave: snow overhang and icicles
        if x % 2 == 0: put(L, x, yb - HW + 1, 'sn_l' if x < ax else 'sn_m')
    for x in (x0 - 1, x0 + 3, x0 + 8, x0 + W1 + 1): put(L, x, yb - HW + 2, 'sn_hi' if x < ax else 'sn_m')
    return ax, ay

def pool(A):
    """Stepped light pool on the snow under the windows: palette colours only."""
    for r, (cx, cy, hw, hh) in (('pool0', (HOUSE_X + 8, 47, 13, 3)), ('pool1', (HOUSE_X + 8, 47, 7, 2))):
        for y in range(cy - 1, cy + hh + 1):
            for x in range(cx - hw, cx + hw + 1):
                if 0 <= y < 50 and ((x - cx) / hw) ** 2 + ((y - cy) / max(1, hh)) ** 2 <= 1 and is_(A, x, y, 'sn_l', 'sn_m', 'sn_hi', 'sn_s'): put(A, x, y, r)

# ---------------------------------------------------------------- torii in the shallows
def torii(L, cx, wl):
    """Front view, two tapered pillars, nuki, shimaki and an upswept kasagi under snow. cx = centre, wl = waterline."""
    top = wl - 21
    for y in range(top + 3, wl + 1):
        t = (y - top) / 21; off = 6 + (1 if t > .5 else 0)
        for px_ in (-off, off - 1):
            put(L, cx + px_, y, 'tor'); put(L, cx + px_ + 1, y, 'tor_s' if px_ > 0 else 'tor')
            if px_ < 0: put(L, cx + px_ - 1, y, 'tor_s') if False else None
    for x in range(cx - 7, cx + 8): put(L, x, top + 8, 'tor'); put(L, x, top + 9, 'tor_s')                      # nuki
    for x in range(cx - 8, cx + 9): put(L, x, top + 5, 'tor'); put(L, x, top + 6, 'tor_s')                      # shimaki
    for x in range(cx - 11, cx + 12):                                                                           # kasagi: curved, ends turn up
        up = 1 if abs(x - cx) > 8 else 0
        put(L, x, top + 2 - up, 'tor_h' if x <= cx else 'tor'); put(L, x, top + 3 - up, 'tor'); put(L, x, top + 4 - up, 'tor_s')
    for x in range(cx - 10, cx + 11):                                                                           # snow on the kasagi
        up = 1 if abs(x - cx) > 8 else 0
        put(L, x, top + 1 - up, 'sn_hi' if x <= cx + 1 else 'sn_l')
        if abs(x - cx) < 8: put(L, x, top - up, 'sn_hi' if x < cx - 2 else 'sn_l') if abs(x - cx) < 5 else None
    for y in (wl - 1, wl):                                                                                      # stone plinths
        for px_ in (-7, 6): put(L, cx + px_ - 1, y, 'stone_l'); put(L, cx + px_ + 2, y, 'stone_s')

def torii_rings(A, cx, wl):
    for px_ in (-7, 6):
        for dx in range(-3, 6):
            if abs(dx - 1) >= 2 and is_(A, cx + px_ + dx, wl + 1, 'w_mid', 'w_near'): put(A, cx + px_ + dx, wl + 1, 'glint')

# ---------------------------------------------------------------- near bank
def bank(A):
    g = random.Random(13)
    for x in range(W):
        b = BANK(x)
        for y in range(b, H):
            d = y - b
            r = 'sn_l' if d < 5 else 'sn_m' if d < 12 or (d < 14 and (x + y) % 2 == 0) else 'sn_l'
            put(A, x, y, r)
        put(A, x, b, 'sn_hi'); put(A, x, b + 1, 'sn_hi' if x % 3 else 'sn_l')
        if (x // 6) % 2: put(A, x, b + 5, 'sn_s')                                                          # wet shadow at the waterline
    # drifts: 1px highlight on the lit crest, a shaded lee below it
    for cx, cy, w in ((40, 72, 30), (92, 75, 36), (150, 73, 30), (8, 77, 22), (186, 77, 16)):
        for x in range(cx - w // 2, cx + w // 2 + 1):
            t = (x - cx) / (w / 2); yy = cy - round(2.5 * (1 - t * t)) - (1 if t < 0 else 0)
            put(A, x, yy, 'sn_hi'); put(A, x, yy + 1, 'sn_l'); put(A, x + 1, yy + 2, 'sn_m'); put(A, x + 2, yy + 3, 'sn_s' if x % 2 else 'sn_m')
    for _ in range(90):                                                                                  # wind-packed sparkles
        x, y = g.randint(0, W - 1), g.randint(BANK(0) + 6, H - 1)
        if is_(A, x, y, 'sn_l', 'sn_m'): put(A, x, y, 'sn_hi' if g.random() < .5 else 'sn_m')
    for i, (x, y) in enumerate(((98, 78), (95, 75), (99, 72), (96, 69), (100, 67), (104, 66), (108, 66), (112, 66), (116, 68))):   # footprints: a trail to the post
        put(A, x, y, 'sn_s'); put(A, x + 1, y, 'sn_s'); put(A, x, y + 1, 'sn_d' if i % 2 == 0 else 'sn_s')

# ---------------------------------------------------------------- the post the avatar perches on (feet land on its top row)
AV_X, AV_Y = 114, 43
def post(A):
    px_, top = AV_X + 8, AV_Y + 20                                                                       # post top row
    for y in range(top, top + 10):
        rect(A, px_, y, px_ + 6, y, 'wood'); put(A, px_ + 5, y, 'wood_s'); put(A, px_ + 6, y, 'wood_s')
        if y % 4 == 2: rect(A, px_ + 1, y, px_ + 3, y, 'wood_s')
    for x in range(px_ - 1, px_ + 8): put(A, x, top - 1 + (0 if px_ <= x <= px_ + 6 else 1), 'sn_hi' if x < px_ + 4 else 'sn_l')   # snow cap
    for x in range(px_ - 1, px_ + 8): put(A, x, top, 'sn_l' if x < px_ + 5 else 'sn_s')
    put(A, px_ + 3, top + 1, 'sn_m'); put(A, px_ + 4, top + 1, 'sn_m')
    for x in range(px_ - 3, px_ + 11): put(A, x, top + 10, 'sn_s')                                       # contact shadow in the snow
    for x in range(px_ + 1, px_ + 12): put(A, x, top + 11, 'sn_s' if x % 2 else 'sn_m')                  # long cool shadow, away from the light

# ---------------------------------------------------------------- foreground framing
def rock_and_reeds(A):
    poly(A, [(0, 71), (5, 66), (13, 64), (22, 66), (29, 70), (34, 75), (36, 80), (0, 80)], 'stone_l')
    poly(A, [(23, 67), (29, 70), (34, 75), (36, 80), (21, 80), (24, 74)], 'stone_s'); poly(A, [(28, 76), (36, 80), (22, 80)], 'stone_d')
    for x in range(1, 30):                                                                               # snow cap
        t = (x - 15) / 15; y0 = 64 + round(5 * t * t) + (0 if x > 3 else 3)
        put(A, x, y0, 'sn_hi'); put(A, x, y0 + 1, 'sn_l');
        if x % 3: put(A, x, y0 + 2, 'sn_l' if x < 22 else 'sn_s')
    for y in range(70, 78): put(A, 8 + (y % 3), y, 'stone_s') if y % 2 else None                           # cracks
    g = random.Random(3)
    for i, (x, h, lean) in enumerate(((3, 17, 1), (7, 12, -1), (11, 19, 1), (15, 10, 0), (30, 13, -1), (34, 18, 1), (38, 11, 0), (42, 15, -1), (46, 9, 1), (1, 9, 0))):
        for j in range(h):
            xx = x + (lean * j) // 5; yy = 79 - j
            put(A, xx, yy, 'reed' if i % 2 else 'reed_s')
            if j > 3 and g.random() < .25: put(A, xx + (1 if lean >= 0 else -1), yy, 'reed_s')
        tx = x + (lean * h) // 5
        for k in range(3): put(A, tx, 79 - h - k, 'reed_h'); put(A, tx + (1 if k == 1 else 0), 79 - h - k, 'reed_h')
        put(A, tx, 79 - h - 3, 'sn_l')

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
            put(A, x + dx, y + dy, 'pine' if k < 3 else 'pine_s'); put(A, x + dx + 1, y + dy, 'pine_s'); put(A, x + dx + 2, y + dy + 1, 'pine_d')
            if k < 2: put(A, x + dx + 2, y + dy, 'pine_s')
        for dx, dy in ((2, 1), (3, 2), (4, 3)): put(A, x + dx, y + dy, 'pine_s')
    for x in range(150, 191): 
        if x % 5 != 3: put(A, x, ys(x) - 1, 'sn_hi' if x % 2 else 'sn_l')
        if x % 4 == 0: put(A, x, ys(x) - 2, 'sn_l')

# ---------------------------------------------------------------- compose
def build():
    A = new()
    sky(A); peaks(A); forest(A); lake(A); shore(A); spit(A)
    ho = new(); house(ho)
    p1, p2, p3, p4, p5 = new(), new(), new(), new(), new()
    pine(p1, 179, 47, 26, 1); pine(p2, 189, 51, 42, 2); pine(p3, 5, 49, 26, 3, 1.1); pine(p4, 42, 47, 15, 4); pine(p5, 17, 47, 14, 5, .9)
    # reflections first (they sit on water), then the objects over the far shore
    for L in (ho, p1, p3, p4):
        reflect(A, L, 46)
    for L in (ho, p3, p4, p5, p1, p2): stamp(A, L)
    pool(A)
    to = new(); torii(to, 66, 58); reflect(A, to, 58); stamp(A, to); torii_rings(A, 66, 58)
    bank(A); post(A); rock_and_reeds(A); branch(A)
    return A

SHIMMER = [[25, 51, 6], [23, 54, 8], [24, 57, 5]]       # [x, y, width] dashes on the moon's path that slide 1px at 2 fps

def colour(A, v):
    lut = np.zeros((len(NAMES) + 1, 3), dtype=np.uint8)
    for n in NAMES:
        h = PAL[R[n][VARIANTS.index(v)]].lstrip('#'); lut[IDX[n]] = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return Image.fromarray(lut[A], 'RGB')

def check(A):
    """Role pairs that touch and share a colour in some variant: where a variant may stop reading."""
    for v in VARIANTS[1:]:
        merged = {}
        for y in range(H):
            for x in range(W - 1):
                a, b = A[y, x], A[y, x + 1]
                if a and b and a != b and R[NAMES[a - 1]][VARIANTS.index(v)] == R[NAMES[b - 1]][VARIANTS.index(v)]:
                    k = tuple(sorted((NAMES[a - 1], NAMES[b - 1]))); merged[k] = merged.get(k, 0) + 1
        print(v, sorted(merged.items(), key=lambda t: -t[1])[:8])

def main():
    out = ROOT / 'public/pixel'; out.mkdir(parents=True, exist_ok=True)
    A = build()
    assert (A > 0).all(), 'unpainted pixels'
    names = {'night': 'night', 'morning': 'morning', 'dusk': 'dusk'}
    for v in VARIANTS: colour(A, v).save(out / f'scene-{names[v]}.png')
    hexof = lambda n, v: '#%s' % PAL[R[n][VARIANTS.index(v)]].lstrip('#')
    motion = {v: {'back': hexof('sn_m', v), 'front': hexof('sn_hi', v), 'glint': hexof('glint', v)} for v in VARIANTS}
    motion['shimmer'] = SHIMMER
    (ROOT / 'src/scene-motion.json').write_text(json.dumps(motion, indent=2) + '\n')
    (out / 'scene.json').write_text(json.dumps({'width': W, 'height': H, 'avatar': {'x': AV_X, 'y': AV_Y}, 'variants': list(VARIANTS)}))
    if '--check' in sys.argv: check(A)
    print('built scene x3', W, H)

if __name__ == '__main__':
    main()
