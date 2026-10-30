#!/usr/bin/env python3
"""Pixel-art linter. Fails (exit 1) on hard rule breaks, prints warnings for review.

  sprite  — checks 1x source PNGs (sprites, tiles, 9-slice frames, scenes)
  render  — checks a screenshot of rendered art: every art-pixel must be a
            uniform SCALE x SCALE block in a palette colour (catches blurry
            scaling, sub-pixel offsets, CSS filters, anti-aliasing leaks)

Hard errors (sprite):
  E1 semi-transparent pixel (alpha not 0 or 255)
  E2 colour not in the palette
  E3 too many colours for the asset class (--max-colors)
  E4 asset was exported upscaled (made of uniform k x k blocks, k>1)
  E5 size not a multiple of --grid
Warnings (sprite) — look at each one; fix or justify:
  W1 orphan pixels (a pixel unlike all 8 neighbours; fine for eye glints only)
  W2 L-shaped doubles in the outline (jaggies)
  W3 outline clumps (2x2 block of outline colour = line thicker than 1px)
  W4 fewer than 3 values used (flat, unreadable) or no colour from a dark ramp end

Usage:
  pixel_lint.py sprite FILES_OR_DIRS --palette yuki16.json [--max-colors 12] [--grid 8]
  pixel_lint.py render SHOT.png --scale 4 --palette yuki16.json [--bg '#F4F7F6']
  pixel_lint.py contact FILES_OR_DIRS --out sheet.png   (1x / 2x / 4x / silhouette review sheet)
"""
import argparse, json, pathlib, sys
from PIL import Image
import numpy as np


def load_palette(path):
    d = json.loads(pathlib.Path(path).read_text())
    cols = {}
    for name, h in d['colors'].items():
        h = h.lstrip('#')
        cols[(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))] = name
    return cols


def luminance(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def upscale_factor(a):
    """Largest k>1 such that the image is made of uniform k x k blocks."""
    h, w = a.shape[:2]
    for k in range(min(h, w) // 2, 1, -1):
        if h % k or w % k:
            continue
        small = a[::k, ::k]
        if np.array_equal(np.repeat(np.repeat(small, k, 0), k, 1), a):
            return k
    return 1


def lint_sprite(path, pal, max_colors, grid):
    errs, warns = [], []
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    h, w = a.shape[:2]
    alpha = a[..., 3]
    semi = np.argwhere((alpha > 0) & (alpha < 255))
    if len(semi):
        y, x = semi[0]
        errs.append(f'E1 {len(semi)} semi-transparent px (first at {x},{y}) — alpha must be 0 or 255')
    opaque = alpha == 255
    colors = {tuple(c) for c in a[opaque][:, :3]}
    bad = [c for c in colors if c not in pal]
    if bad:
        sample = ', '.join('#%02X%02X%02X' % c for c in bad[:5])
        errs.append(f'E2 {len(bad)} off-palette colour(s): {sample}')
    if len(colors) > max_colors:
        errs.append(f'E3 {len(colors)} colours > limit {max_colors}')
    k = upscale_factor(a)
    if k > 1:
        errs.append(f'E4 exported at {k}x — store art at 1x and scale in CSS')
    if grid and (w % grid or h % grid):
        errs.append(f'E5 size {w}x{h} not a multiple of {grid}')

    # identity map of colours for neighbour checks (-1 = transparent)
    ids = np.full((h, w), -1, dtype=np.int32)
    idx = {c: i for i, c in enumerate(sorted(colors))}
    for (y, x) in np.argwhere(opaque):
        ids[y, x] = idx[tuple(a[y, x, :3])]
    pad = np.pad(ids, 1, constant_values=-1)

    # W1 orphans
    orphans = []
    for (y, x) in np.argwhere(opaque):
        c = ids[y, x]
        nb = pad[y:y + 3, x:x + 3].copy()
        nb[1, 1] = -2
        if not (nb == c).any():
            orphans.append((x, y))
    if orphans:
        warns.append(f'W1 {len(orphans)} orphan px {[tuple(map(int,o)) for o in orphans[:6]]} — keep only if intentional (eye glint, star)')

    # outline colour = darkest colour touching transparency
    edge = []
    for (y, x) in np.argwhere(opaque):
        if (pad[y:y + 3, x:x + 3] == -1).any():
            edge.append(tuple(a[y, x, :3]))
    if edge:
        darkest = min(set(edge), key=luminance)
        oid = idx[darkest]
        O = (pad == oid)
        doubles, clumps = [], 0
        for (y, x) in np.argwhere(ids == oid):
            py, px_ = y + 1, x + 1
            for dx in (-1, 1):
                for dy in (-1, 1):
                    if O[py, px_ + dx] and O[py + dy, px_] and not O[py + dy, px_ + dx]:
                        # both arms length 1 => staircase double, not a real corner
                        harm = O[py, px_ + 2 * dx] if 0 <= px_ + 2 * dx < O.shape[1] else False
                        varm = O[py + 2 * dy, px_] if 0 <= py + 2 * dy < O.shape[0] else False
                        if not harm and not varm:
                            doubles.append((int(x), int(y)))
        for y in range(h - 1):
            for x in range(w - 1):
                if (ids[y:y + 2, x:x + 2] == oid).all():
                    clumps += 1
        if doubles:
            warns.append(f'W2 {len(set(doubles))} L-shaped doubles in outline {sorted(set(doubles))[:6]} — use clean 1px diagonals / consistent steps')
        if clumps:
            warns.append(f'W3 {clumps} 2x2 outline clump(s) — outline thicker than 1px')
    lums = sorted({round(luminance(c), 2) for c in colors})
    if len(lums) < 3:
        warns.append('W4 fewer than 3 distinct values — form will read flat')
    return errs, warns, len(colors), (w, h)


def lint_render(path, scale, pal, bg):
    """Screenshot of art drawn at an integer scale. Finds the best grid offset,
    then requires every block to be uniform and every colour to be in palette."""
    a = np.array(Image.open(path).convert('RGB')).astype(np.int16)
    allowed = set(pal.keys())
    if bg:
        b = bg.lstrip('#'); allowed.add((int(b[0:2], 16), int(b[2:4], 16), int(b[4:6], 16)))
    best = None
    for oy in range(scale):
        for ox in range(scale):
            sub = a[oy:, ox:]
            H = (sub.shape[0] // scale) * scale
            W = (sub.shape[1] // scale) * scale
            blocks = sub[:H, :W].reshape(H // scale, scale, W // scale, scale, 3)
            ref = blocks[:, :1, :, :1, :]
            nonuni = int((np.abs(blocks - ref).max(axis=(1, 3, 4)) > 0).sum())
            if best is None or nonuni < best[0]:
                best = (nonuni, ox, oy, blocks.shape[0] * blocks.shape[2])
    nonuni, ox, oy, total = best
    cols = {tuple(c) for c in a.reshape(-1, 3)}
    off = [c for c in cols if c not in allowed]
    errs = []
    if nonuni:
        errs.append(f'R1 {nonuni}/{total} blocks not uniform at scale {scale} (best offset {ox},{oy}) — blur, sub-pixel position, or mixed scale')
    if off:
        errs.append(f'R2 {len(off)} rendered colours not in palette (e.g. ' +
                    ', '.join('#%02X%02X%02X' % c for c in off[:4]) + ') — anti-aliasing/filter/opacity leak')
    return errs


def contact_sheet(files, out, bg):
    """Review sheet: each sprite at 1x, 2x, 4x and as a solid silhouette at 4x.
    Look at it. If the 1x or the silhouette doesn't read, the sprite isn't done."""
    b = bg.lstrip('#'); bgc = (int(b[0:2], 16), int(b[2:4], 16), int(b[4:6], 16), 255)
    ims = [Image.open(f).convert('RGBA') for f in files]
    pad = 8
    rows = []
    for im in ims:
        w, h = im.size
        sil = Image.new('RGBA', im.size, (0, 0, 0, 0))
        a = np.array(im); s = np.zeros_like(a); s[a[..., 3] == 255] = (37, 42, 64, 255)
        sil = Image.fromarray(s)
        parts = [im, im.resize((w * 2, h * 2), Image.NEAREST), im.resize((w * 4, h * 4), Image.NEAREST),
                 sil.resize((w * 4, h * 4), Image.NEAREST)]
        rows.append(parts)
    W = max(sum(p.size[0] for p in r) + pad * (len(r) + 1) for r in rows)
    H = sum(max(p.size[1] for p in r) + pad for r in rows) + pad
    sheet = Image.new('RGBA', (W, H), bgc)
    y = pad
    for r in rows:
        x = pad
        for p in r:
            sheet.alpha_composite(p, (x, y)); x += p.size[0] + pad
        y += max(p.size[1] for p in r) + pad
    sheet.save(out)
    print(f'wrote {out} ({len(files)} sprites)')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('contact'); c.add_argument('paths', nargs='+'); c.add_argument('--out', required=True)
    c.add_argument('--bg', default='#F4F7F6')
    s = sub.add_parser('sprite'); s.add_argument('paths', nargs='+')
    s.add_argument('--palette', required=True); s.add_argument('--max-colors', type=int, default=12)
    s.add_argument('--grid', type=int, default=8)
    s.add_argument('--strict', action='store_true', help='treat warnings as errors')
    r = sub.add_parser('render'); r.add_argument('shot'); r.add_argument('--scale', type=int, required=True)
    r.add_argument('--palette', required=True); r.add_argument('--bg')
    a = ap.parse_args()
    if a.cmd == 'contact':
        files = []
        for p in map(pathlib.Path, a.paths):
            files += sorted(f for f in p.rglob('*.png') if '.preview.' not in f.name and '.sheet.' not in f.name) if p.is_dir() else [p]
        contact_sheet(files, a.out, a.bg)
        return
    pal = load_palette(a.palette)
    failed = False
    if a.cmd == 'sprite':
        files = []
        for p in map(pathlib.Path, a.paths):
            files += sorted(f for f in p.rglob('*.png') if '.preview.' not in f.name) if p.is_dir() else [p]
        for f in files:
            errs, warns, n, (w, h) = lint_sprite(f, pal, a.max_colors, a.grid)
            status = 'FAIL' if errs or (a.strict and warns) else ('WARN' if warns else 'ok')
            print(f'[{status}] {f}  {w}x{h}  {n} colours')
            for m in errs + warns:
                print('   ', m)
            failed |= bool(errs) or (a.strict and bool(warns))
    else:
        errs = lint_render(a.shot, a.scale, pal, a.bg)
        print(f"[{'FAIL' if errs else 'ok'}] {a.shot} @ {a.scale}x")
        for m in errs:
            print('   ', m)
        failed = bool(errs)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
