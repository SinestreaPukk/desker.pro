#!/usr/bin/env python3
"""Logo files from the default avatar: favicon and PWA icons are the 24x24 sprite at an integer scale on yuki-0."""
import pathlib
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sp = Image.open(ROOT / 'public/pixel/av-main.png').convert('RGBA')
BG = (244, 247, 246, 255)
def icon(size, scale, name):
    im = Image.new('RGBA', (size, size), BG)
    m = (size - 24 * scale) // 2
    im.alpha_composite(sp.resize((24 * scale, 24 * scale), Image.NEAREST), (m, m))
    im.convert('RGB').save(ROOT / 'public' / name)
# favicon (browser tab): no background, cropped to the bird, scale 3, square canvas hugging the bird
box = sp.getbbox(); crop = sp.crop(box); k = 3; N = max(crop.size) * k + 2 * k
fav = Image.new('RGBA', (N, N), (0, 0, 0, 0)); big = crop.resize((crop.width * k, crop.height * k), Image.NEAREST)
fav.alpha_composite(big, ((N - big.width) // 2, (N - big.height) // 2)); fav.save(ROOT / 'public/favicon.png')
icon(180, 7, 'icon-180.png'); icon(192, 8, 'icon-192.png'); icon(512, 20, 'icon-512.png')
