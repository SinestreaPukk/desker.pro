#!/usr/bin/env python3
"""Draws art/props/house.sprite.txt (48x30): snow roof, wooden wall, one lit window."""
import pathlib
W, H = 48, 30
g = [['.'] * W for _ in range(H)]
# roof: 2:1 slope, 2 px wider per row each side, snow cap with a shaded right edge and an eave line
for i, y in enumerate(range(0, 13)):
    x0, x1 = 22 - 2 * i - (0), 25 + 2 * i
    x0, x1 = max(x0, 0), min(x1, W - 1)
    for x in range(x0, x1 + 1):
        g[y][x] = 'W' if x < x1 - 2 else 'w'
for x in range(1, 47): g[13][x] = 'w'
for x in range(2, 46): g[14][x] = 's'
# wall
for y in range(15, 28):
    for x in range(3, 45): g[y][x] = 'k' if x < 41 else 'd'
for x in range(3, 45): g[28][x] = 'd'
def window(x0, y0, lit=True):
    for y in range(y0, y0 + 5):
        for x in range(x0, x0 + 6):
            edge = y in (y0, y0 + 4) or x in (x0, x0 + 5)
            g[y][x] = 'K' if edge else 'h'
window(8, 17); window(33, 17)
for y in range(22, 28):
    for x in range(20, 26): g[y][x] = 'K' if (x in (20, 25) or y == 22) else 'd'
legend = ['W yuki-0', 'w yuki-1', 's yuki-2', 'K yoru-2', 'k kuri', 'd yoru-1', 'h hada-0']
txt = ['# Lakeside house, snow roof. The lit windows are warm (hada-0): the only light besides the torii.', f'size {W} {H}', 'palette yuki16', '. transparent'] + legend + ['frame rest'] + [''.join(r) for r in g]
(pathlib.Path(__file__).resolve().parent.parent / 'props' / 'house.sprite.txt').write_text('\n'.join(txt) + '\n')
