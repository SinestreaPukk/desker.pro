#!/usr/bin/env python3
"""Kodama sprite sheet, 44x44, six frames, taken pixel for pixel from the user's own picture (art/authoring/kodama-reference.jpg).
The picture is a clean 44x44 pixel image drawn at 45 px a cell, so each cell is read at its centre: nothing is redrawn or restyled.
idle-a / idle-b   the picture as it is, then a blink (the eyes shut)
happy-a / happy-b the same, then a 2px hop
lucky-a / lucky-b the same with sparkles that swap places
Palette: art/palette/kodama.json, the picture's own colours."""
import json, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
N = 44; BOTTOM = 43
# the picture's colours, by role: [name, letter, rgb]
COLORS = [('line', 'K', '#412B1D'), ('lime', 'G', '#B7D34B'), ('lime-hi', 'H', '#CDDF7B'), ('lime-lo', 'L', '#9CBC3D'),
          ('leg', 'T', '#418D5F'), ('blush', 'B', '#DE7C4A'), ('eye', 'E', '#F2EEC8')]
RGB = {l: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)]) for _, l, h in COLORS }

im = np.array(Image.open(ROOT / 'art/authoring/kodama-reference.jpg').convert('RGB')).astype(int)
C = im.shape[0] / 43
g = np.zeros((N, N, 3), int)
for j in range(N):
    for i in range(N):
        cx, cy = int(min(im.shape[1] - 1, i * C)), int(min(im.shape[0] - 1, j * C))
        g[j, i] = np.median(im[max(0, cy - 7):cy + 8, max(0, cx - 7):cx + 8].reshape(-1, 3), axis=0)
outside = ndimage.label(np.abs(g - g[0, 0]).sum(2) < 30)[0]; outside = outside == outside[0, 0]
ink = ~outside
rows = [[(min(RGB, key=lambda l: ((RGB[l] - g[y, x]) ** 2).sum()) if ink[y, x] else '.') for x in range(N)] for y in range(N)]
ys = [y for y in range(N) if any(c != '.' for c in rows[y])]
dy = BOTTOM - max(ys)                                                       # stand on the baseline
base = [['.'] * N for _ in range(N)]
for y in range(N):
    for x in range(N):
        if rows[y][x] != '.' and 0 <= y + dy < N: base[y + dy][x] = rows[y][x]
# the picture has one white notch inside the left foot: that is background, so it stays clear
def copy(c): return [r[:] for r in c]

def eyes(c):
    """Each eye is a connected blob of eye-white and line colour that holds eye-white and is not the body outline."""
    m = np.array([[v in 'KE' for v in r] for r in c]); lab, n = ndimage.label(m)
    out = []
    for k in range(1, n + 1):
        ys_, xs_ = np.where(lab == k)
        if any(c[y][x] == 'E' for y, x in zip(ys_, xs_)) and len(ys_) < 90 and ys_.max() - ys_.min() < 12 and ys_.max() < 30: out.append((ys_.min(), ys_.max(), xs_.min(), xs_.max()))
    return sorted(out, key=lambda b: b[2])[:2]

def blink():
    c = copy(base)
    for y0, y1, x0, x1 in eyes(base):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): c[y][x] = 'G'
        ly = y0 + (y1 - y0) * 2 // 3
        for x in range(x0, x1 + 1): c[ly][x] = 'K'
        c[ly - 1][x0] = 'K'; c[ly - 1][x1] = 'K'
    return c
def hop(dy_):
    c = [['.'] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            if base[y][x] != '.' and 0 <= y + dy_ < N: c[y + dy_][x] = base[y][x]
    return c
def sparkle(k):
    c = copy(base); plus, dot = ((3, 6), (41, 14)) if k == 0 else ((40, 4), (2, 12))
    for ddx, ddy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): c[plus[1] + ddy][plus[0] + ddx] = 'B'
    c[dot[1]][dot[0]] = 'B'
    return c

FRAMES = [('idle-a', base), ('idle-b', blink()), ('happy-a', hop(0)), ('happy-b', hop(-2)), ('lucky-a', sparkle(0)), ('lucky-b', sparkle(1))]
(ROOT / 'art/palette/kodama.json').write_text(json.dumps({'name': 'kodama', 'note': "The one exception to yuki16: the colours of the user's kodama picture (kodama-reference.jpg). Used only by the kodama sprite.",
    'colors': {n: h for n, _, h in COLORS}}, indent=2) + '\n')
out = ['# kodama: the user\'s own picture, pixel for pixel (art/authoring/gen_kodama.py reads art/authoring/kodama-reference.jpg).', f'size {N} {N}', 'palette kodama', '. transparent'] + [f'{l} {n}' for n, l, _ in COLORS]
for name, c in FRAMES: out += [f'frame {name}'] + [''.join(r) for r in c]
(ROOT / 'art/sprites/kodama.sprite.txt').write_text('\n'.join(out) + '\n')
print('wrote kodama; eyes', eyes(base))
