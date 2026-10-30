#!/usr/bin/env python3
"""Compile hand-authored text sprites into 1x PNGs (and optional sprite sheets).

Why text sprites: every pixel is a deliberate, reviewable decision in a diff,
colours can only come from the palette, and nothing is ever resampled.

Format (*.sprite.txt):

    # comment lines start with '#'
    size 24 24
    palette yuki16            # optional, defaults to yuki16
    .  transparent
    K  yoru-2
    W  yuki-0
    frame idle-0              # one or more frames, each exactly H rows of W chars
    ....KKKK....
    ...
    frame idle-1
    ...

Output: <out>/<name>.png (frame 0) and, if >1 frame, <out>/<name>.sheet.png
(frames laid left-to-right) plus <name>.sheet.json with frame count/size.
Always exported at 1x. Scale in CSS with image-rendering: pixelated.

Usage: python3 sprite_build.py SRC_DIR_OR_FILES... --palette PATH --out DIR
"""
import argparse, json, pathlib, sys
from PIL import Image


def hex_to_rgba(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def parse(path, palettes):
    lines = pathlib.Path(path).read_text(encoding='utf-8').splitlines()
    w = h = None
    legend, frames, cur = {}, [], None
    pal_name = 'yuki16'
    for raw in lines:
        line = raw.rstrip()
        if not line or line.lstrip().startswith('#'):
            continue
        if cur is not None and not line.startswith('frame '):
            cur['rows'].append(line)
            continue
        parts = line.split()
        if parts[0] == 'size':
            w, h = int(parts[1]), int(parts[2])
        elif parts[0] == 'palette':
            pal_name = parts[1]
        elif parts[0] == 'frame':
            cur = {'name': parts[1] if len(parts) > 1 else str(len(frames)), 'rows': []}
            frames.append(cur)
        elif len(parts[0]) == 1 and len(parts) >= 2:
            legend[parts[0]] = parts[1]
        else:
            raise SystemExit(f'{path}: cannot parse line: {raw!r}')
    if w is None:
        raise SystemExit(f'{path}: missing "size W H"')
    if pal_name not in palettes:
        raise SystemExit(f'{path}: unknown palette {pal_name}')
    pal = palettes[pal_name]
    errors = []
    imgs = []
    for f in frames:
        if len(f['rows']) != h:
            errors.append(f"frame {f['name']}: {len(f['rows'])} rows, expected {h}")
            continue
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        px = im.load()
        for y, row in enumerate(f['rows']):
            if len(row) != w:
                errors.append(f"frame {f['name']} row {y}: {len(row)} chars, expected {w}")
                continue
            for x, ch in enumerate(row):
                if ch not in legend:
                    errors.append(f"frame {f['name']} ({x},{y}): char {ch!r} not in legend")
                    continue
                name = legend[ch]
                if name == 'transparent':
                    continue
                if name not in pal:
                    errors.append(f"legend {ch!r} -> {name!r} is not in palette {pal_name}")
                    continue
                px[x, y] = hex_to_rgba(pal[name])
        imgs.append(im)
    if errors:
        raise SystemExit(f'{path}:\n  ' + '\n  '.join(errors))
    return imgs, w, h, [f['name'] for f in frames]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='+')
    ap.add_argument('--palette', action='append', required=True,
                    help='palette json (repeatable)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--preview', type=int, default=0,
                    help='also write <name>.preview.png at this integer scale (review only, never ship)')
    a = ap.parse_args()
    palettes = {}
    for p in a.palette:
        d = json.loads(pathlib.Path(p).read_text())
        palettes[d['name']] = d['colors']
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for s in a.src:
        p = pathlib.Path(s)
        files += sorted(p.glob('*.sprite.txt')) if p.is_dir() else [p]
    for f in files:
        name = f.name.replace('.sprite.txt', '')
        imgs, w, h, names = parse(f, palettes)
        imgs[0].save(out / f'{name}.png')
        if len(imgs) > 1:
            sheet = Image.new('RGBA', (w * len(imgs), h), (0, 0, 0, 0))
            for i, im in enumerate(imgs):
                sheet.paste(im, (i * w, 0))
            sheet.save(out / f'{name}.sheet.png')
            (out / f'{name}.sheet.json').write_text(json.dumps(
                {'frameWidth': w, 'frameHeight': h, 'frames': names}, indent=2))
        if a.preview:
            k = a.preview
            row = Image.new('RGBA', (w * len(imgs) * k + (len(imgs) - 1) * k * 2, h * k), (0, 0, 0, 0))
            for i, im in enumerate(imgs):
                row.paste(im.resize((w * k, h * k), Image.NEAREST), (i * (w * k + k * 2), 0))
            row.save(out / f'{name}.preview.png')
        print(f'built {name}: {w}x{h}, {len(imgs)} frame(s)')


if __name__ == '__main__':
    main()
