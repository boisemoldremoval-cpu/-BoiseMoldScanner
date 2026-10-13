"""Cut a white-background building image (from the ChatGPT PDFs) out and print its ART entry.

usage: python3 process_batch.py <input.jpg> <name> <fit_tiles>
The pictures are isometric. fit_tiles is the footprint width the picture's base should span
(the base is drawn exactly that wide). ax, ay = midpoint of the base's left and right corners.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, name, fit = sys.argv[1], sys.argv[2], float(sys.argv[3])
here = os.path.dirname(os.path.abspath(__file__))
im = Image.open(src).convert('RGB')
im.save(os.path.join(here, 'source', f'{name}-original.png'))
a = np.array(im).astype(np.int16)
mn, mx = a.min(axis=2), a.max(axis=2)
bgish = ((mn > 228) & (mx - mn < 22)).astype(np.uint8) * 255   # near-white, unsaturated
m = Image.fromarray(bgish).copy()   # copy: floodfill does nothing on an array-backed image
w, h = m.size
for x in range(0, w, 8):                                        # flood the background in from every edge
    for y in (0, h - 1):
        if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
for y in range(0, h, 8):
    for x in (0, w - 1):
        if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
fg = Image.fromarray(((np.array(m) != 128) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
rgba = im.convert('RGBA'); rgba.putalpha(fg)
rgba = rgba.crop(fg.getbbox())
W = min(1024, rgba.width)
rgba = rgba.resize((W, round(rgba.height * W / rgba.width)), Image.LANCZOS)
al = np.array(rgba)[..., 3]; al = np.where(al >= 128, 255, 0).astype(np.uint8)
rgba.putalpha(Image.fromarray(al))
rgba.save(os.path.join(here, 'source', f'{name}-clean.png'))
rgba.save(os.path.join(here, f'{name}.webp'), 'WEBP', quality=88, method=6)

solid = al > 0
ys, xs = np.where(solid)
top, bottom = ys.min(), ys.max()
# The base's left and right corners: the outermost columns in the lower half with a solid run of
# some height, so thin poles, lamps and flagpoles sticking out do not count.
y0 = int(bottom - (bottom - top) * 0.5)
band = solid[y0:bottom + 1]
cols = np.where(band.sum(axis=0) >= max(8, band.shape[0] * 0.12))[0]
left, right = cols.min(), cols.max()
ly = y0 + np.where(band[:, left])[0].mean()
ry = y0 + np.where(band[:, right])[0].mean()
ppt = (right - left) / fit
print(f"{{ src: 'art/{name}.webp', w: {rgba.width}, h: {rgba.height}, ax: {round((left + right) / 2)}, ay: {round((ly + ry) / 2)}, ppt: {round(ppt)} }}")
