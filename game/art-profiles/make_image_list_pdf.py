from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'Iron-Frontier-Image-List.pdf')
IMG = os.path.join(HERE, 'reference-renders')

INK, MUTED, GOLD, LINE, HEAD = (colors.HexColor(c) for c in ('#1C1E1B', '#5E6258', '#B8891C', '#CFD1C8', '#EEEFE9'))
st = {
    'title': ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=28, leading=32, textColor=INK, spaceAfter=6),
    'sub': ParagraphStyle('s', fontName='Helvetica', fontSize=11.5, leading=16, textColor=MUTED, spaceAfter=12),
    'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=INK, spaceBefore=4, spaceAfter=2, keepWithNext=1),
    'note': ParagraphStyle('n', fontName='Helvetica', fontSize=9, leading=12.5, textColor=MUTED, spaceAfter=6),
    'c': ParagraphStyle('c', fontName='Helvetica', fontSize=8.6, leading=11.4, textColor=INK),
    'cb': ParagraphStyle('cb', fontName='Helvetica-Bold', fontSize=9, leading=11.4, textColor=INK),
    'ch': ParagraphStyle('ch', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=MUTED),
}

TWO = 'Vanguard + Red Dominion'
# (id, thumbnail key or None, name, what it shows, where it appears, size / format)
SECTIONS = [
    ('Structures', 'Each structure needs its map image in both faction colors, plus one build icon for the sidebar.', [
        ('S01', 'hq', 'Construction Yard', 'Main base building: assembly hall, corner tower with a construction crane. 3 x 3 tiles.', 'Battlefield; deployed from the MCV', TWO + '. Map 1024 px square, icon 400 x 300'),
        ('S02', 'power', 'Power Plant', 'Generator hall with two smokestacks and glowing vents. 2 x 2 tiles.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S03', 'refinery', 'Refinery', 'Processing hall, two domed silos, striped unloading pad in front. 3 x 2 tiles + dock.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S04', 'silo', 'Crystal Silo', 'Two squat storage tanks with green fill gauges. 2 x 1 tiles.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S05', 'barracks', 'Barracks', 'Canvas army tent with sandbags and a flag. 2 x 2 tiles.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S06', 'factory', 'War Factory', 'Vehicle hangar with a big roll-up door and roof crane. 3 x 3 tiles.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S07', 'radar', 'Comm Center', 'Small command building with a tall radar dish. 2 x 2 tiles.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S08', 'repair', 'Repair Pad', 'Flat concrete pad with a yellow cross and corner lights. 2 x 2 tiles.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S09', 'tower', 'Guard Tower', 'Sandbagged pillbox with a machine-gun turret. 1 x 1 tile.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S10', 'atower', 'Advanced Tower', 'Tall concrete tower with twin missile pods. 1 x 1 tile.', 'Battlefield, Build list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('S11', 'wall', 'Sandbags', 'Wall segment of stacked sandbags; must line up in a row. 1 x 1 tile.', 'Battlefield, Build list', 'One version. Map 1024 px, icon 400 x 300'),
    ]),
    ('Units', 'Each unit needs its map image in both faction colors, plus one build icon for the sidebar.', [
        ('U01', 'rifle', 'Rifleman', 'Soldier with an assault rifle.', 'Battlefield, Units list', TWO + '. Map 512 px square, icon 400 x 300'),
        ('U02', 'gren', 'Grenadier', 'Soldier throwing a grenade, grenade bag on hip.', 'Battlefield, Units list', TWO + '. Map 512 px, icon 400 x 300'),
        ('U03', 'rocket', 'Rocket Soldier', 'Soldier with a shoulder rocket launcher.', 'Battlefield, Units list', TWO + '. Map 512 px, icon 400 x 300'),
        ('U04', 'eng', 'Engineer', 'Orange vest, yellow hard hat, red toolbox, no weapon.', 'Battlefield, Units list', 'One version (orange for both). Map 512 px, icon 400 x 300'),
        ('U05', 'buggy', 'Recon Buggy', 'Four-wheel open dune buggy with a machine gun.', 'Battlefield, Units list', TWO + '. Map 768 px, icon 400 x 300'),
        ('U06', 'ltank', 'Light Tank', 'Small fast tank with a short cannon.', 'Battlefield, Units list', TWO + '. Map 768 px, icon 400 x 300'),
        ('U07', 'tank', 'Medium Tank', 'Main battle tank with a long cannon.', 'Battlefield, Units list', TWO + '. Map 768 px, icon 400 x 300'),
        ('U08', 'htank', 'Heavy Tank', 'Huge tank, twin cannons, missile pods on the turret.', 'Battlefield, Units list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('U09', 'arty', 'Artillery', 'Tracked howitzer with a long raised barrel.', 'Battlefield, Units list', TWO + '. Map 768 px, icon 400 x 300'),
        ('U10', 'harv', 'Harvester', 'Tracked mining vehicle, front drum, hopper full of green crystal.', 'Battlefield, Units list', TWO + '. Map 1024 px, icon 400 x 300'),
        ('U11', 'mcv', 'MCV', 'Six-wheeled truck carrying a folded construction module.', 'Battlefield, Units list', TWO + '. Map 1024 px, icon 400 x 300'),
    ]),
    ('Terrain', 'Shared by both sides.', [
        ('T01', None, 'Ground texture', 'Grass with dirt patches, seen from straight above. Must tile seamlessly.', 'Whole battlefield floor', '1024 px square, seamless'),
        ('T02', None, 'Base dirt texture', 'Worn, packed dirt for around the bases. Must tile seamlessly.', 'Around each base', '1024 px square, seamless'),
        ('T03', None, 'Crystal clusters', 'Glowing green crystal spikes, 4 sizes from small to dense.', 'Crystal fields; harvester cargo', '4 images, 512 px each, transparent'),
        ('T04', None, 'Crystal soil', 'Dark greenish soil under crystal fields. Must tile seamlessly.', 'Under crystal fields', '1024 px square, seamless'),
        ('T05', None, 'Rocks', 'Grey boulders, 4 variations.', 'Map obstacles', '4 images, 512 px each, transparent'),
        ('T06', None, 'Trees', 'Leafy trees with round crowns, 4 variations.', 'Map obstacles and edges', '4 images, 512 px each, transparent'),
    ]),
    ('Effects', 'Shared by both sides. Transparent backgrounds.', [
        ('F01', None, 'Explosion', 'Animation: flash, fireball, then rolling smoke. 8 frames in a row.', 'Destroyed units and buildings, shell hits', '8 frames, 512 px each'),
        ('F02', None, 'Small explosion', 'Quick burst for shells and grenades. 6 frames.', 'Weapon hits', '6 frames, 256 px each'),
        ('F03', None, 'Muzzle flash', 'Bright gun flash, 3 variations.', 'Every shot fired', '3 images, 128 px'),
        ('F04', None, 'Smoke puff', 'Soft grey puff.', 'Chimneys, damaged vehicles, rocket trails', '256 px'),
        ('F05', None, 'Fire', 'Flickering flames. 6 frames.', 'Badly damaged buildings', '6 frames, 256 px each'),
        ('F06', None, 'Scorch mark', 'Burnt patch on the ground, seen from above.', 'Left after explosions', '512 px'),
        ('F07', None, 'Crushed infantry mark', 'Dark stain on the ground, seen from above (not graphic).', 'When a tank runs over a soldier', '256 px'),
        ('F08', None, 'Projectiles', 'Tank shell, rocket, missile, grenade, artillery shell.', 'Shots in flight', '5 images, 128 px each'),
        ('F09', None, 'Repair sparks', 'Small yellow welding sparks.', 'Buildings and vehicles being repaired', '128 px'),
        ('F10', None, 'Move / attack marker', 'Ring on the ground: green for move, red for attack.', 'Where you click to give orders', '2 images, 256 px'),
    ]),
    ('Interface', 'Menus, sidebar and on-map markers.', [
        ('I01', None, 'Game logo', 'The words IRON FRONTIER as a military stencil wordmark.', 'Title screen', '2048 x 768, transparent'),
        ('I02', None, 'Title screen background', 'Wide battlefield scene: tanks, base, crystal field.', 'Behind the start menu', '1920 x 1080'),
        ('I03', None, 'Victory screen art', 'Your forces celebrating over a captured enemy base.', 'End screen after winning', '1920 x 1080'),
        ('I04', None, 'Defeat screen art', 'A destroyed, smoking base.', 'End screen after losing', '1920 x 1080'),
        ('I05', None, 'Faction emblems', 'Vanguard emblem (gold) and Red Dominion emblem (red).', 'Menus, sidebar, flags', '2 images, 512 px, transparent'),
        ('I06', None, 'Sidebar panel texture', 'Riveted gunmetal metal plate. Must tile vertically.', 'Right-hand command sidebar', '600 x 1200, seamless vertically'),
        ('I07', None, 'Build icon frame', 'Beveled metal frame that goes around each build icon.', 'Every build icon in the sidebar', '400 x 300, transparent center'),
        ('I08', None, 'Radar frame', 'Metal frame around the radar map with screws.', 'Sidebar radar', '600 px square, transparent center'),
        ('I09', None, 'Radar offline screen', 'Green static noise.', 'Radar when there is no Comm Center or power', '512 px square'),
        ('I10', None, 'Repair and Sell buttons', 'Two buttons: a wrench and a dollar sign, normal and pressed.', 'Top of the sidebar', '4 images, 280 x 80'),
        ('I11', None, 'Selection brackets', 'White corner brackets around selected units.', 'Selected units and buildings', '256 px, transparent'),
        ('I12', None, 'Health bar', 'Thin segmented bar: green, yellow, red states.', 'Above selected or damaged units', '3 images, 256 x 24'),
        ('I13', None, 'Repair wrench icon', 'Round badge with a yellow wrench.', 'Above buildings being repaired', '128 px, transparent'),
        ('I14', None, 'PRIMARY label', 'The word PRIMARY in white stencil letters.', 'Above the primary Barracks or Factory', '256 x 64, transparent'),
        ('I15', None, 'Mouse cursors', 'Normal, select, attack crosshair, move, repair wrench, sell $, cannot build.', 'Mouse pointer', '7 images, 64 px, transparent'),
    ]),
]


def thumb(key):
    if not key:
        return Paragraph('none yet', st['note'])
    return Image(os.path.join(IMG, key + '.png'), width=1.05 * inch, height=1.05 * inch * 0.75)


def footer(c, d):
    c.saveState(); c.setFont('Helvetica', 8); c.setFillColor(MUTED)
    c.drawString(0.6 * inch, 0.45 * inch, 'Iron Frontier · Game image list')
    c.drawRightString(letter[0] - 0.6 * inch, 0.45 * inch, f'Page {d.page}')
    c.restoreState()


total_rows = sum(len(r) for _, _, r in SECTIONS)
story = [Paragraph('Iron Frontier: Game Image List', st['title']),
         Paragraph(f'Every image the game uses, in {total_rows} entries. Each entry gives an ID, what the image shows, where it appears in the game, '
                   'and the size to make it. Name your files by ID and version, for example <b>S01-vanguard.png</b>, <b>S01-red.png</b> or <b>S01-icon.png</b>.', st['sub']),
         Paragraph('<b>Camera for all map images:</b> three-quarter top-down view from about 55 degrees, facing the lower left, sun from the upper left. '
                   '<b>Factions:</b> Vanguard is olive drab (#8A8457) with gold trim (#D9AE3A); Red Dominion is gunmetal (#58595D) with red trim (#B3261E). '
                   'Map images and icons need transparent backgrounds unless noted.', st['note'])]
widths = [0.45 * inch, 1.15 * inch, 1.2 * inch, 2.15 * inch, 1.35 * inch, 1.5 * inch]
for title, note, rows in SECTIONS:
    story += [Spacer(1, 8), Paragraph(f'{title} ({len(rows)})', st['h1']), Paragraph(note, ParagraphStyle('nk', parent=st['note'], keepWithNext=1))]
    data = [[Paragraph(h, st['ch']) for h in ('ID', 'Current look', 'Image', 'What it shows', 'Where in the game', 'Versions and size')]]
    for pid, key, name, what, where, size in rows:
        data.append([Paragraph(pid, st['cb']), thumb(key), Paragraph(name, st['cb']), Paragraph(what, st['c']), Paragraph(where, st['c']), Paragraph(size, st['c'])])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BACKGROUND', (0, 0), (-1, 0), HEAD),
                           ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                           ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4)]))
    story.append(t)

doc = BaseDocTemplate(OUT, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.7 * inch,
                      title='Iron Frontier: Game Image List', author='Boise Mold Removal')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)], onPage=footer)])
doc.build(story)
print('wrote', OUT, total_rows, 'entries')
