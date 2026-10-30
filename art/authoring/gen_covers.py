#!/usr/bin/env python3
"""Matrix card covers: one 48x16 repeat-x tile per quadrant, yuki16 only.
0 Do First: torii row. 1 Schedule: peaks. 2 Fit it in: pines. 3 Later: night drifts."""
import math, pathlib
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
C = dict(y0='#F4F7F6', y1='#DDE6EA', y2='#B4C5D1', y3='#8394AE', o0='#5A6283', o1='#3B4262', o2='#252A40', k1='#8DBCCB', k2='#5A8AA3',
         m0='#7E9C8F', m1='#4F6E68', m2='#31474A', b='#B4534A', h1='#D49E95', ku='#8C6A5C')
W, H = 48, 16

def tile(bg):
    im = Image.new('RGB', (W, H), C[bg])
    def put(x, y, c):
        if 0 <= y < H: im.putpixel((x % W, y), tuple(int(C[c][i:i + 2], 16) for i in (1, 3, 5)))
    return im, put

def save(im, n): im.save(ROOT / f'public/pixel/cover-q{n}.png')

# 0 torii: every 24px a gate, snow on the ground
im, put = tile('y1')
for gx in (6, 30):
    for y in range(4, 13):
        for x in (gx + 2, gx + 3, gx + 10, gx + 11): put(x, y, 'b')
    for x in range(gx, gx + 14): put(x, 3, 'b'); put(x, 4, 'b')
    for x in range(gx - 1, gx + 15): put(x, 2, 'ku' if x in (gx - 1, gx + 14) else 'b')
    for x in range(gx + 4, gx + 10): put(x, 6, 'b'); put(x, 7, 'b')
    for x in range(gx, gx + 14): put(x, 1, 'y0') if gx < x < gx + 13 else None
for x in range(W):
    for y in (13, 14, 15): put(x, y, 'y0')
    put(x, 12, 'y0') if x % 5 else None
save(im, 0)

# 1 peaks: stepped mountains, snow caps
im, put = tile('k1')
for cx, hgt, c in ((6, 9, 'y3'), (20, 12, 'y2'), (34, 8, 'y3'), (44, 6, 'y2')):
    for d in range(hgt):
        for x in range(cx - d, cx + d + 1): put(x, H - hgt + d, c)
    for d in range(min(4, hgt // 2 + 1)):
        for x in range(cx - d, cx + d + 1): put(x, H - hgt + d, 'y0')
for x in range(W): put(x, 15, 'y0'); put(x, 14, 'y1') if x % 2 else None
save(im, 1)

# 2 pines: alternating heights, snow on boughs
im, put = tile('y1')
for cx, hgt in ((5, 12), (16, 9), (27, 12), (38, 9)):
    for tier in range(hgt // 3):
        top = H - 3 - hgt + tier * 3
        for d in range(4):
            for x in range(cx - 1 - tier - d // 2, cx + 2 + tier + d // 2): put(x, top + d, 'm1' if d else 'y0')
        for x in range(cx - 1 - tier, cx + 2 + tier): put(x, top + 3, 'm2')
    put(cx, H - 3, 'ku'); put(cx, H - 2, 'ku')
for x in range(W): put(x, 14, 'y0'); put(x, 15, 'y0')
save(im, 2)

# 3 night drifts: stars over rolling snow
im, put = tile('o1')
for x, y in ((3, 2), (11, 5), (19, 1), (27, 4), (35, 2), (43, 6), (15, 8), (39, 9)): put(x, y, 'y0')
for x in (7, 31): put(x, 3, 'y3')
for x in range(W):
    top = 11 + round(1.5 * math.sin(x * 2 * math.pi / 48)) + round(math.sin(x * 2 * math.pi * 2 / 48 + 1))
    for y in range(top, H): put(x, y, 'y1' if y > top else 'y0')
save(im, 3)
