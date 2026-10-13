"""Pack each unit's usable direction sprites into one strip (U01-dirs.webp ...) and print the table the game uses.

The ChatGPT sheet is not a clean 8-direction set: several labels are wrong, some views repeat and a few
are another unit. TRUE lists, per unit, only the views checked by eye: game direction -> sheet file
(sheet-raw/<uid>-<file>.png). A missing direction takes the mirror image of its opposite side when that
exists, otherwise the nearest available view; 'keep' means hold the previous view (an exact tie).
"""
import json
import math
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
INF = {'W': 'W', 'E': 'E', 'SW': 'SW', 'S': 'S', 'SE': 'SE'}
TRUE = {
    'U01': INF, 'U02': INF, 'U03': INF, 'U04': INF,
    'U05': {'W': 'W', 'E': 'E', 'SW': 'SW', 'SE': 'SE', 'S': 'S'},
    'U06': {'NW': 'NW', 'NE': 'NE', 'W': 'W', 'E': 'E', 'SW': 'SW', 'S': 'S', 'SE': 'SE'},
    'U07': {'NW': 'NW', 'NE': 'NE', 'W': 'W', 'E': 'E', 'SW': 'SW', 'S': 'S', 'SE': 'SE'},
    'U08': {'W': 'W', 'E': 'E', 'SW': 'SW', 'SE': 'SE', 'S': 'S'},
    'U09': {'W': 'W', 'E': 'E', 'NE': 'NE'},
    'U10': {'W': 'E', 'E': 'W', 'SW': 'SW', 'S': 'S', 'SE': 'SE'},   # the sheet's W and E Harvester views are swapped
    'U11': {'NW': 'NW', 'NE': 'NE', 'N': 'N', 'W': 'W'},
}
# side-view length on the map in tiles (vehicles) or standing height (infantry), matching the 3D model scale
SIZE = {'U01': 0.42, 'U02': 0.42, 'U03': 0.42, 'U04': 0.42, 'U05': 0.7, 'U06': 1.1, 'U07': 1.3, 'U08': 1.5, 'U09': 1.35, 'U10': 1.5, 'U11': 1.65}
ANG = {'S': 0, 'SE': 45, 'E': 90, 'NE': 135, 'N': 180, 'NW': -135, 'W': -90, 'SW': -45}
MIRROR = {'S': 'S', 'N': 'N', 'E': 'W', 'W': 'E', 'SE': 'SW', 'SW': 'SE', 'NE': 'NW', 'NW': 'NE'}
diff = lambda a, b: abs((ANG[a] - ANG[b] + 180) % 360 - 180)

table = {}
for uid, true in TRUE.items():
    files = sorted(set(true.values()), key=list(ANG).index)
    ims = [Image.open(os.path.join(HERE, 'sheet-raw', f'{uid}-{f}.png')) for f in files]
    W, H = sum(i.width for i in ims) + 2 * len(ims), max(i.height for i in ims)
    strip = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x = 0; frames = {}
    inf = uid <= 'U04'
    for f, im in zip(files, ims):
        strip.paste(im, (x, H - im.height))
        # anchor: the ground point under the unit, a little above the lowest pixels (feet or tracks)
        frames[f] = [x, H - im.height, im.width, im.height, round(im.width / 2), round(im.height * (0.96 if inf else 0.78))]
        x += im.width + 2
    strip.save(os.path.join(HERE, f'{uid}-dirs.webp'), 'WEBP', quality=92, method=6, exact=True)
    side = Image.open(os.path.join(HERE, 'sheet-raw', f'{uid}-{true.get("W", true.get("NW", "W"))}.png'))
    ppt = (side.height if inf else side.width) / SIZE[uid]
    have = {d: [f, 0] for d, f in true.items()}
    for d in ANG:
        if d not in have and MIRROR[d] in true: have[d] = [true[MIRROR[d]], 1]
    view = {}
    for d in ANG:
        if d in have: view[d] = have[d]; continue
        best = sorted(have, key=lambda k: diff(d, k)); top = [k for k in best if diff(d, k) == diff(d, best[0])]
        view[d] = 'keep' if len(top) > 1 else have[top[0]]
    table[uid] = {'w': W, 'h': H, 'ppt': round(ppt, 1), 'frames': frames, 'view': view}
    print(uid, W, H, 'ppt', round(ppt, 1), {d: (v if v == 'keep' else v[0] + ('~' if v[1] else '')) for d, v in view.items()})
json.dump(table, open(os.path.join(HERE, 'dirs.json'), 'w'), separators=(',', ':'))
