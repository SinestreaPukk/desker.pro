#!/usr/bin/env python3
"""Kodama sprite sheet, 44x44, six frames, from the pose sheet (traced by kodama_read.py, cut and quantised by kodama_poses.py).
idle-a / idle-b  the leaf-play pose (the default) and a blink
happy-a / happy-b  the jump pose, then a 2px hop
lucky-a / lucky-b  the waving pose with sparkles that swap places
Palette: art/palette/kodama.json, written here from the colours found on the sheet."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kodama_poses as kp
ROOT = kp.ROOT
POSES = {k: [r.translate(str.maketrans('Bbh', 'KKK')) for r in v] for k, v in kp.POSES.items()}   # the sheet's log colours only leak in as stray cells
inv = {v: k for k, v in kp.LETTER.items()}
N = 44; BOTTOM = 43; M = 26   # all poses stand on the same baseline

def canvas(): return [['.'] * N for _ in range(N)]
def place(c, rows, dy=0):
    h, w = len(rows), len(rows[0]); x0, y0 = (N - w) // 2, BOTTOM - h + dy
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and 0 <= y0 + y < N: c[y0 + y][x0 + x] = ch
    return x0, y0

def idle(blink):
    c = canvas(); x0, y0 = place(c, POSES['leaf'])
    if blink:                                                                        # eyes shut: lid lines where the eyes were
        for ex in (8, 19):
            for y in range(11, 19):
                for x in range(ex, ex + 7): c[y0 + y][x0 + x] = 'G'
            for x in range(ex, ex + 7): c[y0 + 15][x0 + x] = 'K'
            c[y0 + 14][x0 + ex] = 'K'; c[y0 + 14][x0 + ex + 6] = 'K'
    return c
def happy(dy):
    c = canvas(); place(c, POSES['jump'], dy); return c
def lucky(spark):
    c = canvas(); place(c, POSES['wave'])
    plus, dot = ((4, 9), (41, 20)) if spark == 0 else ((40, 5), (2, 18))
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): c[plus[1] + dy][plus[0] + dx] = 'P'
    c[dot[1]][dot[0]] = 'P'
    return c

def coarse(c):
    """Resample N -> M like the avatar: silhouette first, then a clean 1-cell outline on its edge, flat fills; faces are redrawn by hand afterwards (FACES)."""
    boxes = {}
    for y in range(M):
        for x in range(M):
            cells = [c[j][i] for j in range(y * N // M, -(-(y + 1) * N // M)) for i in range(x * N // M, -(-(x + 1) * N // M)) if j < N and i < N]
            boxes[y, x] = (len(cells), {k: cells.count(k) for k in set(cells)})
    solid = lambda y, x: 0 <= y < M and 0 <= x < M and sum(v for k, v in boxes[y, x][1].items() if k != '.') * 2 >= boxes[y, x][0]
    out = [['.'] * M for _ in range(M)]
    for y in range(M):
        for x in range(M):
            if not solid(y, x): continue
            n, cnt = boxes[y, x]
            edge = not all(solid(y + dy, x + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge and cnt.get('K', 0) * 10 >= n * 2: out[y][x] = 'K'
            elif cnt.get('P', 0) * 10 >= n * 3: out[y][x] = 'P'
            else: out[y][x] = max((k for k in cnt if k not in '.K'), key=cnt.get, default='K')
    return out
def face(f, box, pts):
    """Redraw a face by hand on the coarse grid: clear stray eye/outline cells inside box, then set pts (y, x, colour)."""
    y0, y1, x0, x1 = box
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if f[y][x] in 'WKH': f[y][x] = 'G'
    for y, x, ch in pts: f[y][x] = ch
    return f
def eye(y, x): return [(y, x, 'W'), (y, x + 1, 'K'), (y + 1, x, 'K'), (y + 1, x + 1, 'K'), (y + 2, x, 'K'), (y + 2, x + 1, 'K')]
def arc(y, x): return [(y, x + 1, 'K'), (y + 1, x, 'K'), (y + 1, x + 2, 'K')]
def shift_up(f): return f[1:] + [['.'] * M]
def done(c, box, pts): return face(coarse(c), box, pts)
def blush(f, y, xs):
    for r in f:
        for x in range(M):
            if r[x] == 'P' and f.index(r) in (y - 1, y, y + 1) and x < 22: r[x] = 'G'
    for x in xs: f[y][x] = 'P'
    return f
IDLE = (9, 15, 6, 19)
ia = blush(done(idle(False), IDLE, eye(11, 8) + eye(11, 15) + [(15, 11, 'K'), (16, 12, 'K'), (15, 13, 'K')]), 16, (5, 6, 18, 19))
ib = blush(done(idle(True), IDLE, [(12, 8, 'K'), (12, 9, 'K'), (12, 15, 'K'), (12, 16, 'K'), (15, 11, 'K'), (16, 12, 'K'), (15, 13, 'K')]), 16, (5, 6, 18, 19))
ha = done(happy(0), (9, 13, 6, 19), arc(11, 8) + arc(11, 14) + [(14, 12, 'K'), (14, 13, 'K')])
la = done(lucky(0), (9, 14, 5, 17), eye(11, 7) + eye(11, 13) + [(14, 10, 'K'), (14, 11, 'K')])
lb = done(lucky(1), (9, 14, 5, 17), eye(11, 7) + eye(11, 13) + [(14, 10, 'K'), (14, 11, 'K')])
FRAMES = [('idle-a', ia), ('idle-b', ib), ('happy-a', ha), ('happy-b', shift_up(ha)), ('lucky-a', la), ('lucky-b', lb)]

used = sorted({ch for _, c in FRAMES for row in c for ch in row if ch != '.'})
(ROOT / 'art/palette/kodama.json').write_text(json.dumps({'name': 'kodama', 'note': 'The one exception to yuki16: colours read off the kodama pose sheet. Used only by the kodama sprite.',
    'colors': {inv[ch]: '#%02X%02X%02X' % kp.PAL[inv[ch]] for ch in used}}, indent=2) + '\n')
head = ['# kodama: tree spirit mascot from the pose sheet. Generated by art/authoring/gen_kodama.py.', f'size {M} {M}', 'palette kodama', '. transparent'] + [f'{ch} {inv[ch]}' for ch in used]
body = []
for name, c in FRAMES: body += [f'frame {name}'] + [''.join(r) for r in c]
(ROOT / 'art/sprites/kodama.sprite.txt').write_text('\n'.join(head + body) + '\n')
print('wrote kodama', used)
