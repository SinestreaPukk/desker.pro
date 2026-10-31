#!/usr/bin/env python3
"""Page stripes (192x24), one per tab, each a tiny scene with Deskie in it. Same palette as the lake scene (art/palette/scene.json).
Goals = climbing a mountain to a flag, Projects = a little building site, Calendar = a week of paper lanterns, today's lit.
Output: public/pixel/strip-{goals,projects,calendar}.png. Run: python3 art/authoring/gen_stripes.py"""
import json, pathlib, re
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
PAL = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in json.loads((ROOT / 'art/palette/scene.json').read_text())['colors'].items()}
W, H = 192, 24

class Cv:
    def __init__(s): s.p = [[None] * W for _ in range(H)]
    def px(s, x, y, c):
        if 0 <= x < W and 0 <= y < H and c: s.p[y][x] = c
    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.px(x + i, y + j, c)
    def dither(s, x, y, w, h, a, b):  # checkerboard of a and b
        for j in range(h):
            for i in range(w): s.px(x + i, y + j, a if (i + j) % 2 == 0 else b)
    def sprite(s, rows, key, x, y):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch in key: s.px(x + i, y + j, key[ch])
    def save(s, name):
        im = Image.new('RGBA', (W, H))
        for y in range(H):
            for x in range(W):
                c = s.p[y][x]
                im.putpixel((x, y), (*PAL[c], 255) if c else (0, 0, 0, 0))
        im.save(ROOT / f'public/pixel/{name}.png'); print('wrote', name)

def deskie():
    t = (ROOT / 'art/sprites/av-main.sprite.txt').read_text().split('frame idle-0\n')[1].split('frame blink')[0].split('\n')[:24]
    return t, {'K': 'yoru-2', 'D': 'yoru-1', 'S': 'yuki-3', 's': 'yuki-2', 'w': 'yuki-1', 'W': 'yuki-0', 'P': 'hada-1'}
DS, DK = deskie()
def put_deskie(c, x, feet, hat=False):
    c.sprite(DS, DK, x, feet - 19)
    if hat:  # little hard hat on the round head (head top is row 5, x 8..13)
        top = feet - 19 + 5
        c.rect(x + 8, top - 1, 6, 1, 'daidai-0'); c.rect(x + 7, top, 8, 2, 'daidai-0'); c.rect(x + 8, top, 2, 1, 'hada-0'); c.px(x + 7, top + 1, 'daidai-2'); c.px(x + 14, top + 1, 'daidai-2')

def sky(c, top, mid, bot, y1=8, y2=15):
    c.rect(0, 0, W, H, top); c.dither(0, y1 - 1, W, 2, top, mid); c.rect(0, y1 + 1, W, y2 - y1 - 1, mid); c.dither(0, y2 - 1, W, 2, mid, bot); c.rect(0, y2 + 1, W, H - y2, bot)

def cloud(c, x, y, big=1):
    c.rect(x + 1, y, 4 + big * 2, 1, 'yuki-0'); c.rect(x, y + 1, 6 + big * 2, 1, 'yuki-0'); c.rect(x + 2, y - 1, 3, 1, 'yuki-0'); c.rect(x + 1, y + 2, 5 + big * 2, 1, 'yuki-1')

def sparkle(c, x, y, col='yuki-0'):
    for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)): c.px(x + dx, y + dy, col)

def goals():
    c = Cv(); sky(c, 'kori-1', 'yuki-1', 'yuki-0', 8, 14)
    for x, y, b in ((10, 4, 1), (58, 7, 0), (128, 3, 0), (172, 8, 1)): cloud(c, x, y, b)
    # a far, lower ridge and the big mountain with a snowy cap
    for x in range(W):
        h = 5 + int(2.5 * ((x // 9) % 3 == 1)) + (x // 24) % 2
        c.rect(x, 22 - h, 1, h, 'yuki-2')
    peak, base = (140, 1), 22
    for y in range(peak[1], base + 1):
        half = (y - peak[1]) * 1.3 + 1
        for x in range(int(peak[0] - half), int(peak[0] + half) + 1):
            c.px(x, y, 'yoru-0' if x > peak[0] + (y - peak[1]) * 0.2 else 'yuki-3')
    for y in range(1, 9):  # snow cap with a zig-zag edge
        half = (y - 1) * 1.3 + 1
        for x in range(int(peak[0] - half), int(peak[0] + half) + 1):
            if y == 8 and x % 3 == 0: continue
            if y == 7 and x % 5 == 0: continue
            c.px(x, y, 'yuki-0' if x <= peak[0] + (y - 1) * 0.2 else 'yuki-2')
    # ground: grass at the foot, a path of stepping stones zig-zagging to the flag
    c.rect(0, 20, W, 4, 'matsu-0'); c.dither(0, 20, W, 1, 'matsu-0', 'matsu-1'); c.rect(0, 22, W, 2, 'matsu-1')
    import math
    pts = [(34 + i * 6, 21 + (i % 2)) for i in range(10)]  # along the grass...
    edge = lambda y: 140 - (y - 1) * 1.3
    pts += [(round(edge(y)) + 4 + (y % 4 == 1) * 2, y) for y in range(19, 5, -2)]  # ...then up the lit face to the flag
    for x, y in pts:
        c.rect(x, y, 2, 1, 'yuki-0'); c.px(x, y + 1, 'hada-1'); c.px(x + 1, y + 1, 'hada-1')
    for y in range(-1, 4): c.px(140, y, 'kuri')  # the flag on the summit
    c.rect(141, 0, 4, 1, 'beni'); c.rect(141, 1, 3, 1, 'beni'); c.rect(141, 2, 2, 1, 'beni'); c.px(141, 0, 'hada-1')
    sparkle(c, 152, 5, 'yuki-0'); sparkle(c, 126, 3, 'daidai-0')
    # trees and flowers around Deskie
    for x in (6, 24, 178, 186):
        c.rect(x, 15, 3, 2, 'matsu-1'); c.rect(x - 1, 17, 5, 2, 'matsu-1'); c.rect(x - 2, 19, 7, 3, 'matsu-2'); c.px(x + 1, 15, 'matsu-0'); c.rect(x + 1, 22, 1, 2, 'kuri')
    for x, col in ((30, 'hada-0'), (66, 'daidai-0'), (84, 'hada-0'), (108, 'daidai-0'), (160, 'hada-0')):
        c.px(x, 21, col); c.px(x, 22, 'matsu-2')
    sparkle(c, 18, 4, 'daidai-0')
    c.save('strip-goals')

def projects():
    c = Cv(); sky(c, 'kori-1', 'yuki-1', 'yuki-0', 7, 13)
    for x, y, b in ((6, 3, 0), (96, 5, 1), (180, 4, 0)): cloud(c, x, y, b)
    c.rect(0, 20, W, 4, 'matsu-0'); c.dither(0, 20, W, 1, 'matsu-0', 'matsu-1'); c.rect(0, 22, W, 2, 'matsu-1')
    def house(x, wd, hgt, roof, lit=True):
        top = 20 - hgt
        c.rect(x, top, wd, hgt, 'hada-0'); c.rect(x + wd - 2, top, 2, hgt, 'hada-1')
        for i in range(wd // 2 + 2):  # roof with a hint of overhang
            c.rect(x - 1 + i, top - 1 - i // 1 if False else top - 1 - min(i, wd - i + 1) // 1, 1, 1, roof) if False else None
        mid = x + wd // 2
        for r in range(wd // 2 + 2):
            c.rect(x - 1 + r, top - 1 - r + (0 if r < 99 else 0), wd + 2 - 2 * r, 1, roof) if wd + 2 - 2 * r > 0 else None
        c.rect(x + 2, top + 3, 2, 2, 'daidai-0' if lit else 'kori-1'); c.rect(x + wd - 5, top + 3, 2, 2, 'daidai-0' if lit else 'kori-1')
        c.rect(mid - 1, 20 - 4, 2, 4, 'kuri')
    house(52, 12, 9, 'beni'); house(70, 10, 8, 'daidai-2')
    # a house still going up: frame, scaffold, half roof
    c.rect(92, 12, 2, 8, 'kuri'); c.rect(104, 12, 2, 8, 'kuri'); c.rect(92, 12, 14, 1, 'kuri'); c.rect(92, 16, 14, 1, 'kuri')
    c.rect(94, 17, 10, 3, 'hada-0'); c.rect(94, 19, 10, 1, 'hada-1')
    for i in range(4): c.px(94 + i, 11 - i // 1 if False else 11 - i, 'daidai-2'); c.px(105 - i, 11 - i, 'daidai-2')
    c.rect(96, 8, 6, 1, 'daidai-2')
    c.rect(89, 8, 1, 12, 'kuri'); c.rect(108, 8, 1, 12, 'kuri'); c.rect(89, 8, 5, 1, 'kuri'); c.rect(104, 8, 5, 1, 'kuri'); c.rect(89, 14, 4, 1, 'kuri'); c.rect(105, 14, 4, 1, 'kuri')
    # crane
    c.rect(124, 3, 2, 17, 'yoru-0'); c.rect(124, 3, 12, 1, 'yoru-0'); c.rect(118, 3, 6, 1, 'yoru-0'); c.rect(116, 2, 3, 3, 'yoru-1'); c.rect(122, 1, 4, 2, 'yoru-0')
    for y in range(4, 13): c.px(134, y, 'yoru-1')
    c.rect(132, 13, 5, 3, 'daidai-0'); c.rect(132, 13, 5, 1, 'daidai-0'); c.rect(132, 15, 5, 1, 'daidai-2')
    for y in range(5, 19, 2): c.px(125 + (y % 4 == 1), y, 'yoru-1')
    # foundation, a stack of blocks and a plank, then a finished little house at the end
    c.rect(145, 17, 14, 3, 'yuki-2'); c.rect(145, 17, 14, 1, 'yuki-1'); c.rect(145, 19, 14, 1, 'yuki-3')
    house(166, 12, 9, 'matsu-1', lit=False); c.rect(166, 10, 13, 1, 'matsu-1')
    # flower pots + signpost
    for x in (84, 112, 162): c.px(x, 19, 'beni'); c.px(x, 20, 'matsu-1')
    for x, y, col in ((30, 17, 'daidai-0'), (30, 18, 'daidai-0'), (33, 18, 'daidai-0'), (33, 19, 'daidai-0'), (30, 19, 'daidai-2')): c.rect(x, y, 3, 1, col)
    c.rect(36, 19, 3, 1, 'kuri'); c.rect(4, 16, 1, 5, 'kuri'); c.rect(1, 14, 7, 4, 'hada-0'); c.rect(1, 17, 7, 1, 'hada-1'); c.rect(2, 15, 5, 1, 'daidai-2')
    c.save('strip-projects')

def calendar():
    c = Cv(); sky(c, 'yoru-1', 'yoru-0', 'hada-1', 8, 16)
    c.rect(0, 17, W, 7, 'yoru-0'); c.dither(0, 17, W, 1, 'hada-1', 'yoru-0')  # water
    for x, y in ((22, 3), (50, 9), (88, 2), (120, 6), (150, 2), (176, 7), (66, 5), (184, 3)): c.px(x, y, 'yuki-1' if (x // 2) % 2 else 'yuki-2')
    # crescent moon
    for dx, dy in ((0, 0), (1, 0), (2, 0), (-1, 1), (0, 1), (-2, 2), (-2, 3), (-2, 4), (-1, 5), (0, 6), (1, 6), (2, 6)): c.px(182 + dx, 3 + dy, 'hada-0')
    for dx, dy in ((0, 1), (1, 1), (0, 2), (0, 3), (0, 4), (1, 5)): c.px(10 + dx + 2, 2 + dy, 'hada-0') if False else None
    # garland: a sagging string across the top, seven lanterns, one for each day
    xs = [44 + i * 21 for i in range(7)]
    def sag(x): return 2 + int(5 * (1 - ((x - 110) / 80) ** 2))
    for x in range(34, 180): c.px(x, sag(x) - 1 + 0, 'kuri') if False else c.px(x, sag(x), 'kuri')
    today = 3
    for i, x in enumerate(xs):
        y = sag(x) + 1
        body = 'daidai-0' if i == today else ('hada-1' if i < today else 'yuki-2')
        shade = 'daidai-1' if i == today else ('kuri' if i < today else 'yuki-3')
        if i == today:  # the glow
            for gx in range(-6, 7):
                for gy in range(-2, 11):
                    if (gx * gx) / 36 + ((gy - 4) ** 2) / 36 < 1 and (gx + gy) % 2 == 0: c.px(x + 2 + gx, y + gy, 'hada-1')
        c.rect(x + 1, y, 3, 1, 'yoru-2'); c.rect(x, y + 1, 5, 5, body); c.rect(x + 3, y + 1, 2, 5, shade); c.rect(x + 1, y + 6, 3, 1, 'yoru-2')
        c.px(x + 2, y + 7, 'kuri'); c.px(x + 2, y + 8, body)
        if i == today: c.rect(x + 1, y + 2, 2, 3, 'yuki-0')
        c.px(x + 2, y - 1, 'kuri')
    # reflections on the water, the bank and Deskie watching
    for i, x in enumerate(xs):
        col = 'hada-0' if i == today else 'yoru-1'
        c.rect(x + 1, 19 + (i % 2), 3, 1, col); c.rect(x + 2, 21 + (i % 2), 1, 1, col)
    c.save('strip-calendar')

goals(); projects(); calendar()
