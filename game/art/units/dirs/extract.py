"""Cut the 8-direction unit sprites out of the ChatGPT overview sheet (source/unit-sprite-sheets.png).

Each unit panel holds 8 views in a ring: top row NW N NE, middle row W E, bottom row SW S SE.
The grey background and shadows are flooded away from the panel edges; the direction labels
are dropped by size. Writes sheet-raw/<uid>-<slot>.png named by ring position, and a preview.
"""
import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = Image.open(os.path.join(HERE, 'source', 'unit-sprite-sheets.png')).convert('RGB')
PANELS = {  # x0, y0, x1, y1 of the picture area below each title bar
    'U01': (6, 52, 307, 352), 'U02': (313, 52, 609, 352), 'U03': (616, 52, 905, 352), 'U04': (911, 52, 1212, 352), 'U05': (1219, 52, 1530, 352),
    'U06': (6, 407, 264, 686), 'U07': (271, 407, 517, 686), 'U08': (523, 407, 761, 686), 'U09': (766, 407, 1019, 686), 'U10': (1024, 407, 1271, 686), 'U11': (1276, 407, 1530, 686),
}
RING = [['NW', 'N', 'NE'], ['W', None, 'E'], ['SW', 'S', 'SE']]
out = os.path.join(HERE, 'sheet-raw'); os.makedirs(out, exist_ok=True)


def components(mask):
    h, w = mask.shape; lab = np.zeros((h, w), np.int32); boxes = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        n = len(boxes) + 1; q = deque([(y0, x0)]); lab[y0, x0] = n; ys = []; xs = []
        while q:
            y, x = q.popleft(); ys.append(y); xs.append(x)
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; q.append((yy, xx))
        boxes.append((len(ys), min(xs), min(ys), max(xs), max(ys)))
    return lab, boxes


previews = []
for uid, (x0, y0, x1, y1) in PANELS.items():
    p = SHEET.crop((x0, y0, x1, y1)); a = np.array(p).astype(np.int16)
    mn, mx = a.min(2), a.max(2)
    # light grey background, soft grey shadows, and the warm glow behind the engineers; sprites have dark outlines
    bgish = ((mn > 100) | ((mx - mn < 38) & (mn > 78))).astype(np.uint8) * 255
    m = Image.fromarray(bgish).copy(); w, h = m.size
    for x in range(0, w, 4):
        for y in (0, h - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    for y in range(0, h, 4):
        for x in (0, w - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    fg = np.array(Image.fromarray(((np.array(m) != 128) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))) > 0
    lab, boxes = components(fg)
    big = [(i + 1, b) for i, b in enumerate(boxes) if b[0] > 500]
    rows = sorted(big, key=lambda t: (t[1][2] + t[1][4]) / 2)
    cy = [(b[2] + b[4]) / 2 for _, b in rows]
    # assign rows by splitting the panel height in thirds, columns by thirds of width
    for n, b in big:
        cxx, cyy = (b[1] + b[3]) / 2, (b[2] + b[4]) / 2
        r = min(2, int(cyy / (h / 3))); c = min(2, int(cxx / (w / 3)))
        slot = RING[r][c] or ('W' if cxx < w / 2 else 'E')
        keep = lab == n
        # small bits (antennas, barrel tips) that sit inside the sprite's box belong to it; labels sit below it
        for k, bb in enumerate(boxes):
            if bb[0] <= 500 and bb[1] >= b[1] - 3 and bb[3] <= b[3] + 3 and bb[2] >= b[2] - 3 and bb[4] <= b[4] + 3: keep |= lab == k + 1
        rgba = np.dstack([a.astype(np.uint8), (keep * 255).astype(np.uint8)])
        img = Image.fromarray(rgba, 'RGBA').crop((b[1], b[2], b[3] + 1, b[4] + 1))
        img.save(os.path.join(out, f'{uid}-{slot}.png'))
        previews.append((uid, slot, img))
    print(uid, sorted(s for u, s, _ in previews if u == uid))

W = 110
sheet = Image.new('RGB', (W * 8, W * 11 + 0), (40, 42, 40)); d = ImageDraw.Draw(sheet)
order = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE']
for r, uid in enumerate(PANELS):
    for c, sl in enumerate(order):
        f = os.path.join(out, f'{uid}-{sl}.png')
        if os.path.exists(f):
            im = Image.open(f); im.thumbnail((W - 8, W - 18)); sheet.paste(im, (c * W + 4, r * W + 2), im)
        d.text((c * W + 4, r * W + W - 14), f'{uid} {sl}', fill=(230, 200, 90))
sheet.save(os.path.join(HERE, 'sheet-raw-preview.png'))
