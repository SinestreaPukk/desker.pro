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
SKYH = 112        # the sky gradient runs this far down, behind the skyline
BASE_Y = 156      # where the towers stand; the street runs below
KEEP_LIT = .5     # share of lit windows that stay lit
thin = random.Random(7)   # its own dice, so thinning never moves a tower
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
    for y in range(SKYH):
        f = min(y / SKYH, .999) * (n - 1); i = int(f); t = f - i
        for x in range(W): px(im, x, y, bands[i + 1] if i + 1 < n and dith(x, y, t) else bands[i])
    box(im, 0, SKYH, W, H, bands[-1])
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

# ------------------------------------------------------------------ the skyline: three tiers of towers, back to front
TIERS = dict(far=(8, 15, 84, 120, .22, False), mid=(12, 24, 52, 104, .5, True), near=(14, 30, 118, 146, .55, True))   # width, top y, window density, blinks

def tower(im, rng, P, x0, w, top, c, dens, lights, reg, tier):
    x1, c = x0 + w - 1, shade(c, rng.uniform(.9, 1.12))
    box(im, x0, top, x1, BASE_Y, c); box(im, x0, top, x0, BASE_Y, shade(c, 1.2)); box(im, x1, top, x1, BASE_Y, shade(c, .7)); box(im, x0, top, x1, top, shade(c, 1.3))
    if w >= 12 and tier != 'near' and rng.random() < .45:                           # a setback crown
        box(im, x0 + 3, top - 5, x1 - 3, top, c); box(im, x0 + 3, top - 5, x1 - 3, top - 5, shade(c, 1.3)); box(im, x1 - 3, top - 5, x1 - 3, top, shade(c, .7)); top -= 5
    if P.get('snow'): box(im, x0, top, x1, top + 1, rgb('#f4f1ff'))
    win = P['win']
    for wy in range(top + 3, BASE_Y - 1, 3):
        rowp = dens * rng.choice([.2, 1, 1, 1.5])                                    # whole floors are lit or dark, like offices
        for wx in range(x0 + 2, x1 - 1, 2):
            lit = rng.random() < rowp
            col = rng.choice(win['cool']) if lit and rng.random() < win['cool_p'] else rng.choice(win['lit']) if lit else win['dim']
            if lit and thin.random() >= KEEP_LIT: lit, col = False, win['dim']      # the same towers as ever, but a quieter night: only some lit windows stay lit
            px(im, wx, wy, rgb(col))
            if lit and reg: lights.append((wx, wy, wx, wy, 'win'))
    if P['night'] and tier != 'far' and w >= 10 and rng.random() < .3:             # a lit crown band
        box(im, x0 + 1, top + 1, x1 - 1, top + 1, rgb('#bfe6ff')); lights.append((x0 + 1, top + 1, x1 - 1, top + 1, 'bulb'))
    if tier != 'near' and rng.random() < .35 and top > 14:                           # antenna with a beacon
        ax = rng.randint(x0 + 2, x1 - 2); box(im, ax, top - 8, ax, top - 1, shade(c, .9)); px(im, ax, top - 9, rgb('#ff6a5a')); lights.append((ax, top - 9, ax, top - 9, 'beacon'))

def towers(P, rng, lights, tier):
    wmin, wmax, tmin, tmax, dens, reg = TIERS[tier]
    c = rgb(P['tw'][tier]); im = canvas(); x = -6
    while x < W:
        w, top = rng.randint(wmin, wmax), rng.randint(tmin, tmax)
        if tier == 'mid' and rng.random() < .2: top = max(40, top - rng.randint(10, 25))
        tower(im, rng, P, x, w, top, c, dens, lights, reg and True, tier)
        x += w + rng.randint(-2, 1)
    return im

def make_street(P, rng):
    """The street at the foot of the towers: kerb, warm shop glow at night, lamp pools."""
    g = canvas(); box(g, 0, BASE_Y + 1, W, H, rgb(P['road'])); box(g, 0, BASE_Y + 1, W, BASE_Y + 1, rgb(P['walk']))
    for x in range(0, W, 8): box(g, x, 162, x + 3, 162, shade(rgb(P['walk']), 1.05))
    if P['night']:
        for x in range(1, W, 3):
            if rng.random() < .5: px(g, x, BASE_Y + 2, rgb(rng.choice(P['win']['lit'])))
        for x in range(8, W, 22): halo(g, x, BASE_Y + 3, 6, rgb(P['lamp']), .5)
    return g

def beams(P, rng, y, head):
    """Light streaks of night traffic; a 2W strip so moving it W pixels loops."""
    im = canvas(W * 2, H); c = rgb('#fff3c0' if head else '#e8503a')
    for x in sorted(rng.sample(range(0, W - 4), 9)):
        for off in (0, W): box(im, x + off, y, x + off + 1, y, c); px(im, x + off + 2, y, shade(c, .6))
    return im

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
    """Atmosphere: dithered haze that thickens toward the foot of the far towers, so the distance looks distant."""
    im = canvas(); c = rgb(P['haze'])
    for y in range(90, 152):
        for x in range(W):
            if dith(x, y, .6 * (y - 90) / 62): px(im, x, y, c)
    return im


# ------------------------------------------------------------------ the five scenes
BASE = dict(wood='#8a5a3a', rail='#3a2c3e', lamp='#ffd479', night=False, mover=None, mover2=None)
WARM = ['#ffd479', '#ffb557', '#ffe9a8']; COOL = ['#9fd4ff', '#dff1ff']
SCENES = {
    'dusk': dict(BASE, night=True, sky=['#0a1030', '#0f1a42', '#15255a', '#1d3070', '#2a3f82', '#43508e', '#7a5a8e', '#d98a78'], stars=30,
        haze='#3a4a86', cloud=['#2a3a72', '#1d2a5c'], clouds=3, tw=dict(far='#27386a', mid='#17214a', near='#0d1330'),
        win=dict(lit=WARM, cool=COOL, cool_p=.14, dim='#1c2850'), road='#0d1330', walk='#3a3a70', mover=('birds', 'sky', 30, 85)),
}
MOV = dict(balloon=sprite_balloon, blimp=sprite_blimp, birds=sprite_birds)

def build(name, P, seed):
    rng = random.Random(seed); lights = []
    sky, stars = make_sky(P, rng)
    files = {'sky': sky, 'clouds': make_clouds(P, rng)}
    layers = [dict(k='img', n='sky'), dict(k='drift', n='clouds', dur=300)]
    for j, key in enumerate(('mover', 'mover2')):                                                  # things that cross the sky
        if P.get(key):
            kind, _, y, dur = P[key]; files[key] = MOV[kind]()
            layers.append(dict(k='cross', n=key, w=files[key].width, y=y, dur=dur, off=.35 + j * .3))
    files['far'] = towers(P, rng, lights, 'far'); files['haze'] = make_haze(P)
    files['mid'] = towers(P, rng, lights, 'mid'); files['near'] = towers(P, rng, lights, 'near'); files['ground'] = make_street(P, rng)
    layers += [dict(k='img', n=n) for n in ('far', 'haze', 'mid', 'near', 'ground')]
    for i, y in enumerate((159, 164)):                                                              # traffic on the street below
        n = f'lane{i}'; files[n] = beams(P, rng, y, not i) if P['night'] else lane(P, rng, y, .85, 'car')
        layers.append(dict(k='strip', n=n, dur=9 + i * 6, rev=bool(i)))
    rng.shuffle(lights)                                                                             # lights that go off now and then
    A, B = canvas(), canvas(); cut = len(lights) // 6
    for im, group in ((A, lights[:cut]), (B, lights[cut:cut * 2])):
        for x0, y0, x1, y1, kind in group: box(im, x0, y0, x1, y1, sky.getpixel((x0, y0)) if kind == 'beacon' else rgb(P['win']['dim']) if kind in ('win', 'bulb') and y0 < BASE_Y else shade(rgb(P['rail']), 1.3))
    for i, (x, y) in enumerate(stars[::2]): px((A, B)[i % 2], x, y, sky.getpixel((x, y)))
    files['lightA'], files['lightB'] = A, B; layers += [dict(k='blink', n='lightA', cls='wp-a'), dict(k='blink', n='lightB', cls='wp-b')]
    if P.get('fall'):
        files['fall1'] = fall(P['fall'], rng, 50 if P['fall'] == 'rain' else 55, False); files['fall2'] = fall(P['fall'], rng, 34 if P['fall'] == 'rain' else 35, True)
        layers += [dict(k='fall', n='fall1', kind=P['fall'], cls='wp-f1'), dict(k='fall', n='fall2', kind=P['fall'], cls='wp-f2')]
    for k, im in files.items(): im.save(OUT / f'{name}-{k}.png')
    comp = sky
    for k in ('far', 'haze', 'mid', 'near', 'ground'): comp = Image.alpha_composite(comp, files[k])
    return dict(bg=P['sky'][-1], layers=layers), comp

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob('*.png'): f.unlink()
    meta = {}
    for i, (name, P) in enumerate(SCENES.items()):
        meta[name], comp = build(name, P, 300 + i)
        if name == 'dusk':                                            # email header: night towers, 4x
            comp.crop((0, 70, W, 70 + 34)).resize((W * 4, 34 * 4), Image.NEAREST).convert('RGB').save(ROOT / 'public/pixel/email-banner.png')
    (ROOT / 'src/city-scenes.json').write_text(json.dumps(meta, separators=(',', ':')))
    print('built', ', '.join(meta))

if __name__ == '__main__':
    main()
