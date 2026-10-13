"""Clean a generated building image and print the numbers the game needs to place it.

usage: python3 process_art.py <input.png> <ID-version> <footprint_w> <footprint_h>
e.g.   python3 process_art.py upload.png S02-vanguard 2 2

Writes source/<name>-original.png, source/<name>-clean.png and <name>.webp (1152 px wide),
then prints an ART entry: ax, ay = pixel at the footprint centre, ppt = pixels per map tile.
The footprint is found from the left-most, right-most and bottom-most solid pixels, which are
the corners of the building's base in an isometric picture.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

YAW = 0.68  # must match the game camera
src, name, fw, fh = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(here, 'source'), exist_ok=True)

im = Image.open(src).convert('RGBA')
im.save(os.path.join(here, 'source', f'{name}-original.png'))
a = np.array(im).astype(np.int16)
al, r, g, b = a[..., 3], a[..., 0], a[..., 1], a[..., 2]
al = np.where(al < 40, 0, al)                                         # near-invisible matte fringe
al = np.where((al < 160) & (r > g + 40) & (r > b + 40), 0, al)      # red halo from background removal
al = np.where(al >= 200, 255, al)                                     # make the body fully solid
mask = Image.fromarray((al > 0).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3))
al = np.where(np.array(mask) > 0, al, 0)
a[..., 3] = al
clean = Image.fromarray(a.astype(np.uint8), 'RGBA')
clean.save(os.path.join(here, 'source', f'{name}-clean.png'))

W = 1152
H = round(clean.height * W / clean.width)
small = clean.resize((W, H), Image.LANCZOS)
small.save(os.path.join(here, f'{name}.webp'), 'WEBP', quality=88, method=6)

sa = np.array(small)[..., 3] > 128
ys, xs = np.where(sa)
left = (xs.min(), ys[xs == xs.min()].mean())
right = (xs.max(), ys[xs == xs.max()].mean())
bottom = (xs[ys == ys.max()].mean(), ys.max())
# with the camera turned YAW, a w x h footprint spans w*cos + h*sin tiles horizontally
span_tiles = fw * math.cos(YAW) + fh * math.sin(YAW)
ppt = (right[0] - left[0]) / span_tiles
# footprint centre: midpoint of the side corners, nudged so the bottom corner lands where it should
cx, cy = (left[0] + right[0]) / 2, (left[1] + right[1]) / 2
print(f'{name}: {W}x{H}, {os.path.getsize(os.path.join(here, name + ".webp"))} bytes')
print(f'  corners L{tuple(round(v) for v in left)} R{tuple(round(v) for v in right)} B{tuple(round(v) for v in bottom)}')
print(f"  ART entry: {{ src: 'art/{name}.webp', w: {W}, h: {H}, ax: {round(cx)}, ay: {round(cy)}, ppt: {round(ppt)} }}")
