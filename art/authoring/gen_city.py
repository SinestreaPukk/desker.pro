#!/usr/bin/env python3
"""Cozy pixel-art city wallpapers for the sign-in screens (160x200 art pixels, no avatar, everything moves).

Five scenes, one per screen: dusk (sign in), dawn (sign up), rain (forgot / reset password), snow (check your inbox),
afternoon (welcome). Each is drawn once, back to front, as separate layers so CSS can move them in whole art pixels:
  sky (opaque) / clouds (2x wide, loops) / city (transparent) / lights A+B (windows switching off and on) /
  movers (train, bus, balloon, blimp, boat, birds) / fall (rain or snow tile, loops vertically)
Also writes the email header (public/pixel/email-banner.png).

Palette: warm and hand-picked per scene (the app's yuki16 is cold; these are the one cozy exception, like kodama).
Output: public/pixel/city/<scene>-<layer>.png, src/city-scenes.json.   Usage: python3 art/authoring/gen_city.py
"""
import json, pathlib, random
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / 'public/pixel/city'
W, H = 160, 200
GROUND = 172                                   # y of the street's top edge
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
dith = lambda x, y, t: BAYER[y % 4][x % 4] < t * 16
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
shade = lambda c, k: tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def canvas(w=W, h=H, fill=(0, 0, 0, 0)): return Image.new('RGBA', (w, h), fill)
def px(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height: im.putpixel((x, y), c)
def box(im, x0, y0, x1, y1, c): ImageDraw.Draw(im).rectangle([x0, y0, x1, y1], fill=c)
def disc(im, cx, cy, r, c):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r // 2: px(im, x, y, c)
def glow(im, cx, cy, r, c, t=.5):
    """Dithered halo: only paints over transparent pixels or the pixels in `over`."""
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** .5
            if d <= r and dith(x, y, t * (1 - d / r)) and 0 <= x < im.width and 0 <= y < im.height and im.getpixel((x, y))[3] == 0: px(im, x, y, c)


# ------------------------------------------------------------------ sky, clouds, stars
def sky(P, rng):
    im = canvas(fill=rgb(P['sky'][-1]))
    bands = [rgb(c) for c in P['sky']]
    n, span = len(bands), GROUND - 10
    for y in range(H):
        f = min(y / span, .999) * (n - 1); i = int(f); t = f - i
        for x in range(W):
            px(im, x, y, bands[i + 1] if i + 1 < n and dith(x, y, t) else bands[i])
    if 'sun' in P:
        cx, cy, r = P['sun']
        for rr, t in ((r + 9, .22), (r + 5, .4)): glow_sky(im, cx, cy, rr, rgb(P['sun_halo']), t)
        disc(im, cx, cy, r, rgb(P['sun_c']))
    stars = []
    for _ in range(P.get('stars', 0)):
        x, y = rng.randint(2, W - 3), rng.randint(2, 92)
        px(im, x, y, rgb('#fff6dc')); stars.append((x, y))
    return im, stars
def glow_sky(im, cx, cy, r, c, t):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and dith(x, y, t): px(im, x, y, c)

def clouds(P, rng):
    """Flat-bottomed puffs, lit on top. Drawn twice (x and x+W) into a 2W canvas so a W-pixel drift loops."""
    im = canvas(W * 2, H)
    hi, lo = rgb(P['cloud'][0]), rgb(P['cloud'][1])
    for _ in range(P.get('clouds', 5)):
        cx, cy, w = rng.randint(0, W - 1), rng.randint(14, P.get('cloud_y', 80)), rng.randint(22, 44)
        h = max(4, w // 5)
        for off in (0, W):
            for x in range(cx - w // 2, cx + w // 2):
                u = 1 - abs(x - cx) / (w / 2)
                top = h - 1 - int((h - 1) * (u ** .6))
                bump = int(2 * max(0, 1 - abs(x - cx - w // 6) / (w / 5)))
                for j in range(max(0, top - bump), h):
                    px(im, x + off, cy + j, lo if j >= h - 2 else hi)
    return im


# ------------------------------------------------------------------ buildings
def layer(im, P, rng, base, hmin, hmax, wmin, wmax, body, windows=None, details=True, snow=False, x0=-6):
    """One row of buildings. Returns the lit windows (x, y) so some can flicker."""
    body = rgb(body); side = shade(body, .82); edge = shade(body, 1.12)
    lit_w = []
    x = x0
    while x < W:
        w, h = rng.randint(wmin, wmax), rng.randint(hmin, hmax)
        top = base - h
        box(im, x, top, x + w - 1, base, body)
        box(im, x + w - 2, top, x + w - 1, base, side)               # shaded right face
        box(im, x, top, x + w - 1, top, edge)                        # lit roof edge
        if details:
            kind = rng.random()
            if kind < .25:                                           # gable roof
                for j in range(w // 2 - 1): box(im, x + j + 1, top - 1 - j, x + w - j - 2, top - 1 - j, shade(body, .9 if j % 2 else .95))
            elif kind < .45: box(im, x + w // 2, top - 5, x + w // 2, top - 1, side)           # antenna
            elif kind < .6:                                          # chimney
                cx = x + rng.randint(2, max(2, w - 5)); box(im, cx, top - 4, cx + 2, top - 1, side)
                if snow: box(im, cx, top - 5, cx + 2, top - 5, rgb('#f4f1ff'))
            elif kind < .72 and w > 12:                              # rooftop water tower
                cx = x + w // 2 - 2; box(im, cx, top - 4, cx + 4, top - 2, shade(body, .7)); px(im, cx + 1, top - 1, side); px(im, cx + 3, top - 1, side)
        if snow: box(im, x - 1, top - 1, x + w, top, rgb('#f4f1ff')); box(im, x - 1, top + 1, x + w, top + 1, rgb('#cfc8ee'))
        if windows:
            on, on2, off, p = rgb(windows['lit'][0]), rgb(windows['lit'][1]), rgb(windows['dim']), windows['p']
            for wy in range(top + 4, base - 6, 7):
                for wx in range(x + 3, x + w - 5, 5):
                    lit = rng.random() < p
                    c = (on if rng.random() < .6 else on2) if lit else off
                    box(im, wx, wy, wx + 2, wy + 3, c)
                    px(im, wx, wy + 4, side)                          # sill
                    if not lit: px(im, wx, wy, shade(off, 1.25))      # glass glint
                    else: lit_w.append((wx, wy, wx + 2, wy + 3))
        x += w + rng.randint(0, 2)
    return lit_w

def street(im, P, rng):
    g, walk = rgb(P['ground']), rgb(P['walk'])
    box(im, 0, GROUND, W, H, g)
    box(im, 0, GROUND, W, GROUND + 2, walk); box(im, 0, GROUND + 3, W, GROUND + 3, shade(walk, .8))
    if P.get('snow_ground'):
        for y in range(GROUND, H):
            for x in range(W): px(im, x, y, rgb('#eae6f8') if (y - GROUND) < 6 or dith(x, y, .55) else rgb('#d6d0ee'))
        for x in range(0, W, 4): px(im, x + rng.randint(0, 3), GROUND + rng.randint(8, 26), rgb('#ffffff'))
    elif P.get('water'):
        for y in range(GROUND + 4, H):
            for x in range(W): px(im, x, y, rgb(P['water'][0]) if (x + y // 2) % 9 else rgb(P['water'][1]))
        box(im, 0, GROUND + 3, W, GROUND + 5, rgb(P['walk']))
    else:                                                             # road dashes
        for x in range(4, W, 22): box(im, x, H - 12, x + 9, H - 11, shade(walk, 1.15))
        if P.get('wet'):                                              # puddle sheen
            for x in range(0, W, 3):
                for y in range(GROUND + 5, H, 5): px(im, x + (y % 6), y, shade(g, 1.35))

def lamp(im, x, P):
    c = rgb(P['lamp'])
    box(im, x, GROUND - 26, x, GROUND + 1, rgb(P['pole'])); box(im, x - 1, GROUND - 28, x + 1, GROUND - 26, c)
    glow(im, x, GROUND - 26, 13, c, .55)
    if P.get('wet'):                                                  # reflection streak
        for y in range(GROUND + 6, H, 2): px(im, x + (1 if y % 4 else 0), y, c if y < GROUND + 22 else shade(c, .7))

def tree(im, x, base, c1, c2, r=7, snow=False):
    box(im, x, base - r, x + 1, base, rgb('#6b4a3a'))
    for dx, dy, rr in ((-r // 2, -r - 2, r - 2), (r // 2, -r - 2, r - 2), (0, -r - 7, r - 1)):
        disc(im, x + dx, base + dy, rr, rgb(c2))
    for dx, dy, rr in ((-r // 2 - 1, -r - 4, r - 4), (r // 2 - 1, -r - 4, r - 4), (-1, -r - 9, r - 4)):
        disc(im, x + dx, base + dy, rr, rgb(c1))
def pine(im, x, base, snow=True):
    """Four tiers of boughs, each a narrowing triangle, with a snow line on top of each."""
    box(im, x - 1, base - 3, x + 1, base, rgb('#5a3f33'))
    for i in range(4):
        half = 9 - i * 2
        for r in range(7):
            w = max(1, half - r * half // 7)
            y = base - 4 - i * 6 - r
            box(im, x - w, y, x + w, y, rgb('#3f7260') if r % 3 == 0 else rgb('#2f5a4a'))
        if snow: box(im, x - 2, base - 4 - i * 6 - 6, x + 2, base - 4 - i * 6 - 5, rgb('#f4f1ff'))

def shop(im, P, rng):
    """The lit corner shop: striped awning, big warm window, a little sign, flower boxes."""
    x0, x1, top = 4, 56, GROUND - 40
    box(im, x0, top, x1, GROUND, rgb(P['shop']))
    box(im, x1 - 2, top, x1, GROUND, shade(rgb(P['shop']), .82)); box(im, x0, top, x1, top, shade(rgb(P['shop']), 1.15))
    a, b = rgb(P['awning'][0]), rgb(P['awning'][1])
    for i, x in enumerate(range(x0 - 2, x1 + 3, 4)): box(im, x, top + 14, x + 3, top + 19, a if i % 2 else b); box(im, x, top + 20, x + 3, top + 20, shade(a if i % 2 else b, .75))
    box(im, x0 + 5, top + 23, x1 - 12, GROUND - 2, rgb(P['shop_win']))                       # window
    box(im, x0 + 5, top + 23, x1 - 12, top + 24, shade(rgb(P['shop_win']), 1.18))
    for k in range(3):                                                                         # shelves / mugs
        box(im, x0 + 8, top + 29 + k * 4, x1 - 15, top + 29 + k * 4, shade(rgb(P['shop_win']), .7))
        for m in range(0, x1 - x0 - 26, 6): box(im, x0 + 10 + m, top + 26 + k * 4, x0 + 11 + m, top + 28 + k * 4, rgb(P['mug']))
    box(im, x1 - 9, top + 23, x1 - 4, GROUND, shade(rgb(P['shop']), .65))                      # door
    px(im, x1 - 8, GROUND - 8, rgb(P['lamp']))
    box(im, x0 + 8, top + 3, x1 - 8, top + 10, shade(rgb(P['shop']), .7))                      # sign
    for x in range(x0 + 11, x1 - 10, 3): box(im, x, top + 5, x + 1, top + 8, rgb(P['lamp']))
    for x in range(x0 + 6, x1 - 12, 5): box(im, x, GROUND - 1, x + 3, GROUND - 1, rgb('#7a4f3a')); px(im, x + 1, GROUND - 3, rgb('#e86a6a')); px(im, x + 3, GROUND - 2, rgb('#f4c95d')); px(im, x + 2, GROUND - 2, rgb('#6fa36a'))

def string_lights(im, P):
    """Bulbs on a wire that sags between poles every 30px."""
    c = rgb(P['lamp'])
    for x in range(58, W):
        u = ((x - 58) % 30) / 30 * 2 - 1
        y = GROUND - 46 + int(5 * (1 - u * u))
        px(im, x, y, shade(rgb(P['pole']), 1.3))
        if x % 5 == 0: px(im, x, y + 1, c); px(im, x, y + 2, shade(c, .8))


# ------------------------------------------------------------------ things that move
def sprite_train():
    im = canvas(60, 12); body = rgb('#f2d8b0'); roof = rgb('#c8765a')
    for c in range(3):
        x0 = c * 20
        box(im, x0, 1, x0 + 18, 10, body); box(im, x0, 1, x0 + 18, 2, roof); box(im, x0, 10, x0 + 18, 10, shade(body, .7))
        for k in range(4): box(im, x0 + 2 + k * 4, 4, x0 + 4 + k * 4, 7, rgb('#ffd479'))
        box(im, x0 + 19, 6, x0 + 19, 8, rgb('#7a5a4a'))
    return im
def sprite_bus():
    im = canvas(34, 14); body = rgb('#e8704f')
    box(im, 0, 2, 32, 11, body); box(im, 0, 2, 32, 3, shade(body, 1.2)); box(im, 0, 11, 32, 11, shade(body, .7)); box(im, 0, 8, 32, 8, rgb('#f4e8d0'))
    for k in range(6): box(im, 3 + k * 5, 4, 6 + k * 5, 7, rgb('#ffd479'))
    box(im, 29, 4, 31, 9, rgb('#ffe9a8'))
    for x in (6, 24): disc(im, x, 12, 2, rgb('#1b2438')); px(im, x, 12, rgb('#8a93a8'))
    return im
def sprite_balloon():
    im = canvas(18, 28); cols = [rgb('#e8704f'), rgb('#f4e8d0'), rgb('#f2b84b')]
    for y in range(0, 17):
        half = int(8 * ((1 - ((y - 8) / 9) ** 2) ** .5)) if y < 17 else 0
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
    box(im, 13, 11, 13, 11, rgb('#7a5a4a')); box(im, 27, 11, 27, 11, rgb('#7a5a4a'))
    px(im, 20, 1, rgb('#ff6a5a'))
    return im
def sprite_boat():
    im = canvas(24, 20)
    box(im, 11, 2, 11, 14, rgb('#7a5a4a'))
    for y in range(3, 13):
        for x in range(12, 12 + (13 - y)): px(im, x, y, rgb('#fff6e4') if x - 12 < (13 - y) - 1 else rgb('#e8dcc4'))
    for y in range(5, 13): px(im, 10 - (13 - y) // 2, y, rgb('#f2b84b'))
    for x in range(4, 20): box(im, x, 15 if 6 <= x <= 17 else 14, x, 16 if 6 <= x <= 17 else 15, rgb('#c8765a'))
    box(im, 5, 14, 18, 14, rgb('#e8704f'))
    return im
def sprite_birds():
    im = canvas(26, 10)
    for x, y in ((2, 3), (11, 0), (18, 5), (7, 7)):
        c = rgb('#4a3f5e')
        px(im, x, y + 1, c); px(im, x + 1, y, c); px(im, x + 2, y + 1, c); px(im, x + 3, y, c); px(im, x + 4, y + 1, c)
    return im

def fall(kind, rng, w=W, h=H, n=70, dim=False):
    """A tile that loops vertically (everything wraps), moved down by CSS."""
    im = canvas(w, h)
    for _ in range(n):
        x, y = rng.randint(0, w - 1), rng.randint(0, h - 1)
        if kind == 'rain':
            c = rgb('#8fb4cf' if dim else '#c4e0f2')
            for k in range(4): px(im, (x - k // 2) % w, (y + k) % h, c)
        else:
            c = rgb('#ffffff' if not dim else '#d6d0ee')
            px(im, x, y, c)
            if rng.random() < .3: px(im, (x + 1) % w, y, c); px(im, x, (y + 1) % h, c)
    return im


# ------------------------------------------------------------------ the five scenes
LIGHT = dict(lamp='#ffd479', pole='#2a2238', awning=['#e05a4b', '#f6e9d2'], mug='#f6e9d2')
SCENES = {
    'dusk': dict(**LIGHT, sky=['#3f3a72', '#5a4a8c', '#7d5a9e', '#a8629a', '#d0709a', '#e88580', '#f4a679', '#fbd08a', '#fde4ac'],
        sun=(104, 126, 12), sun_c='#fff1c1', sun_halo='#fde0a0', cloud=['#f6b48c', '#d98aa0'], clouds=5, cloud_y=96,
        far='#8a6a9a', mid='#5d4780', near='#3a2c58', win=dict(lit=['#ffd479', '#ffb557'], dim='#4c3d6c', p=.5),
        ground='#2b2140', walk='#4a3a62', shop='#4a3a62', shop_win='#ffcf70', mover=('train', 'front', 118, 70)),
    'dawn': dict(**LIGHT, sky=['#8fb8de', '#aec6e6', '#cfcae6', '#eec9d6', '#f8d2c4', '#fbe0b4', '#fdecc2', '#fff6d9'],
        sun=(78, 132, 11), sun_c='#fff8dc', sun_halo='#fff0c4', cloud=['#ffffff', '#f3d5dc'], clouds=5, cloud_y=90,
        far='#cdb0c0', mid='#ad90ac', near='#86709a', win=dict(lit=['#ffe39a', '#ffd479'], dim='#9c8fb4', p=.18),
        ground='#6c5a7a', walk='#a592b0', shop='#b99ab0', shop_win='#ffe39a', plants=True, mover=('balloon', 'sky', 56, 90)),
    'rain': dict(**LIGHT, sky=['#1d2a46', '#243556', '#2c4264', '#355174', '#3f5f80', '#4c6d8a'],
        cloud=['#3b5272', '#2c4260'], clouds=9, cloud_y=70, far='#34506a', mid='#27415b', near='#1b2f46',
        win=dict(lit=['#ffcf72', '#ffb054'], dim='#2d4660', p=.6), ground='#16243a', walk='#2f4560', shop='#2d4660', shop_win='#ffcf72',
        wet=True, fall='rain', mover=('bus', 'front', 178, 46)),
    'snow': dict(**LIGHT, sky=['#1e1b46', '#2c2760', '#3d3478', '#52408a', '#6a4c92', '#84599a'], stars=40,
        cloud=['#6a5a9c', '#4a3f80'], clouds=4, cloud_y=60, far='#4a4580', mid='#38336a', near='#2a2552',
        win=dict(lit=['#ffcf72', '#ffb054'], dim='#3a3470', p=.55), ground='#2a2552', walk='#cfc8ee', shop='#463f7c', shop_win='#ffcf72',
        snow=True, snow_ground=True, fall='snow', mover=('blimp', 'sky', 30, 80)),
    'afternoon': dict(**LIGHT, sky=['#6fb6e8', '#8cc6ee', '#a9d5f2', '#c4e2f5', '#dff0f6', '#f4f7e8'],
        sun=(128, 30, 8), sun_c='#fff3b0', sun_halo='#fff8d0', cloud=['#ffffff', '#d8e8f4'], clouds=6, cloud_y=86,
        far='#b9c9de', mid='#e6c1a2', near='#d99a7e', win=dict(lit=['#fff3b0', '#ffe28a'], dim='#7fb0d0', p=.12),
        ground='#8c6a5a', walk='#c8a98c', shop='#e8c9a8', shop_win='#9ed0ea', water=['#5aa5c8', '#8cc8dc'], trees=True, mover=('boat', 'front', 164, 60)),
}
MOVERS = dict(train=sprite_train, bus=sprite_bus, balloon=sprite_balloon, blimp=sprite_blimp, boat=sprite_boat)

def build(name, P, seed):
    rng = random.Random(seed)
    s, stars = sky(P, rng)
    cl = clouds(P, rng)
    city = canvas()
    lits = []
    lits += layer(city, P, rng, GROUND - 22, 22, 46, 10, 18, P['far'], details=False, snow=P.get('snow', False))
    lits += layer(city, P, rng, GROUND - 6, 48, 84, 12, 20, P['mid'], windows=P['win'], snow=P.get('snow', False), x0=-3)
    lits += layer(city, P, rng, GROUND, 62, 112, 14, 24, P['near'], windows=P['win'], snow=P.get('snow', False), x0=-8)
    street(city, P, rng)
    if not P.get('water'): shop(city, P, rng); string_lights(city, P)
    else: box(city, 0, GROUND - 3, W, GROUND, rgb(P['walk']))
    for x in (74, 128) if not P.get('water') else (): lamp(city, x, P)
    if P.get('trees'):
        for x in (12, 62, 108, 150): tree(city, x, GROUND, '#8cc080', '#5f9c62')
    if P.get('snow'):
        for x in (68, 100, 146): pine(city, x, GROUND)
    if P.get('plants'):                                               # rooftop gardens + a clothesline
        for x in range(8, W - 8, 23): box(city, x, GROUND - 56 + (x % 7), x + 3, GROUND - 56 + (x % 7), rgb('#6fa36a')); px(city, x + 1, GROUND - 57 + (x % 7), rgb('#8cc080')); px(city, x + 2, GROUND - 58 + (x % 7), rgb('#e86a6a'))
        for x in range(96, 140): px(city, x, GROUND - 14 + (x % 9 == 0), rgb('#4a3f5e'))
        for x, c in ((100, '#f6e9d2'), (108, '#e8704f'), (116, '#8fb8de'), (126, '#f2b84b')): box(city, x, GROUND - 13, x + 3, GROUND - 8, rgb(c))
    # windows that switch off now and then, and twinkling stars
    rng.shuffle(lits)
    cut = len(lits) // 7
    lightA, lightB = canvas(), canvas()
    for im, group in ((lightA, lits[:cut]), (lightB, lits[cut:cut * 2])):
        for x0, y0, x1, y1 in group: box(im, x0, y0, x1, y1, rgb(P['win']['dim']))
    for i, (x, y) in enumerate(stars[::2]): px((lightA, lightB)[i % 2], x, y, s.getpixel((x, y)))
    out = {'sky': s, 'clouds': cl, 'city': city, 'lightA': lightA, 'lightB': lightB}
    meta = {'bg': P['sky'][-1], 'top': P['sky'][0], 'fall': P.get('fall')}
    if P.get('fall'):
        out['fall1'] = fall(P['fall'], rng, n=60 if P['fall'] == 'rain' else 55)
        out['fall2'] = fall(P['fall'], rng, n=40 if P['fall'] == 'rain' else 35, dim=True)
    kind, where, y, dur = P['mover']
    sp = MOVERS[kind]()
    out['mover'] = sp
    meta['mover'] = dict(w=sp.width, h=sp.height, y=y, layer=where, dur=dur)
    if name in ('dawn', 'snow'):                                      # a second, smaller one: birds over the roofs / none
        if name == 'dawn': out['mover2'] = sprite_birds(); meta['mover2'] = dict(w=26, h=10, y=34, layer='sky', dur=95)
    for k, im in out.items(): im.save(OUT / f'{name}-{k}.png')
    return meta, s, city

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for i, (name, P) in enumerate(SCENES.items()):
        meta[name], s, city = build(name, P, 100 + i)
        if name == 'dusk':                                            # email header: the skyline band, 4x
            band = Image.alpha_composite(s, city).crop((0, 74, W, 74 + 30)).resize((W * 4, 30 * 4), Image.NEAREST)
            band.convert('RGB').save(ROOT / 'public/pixel/email-banner.png')
    (ROOT / 'src/city-scenes.json').write_text(json.dumps(meta, indent=1))
    print('built', ', '.join(meta))

if __name__ == '__main__':
    main()
