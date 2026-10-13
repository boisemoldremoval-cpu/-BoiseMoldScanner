"""Clean the unit pictures from the ChatGPT package for the sidebar build icons.

usage: python3 process_units.py <assets folder>
Keeps the main figure (drops stray bits cropped in from neighbouring units), hardens the alpha
edge, trims, and writes U01-vanguard.webp ... U11-vanguard.webp next to this script.
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
for i in range(1, 12):
    uid = f'U{i:02d}'
    im = Image.open(os.path.join(src, f'{uid}-A.png')).convert('RGBA')
    im.save(os.path.join(here, 'source', f'{uid}-A.png'))
    a = np.array(im)
    solid = a[..., 3] > 110
    h, w = solid.shape
    lab = np.zeros((h, w), np.int32); sizes = [0]
    for y0, x0 in zip(*np.nonzero(solid)):
        if lab[y0, x0]: continue
        n = len(sizes); sizes.append(0); q = deque([(y0, x0)]); lab[y0, x0] = n
        while q:
            y, x = q.popleft(); sizes[n] += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and solid[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; q.append((yy, xx))
    big = max(sizes)
    keep = np.isin(lab, [k for k, s in enumerate(sizes) if k and s >= big * 0.04])
    # pieces touching the left or right edge that are much smaller than the figure came from a neighbour on the sheet
    for k, s in enumerate(sizes):
        if k and s < big * 0.25 and (lab[:, 0] == k).any() | (lab[:, -1] == k).any():
            keep &= lab != k
    al = np.where(keep, 255, 0).astype(np.uint8)
    a[..., 3] = al
    out = Image.fromarray(a).crop(Image.fromarray(al).getbbox())
    out.save(os.path.join(here, f'{uid}-vanguard.webp'), 'WEBP', quality=90, method=6)
    print(uid, out.size, f'kept {keep.sum()} px, {len(sizes) - 1} pieces')
