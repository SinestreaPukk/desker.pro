#!/usr/bin/env python3
"""Cosy pixel-art city wallpapers for the sign-in screens: the city seen from a tall tower, looking down (160x200 art pixels).

Five scenes, one per screen: dusk (sign in), dawn (sign up), rain (forgot / reset password), snow (check your inbox),
afternoon (welcome). You stand on an observation ledge: a rail and a wooden shelf with a steaming mug and a plant in front,
rooftops and streets below shrinking toward a hazy horizon, a skyline and sky behind. Nothing is a character; everything moves.

Perspective: block rows get smaller by 12% each step away, and world x is scaled around the centre, so side streets
converge on the vanishing point. Rows are drawn back to front. Layers (z order, written to src/city-scenes.json):
  sky, clouds (drift), sky movers, far skyline, ground (roads, sidewalks, parks, water), traffic lanes (loop sideways),
  buildings and trees (so a car slips behind a taller roof), chimney smoke (3 frames), horizon haze,
  windows that switch off and on, rain or snow, the ledge, mug steam (3 frames).
Palette: warm and hand-picked per scene (the app's yuki16 is cold; this is the one cosy exception, like kodama).
Output: public/pixel/city/<scene>-<layer>.png, src/city-scenes.json, public/pixel/email-banner.png.
Usage: python3 art/authoring/gen_city.py
"""
import json, pathlib, random
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / 'public/pixel/city'
W, H = 160, 200
HOR = 62          # the horizon: sky above, city below
LEDGE = 181       # top of the wooden shelf you stand at
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
dith = lambda x, y, t: BAYER[y % 4][x % 4] < t * 16
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
shade = lambda c, k: tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def canvas(w=W, h=H, fill=(0, 0, 0, 0)): return Image.new('RGBA', (w, h), fill)
def px(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height: im.putpixel((x, y), c)
def box(im, x0, y0, x1, y1, c):
    x0, x1, y0, y1 = int(min(x0, x1)), int(max(x0, x1)), int(min(y0, y1)), int(max(y0, y1))
    if x1 < 0 or y1 < 0 or x0 >= im.width or y0 >= im.height: return
    ImageDraw.Draw(im).rectangle([max(x0, 0), max(y0, 0), min(x1, im.width - 1), min(y1, im.height - 1)], fill=c)
def disc(im, cx, cy, r, c):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r // 2: px(im, x, y, c)
def halo(im, cx, cy, r, c, t=.5):
    """Dither a soft glow onto whatever is there."""
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** .5
            if d <= r and dith(x, y, t * (1 - d / r)): px(im, x, y, c)


# ------------------------------------------------------------------ sky and the far skyline
def make_sky(P, rng):
    im = canvas(fill=rgb(P['sky'][-1]))
    bands = [rgb(c) for c in P['sky']]
    n = len(bands)
    for y in range(HOR + 2):
        f = min(y / HOR, .999) * (n - 1); i = int(f); t = f - i
        for x in range(W): px(im, x, y, bands[i + 1] if i + 1 < n and dith(x, y, t) else bands[i])
    box(im, 0, HOR + 2, W, H, bands[-1])
    if P.get('sun'):
        cx, cy, r = P['sun']
        for rr, t in ((r + 10, .25), (r + 5, .45)): halo(im, cx, cy, rr, rgb(P['sun_halo']), t)
        disc(im, cx, cy, r, rgb(P['sun_c']))
    stars = []
    for _ in range(P.get('stars', 0)):
        x, y = rng.randint(2, W - 3), rng.randint(2, HOR - 14)
        px(im, x, y, rgb('#fff6dc')); stars.append((x, y))
    return im, stars

def make_clouds(P, rng):
    """Flat-bottomed puffs; drawn at x and x+W in a 2W canvas so a W-pixel drift loops."""
    im = canvas(W * 2, H); hi, lo = rgb(P['cloud'][0]), rgb(P['cloud'][1])
    for _ in range(P.get('clouds', 5)):
        cx, cy, w = rng.randint(0, W - 1), rng.randint(8, HOR - 12), rng.randint(22, 46)
        h = max(4, w // 5)
        for off in (0, W):
            for x in range(cx - w // 2, cx + w // 2):
                u = 1 - abs(x - cx) / (w / 2)
                top = h - 1 - int((h - 1) * (u ** .6))
                bump = int(2 * max(0, 1 - abs(x - cx - w // 6) / (w / 5)))
                for j in range(max(0, top - bump), h): px(im, x + off, cy + j, lo if j >= h - 2 else hi)
    return im

def make_far(P, rng, lights):
    """Hazy towers on the horizon, one tall spire with a blinking beacon."""
    im = canvas()
    for col, hmin, hmax in ((P['far'][1], 6, 18), (P['far'][0], 10, 30)):
        c = rgb(col); x = -4
        while x < W:
            w, h = rng.randint(5, 11), rng.randint(hmin, hmax)
            box(im, x, HOR + 3 - h, x + w - 1, HOR + 3, c); box(im, x + w - 1, HOR + 3 - h, x + w - 1, HOR + 3, shade(c, .9))
            for wy in range(HOR + 5 - h, HOR + 1, 3):
                for wx in range(x + 1, x + w - 1, 3):
                    if rng.random() < P['win']['p'] * .5: px(im, wx, wy, rgb(P['win']['lit'][0]))
            x += w + rng.randint(0, 2)
    c = rgb(P['far'][0]); tx = rng.choice([22, 118])
    box(im, tx - 2, HOR - 26, tx + 2, HOR + 3, c); box(im, tx - 1, HOR - 34, tx + 1, HOR - 26, c); box(im, tx, HOR - 44, tx, HOR - 34, c)
    px(im, tx, HOR - 45, rgb('#ff6a5a')); lights.append((tx, HOR - 45, tx, HOR - 45, 'beacon'))
    return im


# ------------------------------------------------------------------ the city below: block rows, back to front
def plan():
    """Rows of blocks, each with the street in front of it: dicts k, s (scale), yf (front edge), dep (depth), gap (street width)."""
    rows, yf, k = [], 168, 0
    while True:
        s = .88 ** k
        dep, gap = round(14 * s), max(3, round(8 * s))
        if dep < 2 or yf - dep - gap < HOR + 3: break
        rows.append(dict(k=k, s=s, yf=yf, dep=dep, gap=gap)); yf -= dep + gap; k += 1
    return rows
sx = lambda X, s: round(80 + X * s)

CROSS = list(range(-450, 451, 75))       # world x of the side streets (they converge toward the centre)
STREET_W = 9
SEGMENTS = [(CROSS[i] + STREET_W // 2 + 1, CROSS[i + 1] - STREET_W // 2 - 1) for i in range(len(CROSS) - 1)]

def draw_ground(P, rng, rows, parks):
    g = canvas(); road, walk = rgb(P['road']), rgb(P['walk'])
    box(g, 0, HOR + 3, W, H, road)
    for r in rows:
        s = r['s']
        for si, (a, b) in enumerate(SEGMENTS):
            x0, x1, y0, y1 = sx(a, s), sx(b, s), r['yf'] - r['dep'], r['yf']
            box(g, x0 - 1, y0 - 1, x1 + 1, y1 + 1, walk)
            if (r['k'], si) in parks: box(g, x0, y0, x1, y1, rgb(P['park']))
        bot = r['yf'] + r['gap']
        if P.get('river') == r['k']:                                                # this street is a river, with bridges
            box(g, 0, r['yf'] + 1, W, bot - 1, rgb(P['water'][0]))
            for x in range(0, W, 3): px(g, (x + r['yf'] * 2) % W, r['yf'] + 1 + (x // 3) % max(1, r['gap'] - 2), rgb(P['water'][1]))
            for X in CROSS: xb = sx(X, s); box(g, xb - 2, r['yf'] - 1, xb + 2, bot + 1, rgb(P['road']))
        elif r['gap'] >= 5:
            for x in range(0, W, 8): box(g, x, r['yf'] + r['gap'] // 2, x + 3, r['yf'] + r['gap'] // 2, shade(walk, 1.05))   # lane dashes
    box(g, 0, 171, W, LEDGE, walk)                                                  # the plaza right under the ledge
    if P.get('snow'):
        for y in range(HOR + 3, H):
            for x in range(W):
                if g.getpixel((x, y)) == road and dith(x, y, .55): px(g, x, y, rgb('#8a86b8'))
    if P['night']:                                                                  # street lamps: a warm pool on the road
        for r in rows:
            for X in range(-420, 430, 70): halo(g, sx(X + 18, r['s']), r['yf'] + 1, max(3, round(9 * r['s'])), rgb(P['lamp']), .6)
    return g

def tree(im, x, y, r, cols, snow=False):
    r = max(1, r)
    disc(im, x, y, r, rgb(cols[0]))
    if r > 1: disc(im, x - r // 3, y - r // 3, max(1, r - 1), rgb(cols[1])); px(im, x + r // 2, y + r // 2, shade(rgb(cols[0]), .8))
    if snow: box(im, x - r // 2, y - r // 2, x, y - r // 2, rgb('#ffffff'))

def draw_buildings(P, rng, rows, parks, lights, smokes):
    b = canvas()
    for r in reversed(rows):                                                        # far to near
        s, yf, dep = r['s'], r['yf'], r['dep']
        for si, (a, bb) in enumerate(SEGMENTS):
            if (r['k'], si) in parks:
                for _ in range(max(2, int(10 * s))):
                    tree(b, sx(rng.randint(a, bb), s), rng.randint(yf - dep + 1, yf - 1), round(3.2 * s), P['trees'], P.get('snow'))
                continue
            X, roof, wall = a, rng.choice(P['roofs']), rng.choice(P['walls'])          # one roof and wall colour per block keeps it calm
            while X < bb - 10:
                w = min(rng.randint(26, 50), bb - X)
                x0, x1 = sx(X, s), max(sx(X, s) + 2, sx(X + w, s) - 1)
                lift = max(1, round(rng.choice([1, 1, 2, 3]) * s * 1.4))
                house(b, P, rng, x0, x1, yf, dep, lift, s, lights, smokes, roof, wall)
                X += w + rng.choice([0, 1, 2])
        for X in range(-430, 440, 55):                                              # trees along the sidewalk
            if rng.random() < P['tree_p'] and not any(abs(X - c) < 8 for c in CROSS): tree(b, sx(X, s), yf + 1, round(2.6 * s), P['trees'], P.get('snow'))
    return b

def house(im, P, rng, x0, x1, yf, dep, lift, s, lights, smokes, roof, wall):
    w = x1 - x0 + 1
    wall, roof = rgb(wall), shade(rgb(roof), rng.uniform(.92, 1.08))
    top, bot = yf - dep - lift, yf - lift                                            # the roof's rectangle; the wall's sliver is below it
    box(im, x0, bot, x1, yf, shade(wall, .86)); box(im, x1, bot, x1, yf, shade(wall, .7)); box(im, x0, bot, x1, bot, shade(wall, .6))
    if lift >= 3:
        for wy in range(bot + 1, yf - 1, 3):
            for wx in range(x0 + 1, x1 - 1, 3):
                lit = rng.random() < P['win']['p']
                px(im, wx, wy, rgb(rng.choice(P['win']['lit'])) if lit else rgb(P['win']['dim']))
                if lit: lights.append((wx, wy, wx, wy, 'win'))
    if P.get('snow'):                                                                # snow on every roof, the eave showing underneath
        box(im, x0, top, x1, bot - 1, rgb('#f4f1ff')); box(im, x0, bot - 2, x1, bot - 1, rgb('#cfc8ee')); box(im, x1, top, x1, bot - 1, rgb('#cfc8ee'))
        for _ in range(max(1, w // 5)): px(im, rng.randint(x0, x1), rng.randint(top, max(top, bot - 3)), rgb('#ffffff'))
        if s > .5: box(im, x0, bot, x1, bot, roof)
    elif w >= 7 and s > .45 and rng.random() < .55:                                  # gabled roof: two slopes and a ridge
        mid = (top + bot - 1) // 2
        box(im, x0, top, x1, mid, shade(roof, 1.12)); box(im, x0, mid + 1, x1, bot - 1, shade(roof, .86))
        box(im, x0, mid, x1, mid, shade(roof, 1.3)); box(im, x1, top, x1, bot - 1, shade(roof, .7))
        for y in range(top + 1, bot - 1, 2):
            for x in range(x0 + (y % 4 == 1), x1, 2): px(im, x, y, shade(roof, .93))
    else:                                                                            # flat roof, parapet, and something on it
        box(im, x0, top, x1, bot - 1, roof); box(im, x0, top, x1, top, shade(roof, 1.25))
        box(im, x1, top, x1, bot - 1, shade(roof, .75)); box(im, x0, bot - 1, x1, bot - 1, shade(roof, .8))
        if s > .5 and w > 5 and rng.random() < .55:
            kind = rng.random()
            cx, cy = rng.randint(x0 + 1, max(x0 + 1, x1 - 4)), rng.randint(top + 2, max(top + 2, bot - 4))
            if kind < .2: box(im, cx, cy, cx + 2, cy + 1, rgb('#aab4c0')); px(im, cx + 1, cy, rgb('#d4dce4'))              # air-con
            elif kind < .35: disc(im, cx + 1, cy + 1, 1, rgb('#8a6a5a'))                                                  # water tank
            elif kind < .55 and P.get('gardens'): box(im, cx - 1, cy, cx + 2, cy + 1, rgb('#6fa36a')); px(im, cx, cy, rgb('#e86a6a')); px(im, cx + 2, cy + 1, rgb('#f4c95d'))
            elif kind < .65: box(im, cx, cy, cx + 2, cy + 1, rgb('#3a5a8a')); px(im, cx + 1, cy, rgb('#5a8ac0'))          # solar panel
            elif kind < .8 and P['night']: box(im, cx, cy, cx + 1, cy + 1, rgb('#ffe9a8')); lights.append((cx, cy, cx + 1, cy + 1, 'win'))   # lit skylight
    if P.get('smoke') and s > .55 and w > 6 and rng.random() < .22:                  # a chimney
        cx = rng.randint(x0 + 1, x1 - 2); box(im, cx, top - 1, cx + 1, top + 1, shade(roof, .6)); px(im, cx, top - 1, shade(roof, .9))
        smokes.append((cx, top - 2))

def make_smoke(P, smokes):
    frames = [canvas() for _ in range(3)]
    for ax, ay in smokes:
        for f in range(3):
            for i in range(3):
                x, y = ax + (1 if (f + i) % 2 else 0) - i // 2, ay - 2 - i * 2 - f
                px(frames[f], x, y, rgb(P['smoke_c'][0] if i == 0 else P['smoke_c'][1]))
                if i == 0: px(frames[f], x + 1, y, rgb(P['smoke_c'][1]))
    return frames


# ------------------------------------------------------------------ traffic: lanes that loop sideways
def car(im, x, y, L, Hc, col, night):
    c = rgb(col)
    box(im, x, y, x + L - 1, y + Hc - 1, c)
    px(im, x + L - 2, y, shade(c, .6))                                                # a windscreen glint
    if night:                                                                         # headlights ahead, tail lights behind
        px(im, x + L - 1, y, rgb('#fff0b0')); px(im, x + L - 1, y + Hc - 1, rgb('#fff0b0')); px(im, x, y, rgb('#e8503a')); px(im, x, y + Hc - 1, rgb('#e8503a'))

def lane(P, rng, y, s, kind):
    """A 2W-wide strip with the same pattern in both halves, so moving it W pixels loops."""
    im = canvas(W * 2, H)
    if kind == 'car':
        L, Hc = max(3, round(8 * s)), max(2, round(3.4 * s))
        xs = []
        for x in sorted(rng.sample(range(0, W - L), int(3 + 4 * (1 - s)))):
            if not xs or x - xs[-1] > L + 2: xs.append(x)
        for x in xs:
            col = rng.choice(P['cars'])
            for off in (0, W): car(im, x + off, y, L, Hc, col, P['night'])
    elif kind == 'umbrella':
        u = max(2, round(4.2 * s))
        for i, x in enumerate(sorted(rng.sample(range(2, W - u - 2), 6))):
            col = rgb(P['umbrellas'][i % len(P['umbrellas'])])
            for off in (0, W): disc(im, x + off, y, u // 2, col); px(im, x + off, y, shade(col, 1.3))
    elif kind == 'people':
        for x in sorted(rng.sample(range(2, W - 4), 5)):
            col = rgb(rng.choice(P['cars']))
            for off in (0, W): px(im, x + off, y, col); px(im, x + off, y + 1, rgb('#4a3f5e'))
    elif kind == 'boat':
        for x in sorted(rng.sample(range(8, W - 16), 3))[::2]:
            for off in (0, W): box(im, x + off, y, x + off + 6, y + 1, rgb('#c8765a')); box(im, x + off + 2, y - 2, x + off + 3, y - 1, rgb('#fff6e4'))
    return im


# ------------------------------------------------------------------ things in the sky, the ledge in front
def sprite_balloon():
    im = canvas(18, 28); cols = [rgb('#e8704f'), rgb('#f4e8d0'), rgb('#f2b84b')]
    for y in range(0, 17):
        half = int(8 * ((1 - ((y - 8) / 9) ** 2) ** .5))
        for x in range(9 - half, 10 + half): px(im, x, y, cols[((x - (9 - half)) // 3) % 3])
    for y in range(17, 21): px(im, 5 + (y - 17), y, rgb('#7a5a4a')); px(im, 12 - (y - 17), y, rgb('#7a5a4a'))
    box(im, 6, 21, 11, 25, rgb('#8a5a3a')); box(im, 6, 21, 11, 21, rgb('#b07a50'))
    return im
def sprite_blimp():
    im = canvas(40, 18); body = rgb('#f4e8d0')
    for y in range(2, 11):
        half = int(17 * ((1 - ((y - 6) / 5) ** 2) ** .5))
        for x in range(20 - half, 21 + half): px(im, x, y, body if y < 8 else shade(body, .8))
    box(im, 1, 5, 4, 5, rgb('#e8704f')); box(im, 1, 8, 4, 8, rgb('#e8704f')); box(im, 34, 6, 38, 7, rgb('#e8704f'))
    box(im, 15, 12, 25, 15, rgb('#8a5a3a'))
    for x in (17, 20, 23): box(im, x, 13, x + 1, 14, rgb('#ffd479'))
    return im
def sprite_birds():
    im = canvas(26, 10)
    for x, y in ((2, 3), (11, 0), (18, 5), (7, 7)):
        for dx, dy in ((0, 1), (1, 0), (2, 1), (3, 0), (4, 1)): px(im, x + dx, y + dy, rgb('#4a3f5e'))
    return im

def fall(kind, rng, n, dim):
    im = canvas()
    for _ in range(n):
        x, y = rng.randint(0, W - 1), rng.randint(0, H - 1)
        if kind == 'rain':                                         # a soft, short, bluish drizzle (not bright streaks)
            c = rgb('#6f8fb0' if dim else '#8fb0cc')
            for k in range(3): px(im, (x - k // 2) % W, (y + k) % H, c)
        else:
            c = rgb('#d6d0ee' if dim else '#ffffff'); px(im, x, y, c)
            if not dim and rng.random() < .3: px(im, (x + 1) % W, y, c); px(im, x, (y + 1) % H, c)
    return im

def make_ledge(P, lights):
    """The shelf you stand at: wood top, a rail with posts and a string of bulbs, a plant and a mug (its steam is a separate layer)."""
    im = canvas(); wood, rail = rgb(P['wood']), rgb(P['rail'])
    box(im, 0, LEDGE, W, H, wood); box(im, 0, LEDGE, W, LEDGE + 1, shade(wood, 1.25)); box(im, 0, LEDGE + 2, W, LEDGE + 2, shade(wood, .75))
    for y in range(LEDGE + 8, H, 8): box(im, 0, y, W, y, shade(wood, .82))
    for x in range(6, W, 30): box(im, x, LEDGE + 3, x, H, shade(wood, .88))
    box(im, 0, 172, W, 173, rail); box(im, 0, 172, W, 172, shade(rail, 1.5))                                   # top rail
    for x in range(4, W, 22): box(im, x, 174, x + 1, LEDGE - 1, rail)                                          # posts
    box(im, 0, 0, 1, H, shade(rail, .9)); box(im, W - 2, 0, W - 1, H, shade(rail, .9))                         # the window frame's sides
    box(im, 2, 0, 2, H, shade(rail, 1.4)); box(im, W - 3, 0, W - 3, H, shade(rail, .7))
    c = rgb(P['lamp'])
    for x in range(3, W - 3):                                                                                  # bulbs on a wire along the rail
        u = (x % 26) / 26 * 2 - 1; y = 166 + int(4 * (1 - u * u))
        px(im, x, y, shade(rail, 1.4))
        if x % 11 == 0:
            px(im, x, y + 1, c); px(im, x, y + 2, shade(c, .8)); lights.append((x, y + 1, x, y + 2, 'bulb'))
            if P['night']: halo(im, x, y + 1, 3, c, .45)
    box(im, 18, 190, 28, 197, rgb('#b4503a')); box(im, 17, 188, 29, 189, rgb('#c8683f')); box(im, 18, 190, 18, 197, rgb('#d07a52'))     # plant pot
    for dx, dy, r, col in ((-4, -2, 4, '#5f9c62'), (5, -3, 4, '#6fb070'), (0, -7, 4, '#7fc080'), (-2, -5, 3, '#4f8a52')): disc(im, 23 + dx, 186 + dy, r, rgb(col))
    mx, my = 128, 187                                                                                          # mug
    box(im, mx, my, mx + 9, my + 8, rgb('#f4e8d0')); box(im, mx + 9, my, mx + 9, my + 8, rgb('#d8c8a8')); box(im, mx, my, mx + 9, my + 1, rgb('#6a3f2a'))
    box(im, mx + 10, my + 2, mx + 12, my + 2, rgb('#f4e8d0')); box(im, mx + 12, my + 2, mx + 12, my + 5, rgb('#f4e8d0')); box(im, mx + 10, my + 5, mx + 12, my + 5, rgb('#f4e8d0'))
    box(im, mx + 2, my + 4, mx + 3, my + 5, rgb('#e8704f'))
    return im, (mx + 4, my - 1)

def make_steam(anchor):
    frames = [canvas() for _ in range(3)]
    ax, ay = anchor
    for f in range(3):
        for i in range(5):
            px(frames[f], ax + (1 if (i + f) % 2 else -1) * (i % 3 != 0), ay - 2 - i * 2 - f, rgb('#ffffff') if i < 3 else rgb('#d8d0e8'))
    return frames

def make_haze(P):
    """Flat bands of haze where the city meets the sky, thinning out as it comes toward you."""
    im = canvas(); c = rgb(P['haze'])
    box(im, 0, HOR - 1, W, HOR + 3, c)
    for y in range(HOR + 4, HOR + 9):
        for x in range(W):
            if dith(x, y, .3 if y < HOR + 7 else .12): px(im, x, y, c)
    return im


# ------------------------------------------------------------------ the five scenes
BASE = dict(wood='#8a5a3a', rail='#3a2c3e', lamp='#ffd479', tree_p=.5, smoke_c=['#f4eef0', '#d8d0dc'], night=False, mover=None, mover2=None)
SCENES = {
    'dusk': dict(BASE, night=True, sky=['#3f3a72', '#5a4a8c', '#7d5a9e', '#a8629a', '#d0709a', '#e88580', '#f4a679', '#fbd08a'],
        sun=(98, HOR - 2, 11), sun_c='#fff1c1', sun_halo='#fde0a0', haze='#f7b98a', cloud=['#f6b48c', '#d98aa0'], clouds=4,
        far=['#8a6a9a', '#a07aa0'], roofs=['#b4523a', '#c8683f', '#8a4a3a', '#6d4a5e', '#d08a52', '#9a5a48'], walls=['#e8cfa8', '#d9b48a', '#c89a78'],
        road='#3a2c4e', walk='#6a5578', park='#6b8a52', trees=['#e8803a', '#f2a244'], win=dict(lit=['#ffd479', '#ffb557'], dim='#4c3d6c', p=.5),
        cars=['#e05a4b', '#f2b84b', '#f6e9d2', '#5b8fb9', '#7a9a6a'], parks=3, people=True, mover=('birds', 'sky', 30, 85)),
    'dawn': dict(BASE, sky=['#8fb8de', '#aec6e6', '#cfcae6', '#eec9d6', '#f8d2c4', '#fbe0b4', '#fdecc2', '#fff0cf'],
        sun=(70, HOR - 3, 10), sun_c='#fff8dc', sun_halo='#fff0c4', haze='#fdecc8', cloud=['#ffffff', '#f3d5dc'], clouds=4,
        far=['#cdb0c0', '#dcc0ca'], roofs=['#d9826a', '#e8a07e', '#c06f5e', '#9aa8c4', '#b9a0b8', '#e6b88a'], walls=['#fff1dc', '#f6dcc0', '#efe0d0'],
        road='#8a7a96', walk='#c8b8c8', park='#7fb070', trees=['#8cc080', '#f2b8c8'], win=dict(lit=['#ffe39a', '#ffd479'], dim='#9c8fb4', p=.1),
        cars=['#e8704f', '#f2b84b', '#ffffff', '#6aa0c8', '#9ac07a'], parks=3, people=True, smoke=True, gardens=True,
        mover=('balloon', 'sky', 40, 90), mover2=('birds', 'sky', 20, 110)),
    'rain': dict(BASE, night=True, sky=['#27304f', '#2f3a5c', '#3a4668', '#465475', '#566684', '#6a7a94'],
        haze='#7f8fa6', cloud=['#4a5878', '#38466a'], clouds=8, far=['#4c5a78', '#566684'],
        roofs=['#2f5a5e', '#3a4a68', '#5a4a6e', '#7a5a54', '#3f6a6a', '#54607a'], walls=['#8a8aa0', '#9a9098', '#7e8aa0'],
        road='#242c44', walk='#4a5878', park='#3f6a5c', trees=['#4f8a78', '#5f9a88'], win=dict(lit=['#ffcf72', '#ffb054'], dim='#2d3858', p=.6),
        cars=['#e8704f', '#f2b84b', '#e9e2d0', '#6aa0c8'], umbrellas=['#e05a4b', '#f2b84b', '#4aa3a0', '#d46aa0', '#5b8fe0'], parks=2, fall='rain'),
    'snow': dict(BASE, night=True, snow=True, sky=['#1e1b46', '#2c2760', '#3d3478', '#52408a', '#6a4c92', '#8a5a9a'], stars=42,
        haze='#a070a0', cloud=['#6a5a9c', '#4a3f80'], clouds=3, far=['#4a4580', '#5a4f8e'],
        roofs=['#8a4a5a', '#6d4a7a', '#9a5a48'], walls=['#d8c0a8', '#c8a898', '#b898a0'], road='#4a4678', walk='#cfc8ee', park='#dfe0f4',
        trees=['#2f5a4a', '#3f7260'], win=dict(lit=['#ffcf72', '#ffb054'], dim='#3a3470', p=.55), cars=['#e8704f', '#f2b84b', '#f4f1ff', '#7a9ac0'],
        parks=3, smoke=True, people=True, fall='snow', mover=('blimp', 'sky', 30, 80)),
    'afternoon': dict(BASE, sky=['#5fb0e8', '#7cc2ee', '#9ad2f2', '#b6e0f6', '#d2eef8', '#eaf6ee'],
        sun=(120, 26, 8), sun_c='#fff3b0', sun_halo='#fff8d0', haze='#e8f4ee', cloud=['#ffffff', '#d8e8f4'], clouds=5, far=['#a9c0d8', '#bcd0e0'],
        roofs=['#d9826a', '#c8683f', '#e8a07e', '#8aa0c0', '#b4523a', '#e6b88a'], walls=['#fff1dc', '#f6dcc0', '#efe0d0', '#e8d0b0'],
        road='#6a6a7a', walk='#d8d0c0', park='#5f9c62', trees=['#4f9c52', '#7fc070'], tree_p=.7, win=dict(lit=['#fff3b0', '#ffe28a'], dim='#7fb0d0', p=.04),
        cars=['#e05a4b', '#f2b84b', '#ffffff', '#5b8fb9', '#7a9a6a'], water=['#4a9ec8', '#8cc8dc'], river=3, parks=4, people=True, gardens=True,
        mover=('birds', 'sky', 36, 100)),
}
MOV = dict(balloon=sprite_balloon, blimp=sprite_blimp, birds=sprite_birds)

def build(name, P, seed):
    rng = random.Random(seed); lights, smokes = [], []
    rows = plan()
    parks = {(rng.randint(1, len(rows) - 1), rng.randint(0, len(SEGMENTS) - 1)) for _ in range(P.get('parks', 2))}
    sky, stars = make_sky(P, rng)
    files = {'sky': sky, 'clouds': make_clouds(P, rng)}
    layers = [dict(k='img', n='sky'), dict(k='drift', n='clouds', dur=300)]
    for j, key in enumerate(('mover', 'mover2')):                                                  # things that cross the sky
        if P.get(key):
            kind, _, y, dur = P[key]; files[key] = MOV[kind]()
            layers.append(dict(k='cross', n=key, w=files[key].width, y=y, dur=dur, off=.35 + j * .3))
    files['far'] = make_far(P, rng, lights); layers.append(dict(k='img', n='far'))
    files['ground'] = draw_ground(P, rng, rows, parks); layers.append(dict(k='img', n='ground'))
    for r in rows:                                                                                  # traffic, river boats, walkers
        s = r['s']; speed = 12 * s + 2
        if P.get('river') == r['k']:
            files[f'lane{r["k"]}'] = lane(P, rng, r['yf'] + r['gap'] // 2, s, 'boat'); layers.append(dict(k='strip', n=f'lane{r["k"]}', dur=round(W / (speed * .5)), rev=False))
            continue
        for i, y in enumerate([r['yf'] + 1, r['yf'] + r['gap'] - 2] if r['gap'] >= 5 else [r['yf'] + r['gap'] // 2]):
            n = f'lane{r["k"]}_{i}'; files[n] = lane(P, rng, y, s, 'car'); layers.append(dict(k='strip', n=n, dur=round(W / speed), rev=bool(i)))
        walkers = 'umbrella' if P.get('umbrellas') else 'people' if P.get('people') and s > .5 else None
        if walkers:
            n = f'walk{r["k"]}'; files[n] = lane(P, rng, r['yf'], s, walkers); layers.append(dict(k='strip', n=n, dur=round(W / (speed * .3)), rev=bool(r['k'] % 2)))
    files['bldg'] = draw_buildings(P, rng, rows, parks, lights, smokes); layers.append(dict(k='img', n='bldg'))
    if smokes:
        for i, f in enumerate(make_smoke(P, smokes)): files[f'smoke{i}'] = f
        layers.append(dict(k='frames', n='smoke', count=3, dur=7))
    files['haze'] = make_haze(P); layers.append(dict(k='img', n='haze'))
    ledge, anchor = make_ledge(P, lights)
    rng.shuffle(lights)                                                                             # lights that go off now and then
    A, B = canvas(), canvas(); cut = len(lights) // 6
    for im, group in ((A, lights[:cut]), (B, lights[cut:cut * 2])):
        for x0, y0, x1, y1, kind in group: box(im, x0, y0, x1, y1, sky.getpixel((x0, y0)) if kind == 'beacon' else rgb(P['win']['dim']) if kind == 'win' else shade(rgb(P['rail']), 1.3))
    for i, (x, y) in enumerate(stars[::2]): px((A, B)[i % 2], x, y, sky.getpixel((x, y)))
    files['lightA'], files['lightB'] = A, B; layers += [dict(k='blink', n='lightA', cls='wp-a'), dict(k='blink', n='lightB', cls='wp-b')]
    if P.get('fall'):
        files['fall1'] = fall(P['fall'], rng, 50 if P['fall'] == 'rain' else 55, False); files['fall2'] = fall(P['fall'], rng, 34 if P['fall'] == 'rain' else 35, True)
        layers += [dict(k='fall', n='fall1', kind=P['fall'], cls='wp-f1'), dict(k='fall', n='fall2', kind=P['fall'], cls='wp-f2')]
    files['ledge'] = ledge; layers.append(dict(k='img', n='ledge'))
    for i, f in enumerate(make_steam(anchor)): files[f'steam{i}'] = f
    layers.append(dict(k='frames', n='steam', count=3, dur=4.5))
    for k, im in files.items(): im.save(OUT / f'{name}-{k}.png')
    comp = Image.alpha_composite(Image.alpha_composite(sky, files['far']), files['ground'])
    comp = Image.alpha_composite(Image.alpha_composite(comp, files['bldg']), files['haze'])
    return dict(bg=P['sky'][-1], layers=layers), comp

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob('*.png'): f.unlink()
    meta = {}
    for i, (name, P) in enumerate(SCENES.items()):
        meta[name], comp = build(name, P, 300 + i)
        if name == 'dusk':                                            # email header: rooftops at dusk, 4x
            comp.crop((0, 96, W, 96 + 34)).resize((W * 4, 34 * 4), Image.NEAREST).convert('RGB').save(ROOT / 'public/pixel/email-banner.png')
    (ROOT / 'src/city-scenes.json').write_text(json.dumps(meta, separators=(',', ':')))
    print('built', ', '.join(meta))

if __name__ == '__main__':
    main()
