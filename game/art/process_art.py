"""Clean a generated building image and print the numbers the game needs to place it.

usage: python3 process_art.py <input.png> <ID-version> <footprint_w> <footprint_h>
e.g.   python3 process_art.py upload.png S02-vanguard 2 2

For the game's straight-on camera (looking north, about 58 degrees down). The building's base
shows as a level rectangle: its width is measured across the lower part of the picture, and its
front edge is the bottom of the solid pixels. Writes source/<name>-original.png,
source/<name>-clean.png and <name>.webp (1152 px wide), then prints an ART entry:
ax, ay = pixel at the footprint centre on the ground, ppt = pixels per map tile.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

PITCH = 1.02  # must match the game camera
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

solid = np.array(small)[..., 3] > 128
ys, xs = np.where(solid)
top, bottom = ys.min(), ys.max()
base = solid[int(bottom - (bottom - top) * 0.35):bottom + 1]   # lower 35%: the foundation
bx = np.where(base.any(axis=0))[0]
left, right = bx.min(), bx.max()
ppt = (right - left) / fw
ax = (left + right) / 2
ay = bottom - (fh / 2) * math.sin(PITCH) * ppt                   # front edge is half the depth in front of the centre
print(f'{name}: {W}x{H}, {os.path.getsize(os.path.join(here, name + ".webp"))} bytes; base x {left}-{right}, front edge y {bottom}')
print(f"  ART entry: {{ src: 'art/{name}.webp', w: {W}, h: {H}, ax: {round(ax)}, ay: {round(ay)}, ppt: {round(ppt)} }}")
