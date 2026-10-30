#!/usr/bin/env python3
"""Compose the lakeside snow scene from a text tilemap + prop sprites, then palette-swap it.

One scene is drawn (morning palette). Dusk and night are the same pixels run through a colour
remap table: every key and value is a yuki16 name, so the 16-colour budget holds by construction.
Output: public/pixel/scene-{morning,dusk,night}.png (192x80, 1x) and scene.json (avatar anchor).

Usage: python3 art/scene_build.py
"""
import importlib.util, json, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('sprite_build', ROOT / 'pixel-kit/tools/sprite_build.py')
sb = importlib.util.module_from_spec(spec); spec.loader.exec_module(sb)
PAL = json.loads((ROOT / 'pixel-kit/art/palette/yuki16.json').read_text())['colors']
W, H, T = 192, 80, 16

# 16x16 tiles: ('solid', a) or ('checker', a, b). Checker is the 2x2-free 1px ordered dither.
TILES = {
    'A': ('solid', 'kori-1'), 'C': ('checker', 'kori-1', 'yuki-1'), 'B': ('solid', 'yuki-1'),
    'v': ('checker', 'kori-1', 'kori-2'), 'w': ('solid', 'kori-2'),
    'g': ('solid', 'yuki-0'), 'x': ('checker', 'yuki-0', 'yuki-1'),
}
MAP = [
    'AAAAAAAAAAAA',
    'CCCCCCCCCCCC',
    'BBBBBBBBBBBB',
    'gggvvvvvvvgg',
    'gggggggggggg',
]
# (peak x, peak y, ridge): far snow range, then forested hills in front
FAR = [(20, 24), (66, 14), (118, 27), (160, 18)]
NEAR = [(8, 38), (50, 41), (96, 40), (140, 37), (186, 36)]
# sprite name, x, y   (y is the top row; bases land on the 64px shoreline)
PROPS = [('house', 4, 35), ('pine-s', 52, 46), ('pine-l', 170, 36), ('pine-s', 154, 46), ('torii', 104, 39), ('avatar-shadow', 72, 71)]
AVATAR = {'x': 72, 'y': 50}

REMAP = {
    'morning': {},
    'dusk': {'kori-1': 'kori-2', 'yuki-1': 'hada-1', 'yuki-0': 'hada-0', 'yuki-2': 'yoru-0', 'yuki-3': 'yoru-1', 'kori-2': 'yoru-0', 'matsu-0': 'matsu-1', 'matsu-1': 'matsu-2'},
    'night': {'kori-1': 'yoru-2', 'yuki-1': 'yoru-1', 'yuki-0': 'yuki-2', 'yuki-2': 'yoru-0', 'yuki-3': 'yoru-0', 'kori-2': 'yoru-1', 'matsu-0': 'matsu-1', 'matsu-1': 'matsu-2', 'matsu-2': 'yoru-2', 'hada-0': 'hada-0'},
}

def rgb(name): h = PAL[name].lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def tile(im, tx, ty, spec):
    px = im.load()
    for y in range(T):
        for x in range(T):
            n = spec[1] if spec[0] == 'solid' or (x + y) % 2 == 0 else spec[2]
            px[tx * T + x, ty * T + y] = n

def ridge(g, peaks, body, shade, cap, capshade, depth):
    """Fill from each peak down at a 2:1 slope. Left face lit, right face shaded, snow cap follows the peak."""
    for x in range(W):
        best = None
        for (px_, py) in peaks:
            dx = x - px_
            top = py + abs(dx) // 2
            if best is None or top < best[0]: best = (top, dx, py)
        top, dx, py = best
        for y in range(top, 48):
            snow = (y - top) < depth - abs(dx) // 6 and capshade is not None
            lit = dx <= 0
            g[y][x] = (cap if lit else capshade) if snow else (body if lit else shade)

def build():
    g = [['yuki-0'] * W for _ in range(H)]
    im = [[None] * W for _ in range(H)]
    # draw into a name grid via a tiny PIL proxy
    class P:  # name grid proxy with pixel access like PIL
        def __getitem__(s, k): return g[k[1]][k[0]]
        def __setitem__(s, k, v): g[k[1]][k[0]] = v
    proxy = P()
    class Im:
        def load(self): return proxy
    for ty, row in enumerate(MAP[:3]):
        for tx, ch in enumerate(row): tile(Im(), tx, ty, TILES[ch])
    ridge(g, FAR, 'yuki-2', 'yuki-3', 'yuki-0', 'yuki-1', 7)
    ridge(g, NEAR, 'matsu-0', 'matsu-1', 'yuki-0', 'yuki-1', 3)
    for ty, row in enumerate(MAP[3:], start=3):
        for tx, ch in enumerate(row): tile(Im(), tx, ty, TILES[ch])
    props = {}
    for f in sorted((ROOT / 'art/props').glob('*.sprite.txt')):
        imgs, w, h, _ = sb.parse(f, {'yuki16': PAL})
        props[f.name.replace('.sprite.txt', '')] = imgs[0]
    for name, ox, oy in PROPS:
        sp = props[name]; p = sp.load()
        for y in range(sp.height):
            for x in range(sp.width):
                r, gg, b, a = p[x, y]
                if a:
                    col = next(k for k, v in PAL.items() if rgb(k) == (r, gg, b))
                    if 0 <= oy + y < H and 0 <= ox + x < W: g[oy + y][ox + x] = col
    # reflections of the torii and house roof in the water: 1px streaks, checker-broken
    for (x0, y0, n) in [(106, 60, 6), (111, 62, 4), (118, 60, 6), (112, 59, 3)]:
        for i in range(n):
            if g[y0][x0 + i] in ('kori-1', 'kori-2'): g[y0][x0 + i] = 'yuki-1'
    return g

def main():
    out = ROOT / 'public/pixel'; out.mkdir(parents=True, exist_ok=True)
    g = build()
    for name, remap in REMAP.items():
        im = Image.new('RGBA', (W, H))
        px = im.load()
        for y in range(H):
            for x in range(W):
                n = g[y][x]; px[x, y] = rgb(remap.get(n, n)) + (255,)
        im.save(out / f'scene-{name}.png')
    (out / 'scene.json').write_text(json.dumps({'width': W, 'height': H, 'avatar': AVATAR, 'variants': list(REMAP)}))
    print('built scene x3', W, H)

if __name__ == '__main__':
    main()
