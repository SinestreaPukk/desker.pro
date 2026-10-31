#!/usr/bin/env python3
"""Trace the reference kodama (front pose) down to a 32x32 grid of palette letters. One-off: prints the grid and a preview.
The result is then edited by hand into art/sprites/kodama.sprite.txt; this script only keeps the shape faithful to the art."""
import sys, collections
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src = Image.open(sys.argv[1]).convert('RGB').crop((70, 430, 400, 790))
a = np.array(src).astype(int); H0, W0 = a.shape[:2]
lum = a.mean(2)
bgish = (lum > 205) & (abs(a[..., 0] - a[..., 1]) < 30) & (a[..., 2] > 195)
lab, n = ndi.label(bgish); border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1]); border.discard(0)
bg = np.isin(lab, list(border))
obj = ~bg
dark = obj & (lum < 95)
blush = obj & (a[..., 0] > 190) & (a[..., 1] < 150) & (a[..., 2] < 120)
legs = obj & (a[..., 2] > 75) & (a[..., 0] < 130) & (a[..., 1] > 150)
white = obj & (lum > 215) & ~blush
lime = obj & ~dark & ~blush & ~legs & ~white
N = 32; SC = 31 / H0; GW, GH = round(W0 * SC), 31; OX, OY = (N - GW) // 2, 1
grid = [['.'] * N for _ in range(N)]
bx, by = W0 / GW, H0 / GH
M = np.zeros((N, N), bool); cls = {}
for gy in range(GH):
    for gx in range(GW):
        ys, xs = slice(int(gy * by), int((gy + 1) * by)), slice(int(gx * bx), int((gx + 1) * bx))
        o = obj[ys, xs].mean()
        if o < .5: continue
        M[gy + OY, gx + OX] = True
        f = {k: m[ys, xs].mean() for k, m in (('K', dark), ('P', blush), ('L', legs), ('W', white), ('G', lime))}
        cls[(gx + OX, gy + OY)] = max(f, key=f.get) if f['K'] < .38 else 'K'
for (x, y), c in cls.items(): grid[y][x] = c
for y in range(N):
    for x in range(N):
        if M[y, x] and any(not (0 <= x + dx < N and 0 <= y + dy < N and M[y + dy, x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): grid[y][x] = 'K'
print('\n'.join(''.join(r) for r in grid))
