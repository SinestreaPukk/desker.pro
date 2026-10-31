#!/usr/bin/env python3
"""Read the kodama pose sheet (pixel art on an 8px grid) back into 1x cells: one median colour per cell.
Writes art/authoring/kodama_cells.npy (H x W x 3) and prints the colours it finds."""
import sys, collections
import numpy as np
from PIL import Image
im = np.array(Image.open(sys.argv[1]).convert('RGB'))
P, OX, OY = 8, 0, 6
H, W = (im.shape[0] - OY) // P, (im.shape[1] - OX) // P
cells = np.zeros((H, W, 3), np.uint8)
for j in range(H):
    for i in range(W):
        blk = im[OY + j * P + 2:OY + j * P + 6, OX + i * P + 2:OX + i * P + 6].reshape(-1, 3)
        cells[j, i] = np.median(blk, 0)
np.save(sys.argv[2], cells)
q = collections.Counter(map(tuple, (cells // 12 * 12).reshape(-1, 3)))
print(H, W, q.most_common(24))
