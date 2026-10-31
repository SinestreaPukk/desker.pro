#!/usr/bin/env python3
"""Quantise the traced kodama cells to a small palette and cut the four poses out of the sheet. Imported by gen_kodama.py.
POSES: jump (happy), wave (lucky), log, leaf (default). Each is a list of strings, '.' = transparent."""
import pathlib
import numpy as np
from scipy.cluster.vq import kmeans2
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
cells = np.load(ROOT / 'art/authoring/kodama_cells.npy').astype(float)
bg = np.abs(cells - 240).max(2) < 14
K = 13
cent, _ = kmeans2(cells[~bg], K, minit='++', seed=2)

def role(rgb, i):
    r, g, b = rgb; lum = (r + g + b) / 3
    if lum < 70: return 'line'
    if r > 200 and g < 150: return 'blush'
    if r > 235 and g > 235: return 'eye'
    if b > 70 and r < 90: return 'leg' if lum > 100 else 'leg-lo'
    if r > g and r > 100 and g < 120: return 'bark-lo' if lum < 85 else 'bark'
    if r > g and g > 130: return 'bark-hi'
    if g > r and r < 125 and b < 80: return 'moss'
    return 'lime'
names = [role(c, i) for i, c in enumerate(cent)]
# lime has several clusters: name them by lightness
limes = sorted([i for i, n in enumerate(names) if n == 'lime'], key=lambda i: cent[i].mean())
for rank, i in enumerate(limes): names[i] = ('lime-lo', 'lime', 'lime-hi')[min(rank, 2)]
for n in set(names):
    idx = [i for i, x in enumerate(names) if x == n]
    if len(idx) > 1:                                                     # merge duplicate roles to their mean colour
        m = cent[idx].mean(0)
        for i in idx: cent[i] = m
PAL = {}
for n, c in zip(names, cent): PAL.setdefault(n, tuple(int(v) for v in c))
LETTER = {'line': 'K', 'lime': 'G', 'lime-hi': 'H', 'lime-lo': 'g', 'leg': 'L', 'leg-lo': 'l', 'blush': 'P', 'eye': 'W', 'bark': 'B', 'bark-lo': 'b', 'bark-hi': 'h', 'moss': 'M'}
def cell_letter(rgb):
    if np.abs(rgb - 240).max() < 14: return '.'
    d = {n: np.abs(np.array(c) - rgb).sum() for n, c in PAL.items()}
    return LETTER[min(d, key=d.get)]
BOX = {'jump': (71, 112, 6, 44), 'wave': (20, 56, 11, 45), 'log': (17, 59, 54, 87), 'leaf': (76, 111, 54, 88)}
POSES = {k: [''.join(cell_letter(cells[y, x]) for x in range(x0, x1 + 1)) for y in range(y0, y1 + 1)] for k, (x0, x1, y0, y1) in BOX.items()}
if __name__ == '__main__':
    print({n: '#%02X%02X%02X' % c for n, c in PAL.items()})
    print('\n'.join(POSES['leaf']))
