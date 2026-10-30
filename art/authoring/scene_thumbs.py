#!/usr/bin/env python3
"""Three value-only composition thumbnails (96x40, four values) -> design/screens/scene-thumbs.png (shown at 6x)."""
import pathlib
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
V = {'k': (37, 42, 64), 'd': (90, 98, 131), 'm': (131, 148, 174), 'l': (221, 230, 234)}  # yoru-2, yoru-0, yuki-3, yuki-1

def thumb(spec):
    im = Image.new('RGB', (96, 40), V['k']); d = ImageDraw.Draw(im)
    hz = spec['hz']
    d.rectangle([0, hz - 12, 95, hz], fill=V['d'])                       # horizon glow
    for pts in spec['peaks']:
        d.polygon(pts, fill=V['m'])
        ax = pts[1][0]; d.polygon([pts[1], pts[2], (ax, pts[2][1])], fill=V['d'])   # shade side
    d.rectangle([0, hz, 95, 39], fill=V['d'])                           # lake
    d.polygon(spec['bank'], fill=V['l'])                                # near bank
    for x, y, w, h in spec['house']: d.rectangle([x, y, x + w, y + h], fill=V['k']); d.polygon([(x - 1, y), (x + w / 2, y - h), (x + w + 1, y)], fill=V['l'])
    for x, y, h in spec['pines']: d.polygon([(x - h // 4, y), (x, y - h), (x + h // 4, y)], fill=V['k'])
    x, y = spec['torii']; d.rectangle([x, y - 10, x + 1, y], fill=V['k']); d.rectangle([x + 8, y - 10, x + 9, y], fill=V['k']); d.rectangle([x - 1, y - 11, x + 10, y - 10], fill=V['k'])
    ax, ay = spec['av']; d.rectangle([ax, ay, ax + 5, ay + 5], fill=V['l']); d.rectangle([ax + 1, ay + 6, ax + 4, ay + 9], fill=V['k'])
    cx, cy = spec['moon']; d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=V['l'])
    return im

A = dict(hz=24, peaks=[[(30, 24), (52, 7), (74, 24)], [(2, 26), (20, 15), (38, 26)], [(64, 26), (80, 14), (96, 26)]], bank=[(0, 40), (0, 34), (30, 31), (60, 33), (95, 30), (95, 40)],
         house=[(74, 22, 10, 3)], pines=[(88, 28, 14), (93, 26, 18), (12, 27, 9)], torii=(30, 31), av=(63, 24), moon=(14, 9))
B = dict(hz=22, peaks=[[(0, 22), (22, 5), (46, 22)], [(46, 24), (70, 12), (96, 24)]], bank=[(0, 40), (0, 35), (50, 33), (95, 32), (95, 40)],
         house=[(6, 25, 22, 7)], pines=[(40, 27, 12), (46, 26, 9), (86, 28, 10)], torii=(70, 30), av=(26, 25), moon=(84, 8))
C = dict(hz=16, peaks=[[(0, 16), (18, 9), (40, 16)], [(40, 16), (66, 11), (96, 16)]], bank=[(0, 40), (0, 36), (48, 33), (95, 36), (95, 40)],
         house=[(6, 14, 7, 2)], pines=[(82, 20, 9), (90, 20, 11)], torii=(44, 28), av=(44, 27), moon=(76, 5))
sheet = Image.new('RGB', (96 * 3 * 6 + 40, 40 * 6 + 24), (244, 247, 246)); d = ImageDraw.Draw(sheet)
for i, (name, s) in enumerate((('A  peak centre, torii in the lake, avatar right', A), ('B  house large left, avatar left', B), ('C  low horizon, lake-heavy', C))):
    sheet.paste(thumb(s).resize((576, 240), Image.NEAREST), (i * 596, 24)); d.text((i * 596 + 4, 6), name, fill=(37, 42, 64))
(ROOT / 'design/screens/scene-thumbs.png').parent.mkdir(parents=True, exist_ok=True); sheet.save(ROOT / 'design/screens/scene-thumbs.png')
