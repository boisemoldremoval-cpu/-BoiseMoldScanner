"""Iron Frontier unit sheet: every unit in the game with its stats and ChatGPT prompts that match the Batch 1 building art."""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'Iron-Frontier-Units.pdf')
IMG = os.path.join(HERE, 'reference-renders')

INK, MUTED, GOLD, LINE, HEAD, BOX = (colors.HexColor(c) for c in ('#1C1E1B', '#5E6258', '#B8891C', '#CFD1C8', '#EEEFE9', '#F6F5EE'))
st = {
    'title': ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=28, leading=32, textColor=INK, spaceAfter=6),
    'sub': ParagraphStyle('s', fontName='Helvetica', fontSize=11.5, leading=16, textColor=MUTED, spaceAfter=10),
    'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=INK, spaceAfter=2),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=GOLD, spaceBefore=8, spaceAfter=3),
    'body': ParagraphStyle('b', fontName='Helvetica', fontSize=10, leading=14, textColor=INK, spaceAfter=4),
    'note': ParagraphStyle('n', fontName='Helvetica', fontSize=9, leading=12.5, textColor=MUTED, spaceAfter=6),
    'prompt': ParagraphStyle('p', fontName='Helvetica', fontSize=9.6, leading=13.4, textColor=INK),
    'c': ParagraphStyle('c', fontName='Helvetica', fontSize=8.6, leading=11.2, textColor=INK),
    'cb': ParagraphStyle('cb', fontName='Helvetica-Bold', fontSize=9, leading=11.2, textColor=INK),
    'ch': ParagraphStyle('ch', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=MUTED),
}

# (id, key, name, kind, role, cost, armor, weapon, size in game, what it looks like)
UNITS = [
    ('U01', 'rifle', 'Rifleman', 'Infantry', 'Cheap infantry. Good against infantry.', 100, 'Infantry, 50 HP', 'Assault rifle',
     'about 0.4 tiles', 'a single soldier in olive fatigues and a gold-striped helmet, holding an assault rifle at the ready, webbing and pouches'),
    ('U02', 'gren', 'Grenadier', 'Infantry', 'Lobs grenades with splash damage. Good against groups and buildings.', 160, 'Infantry, 50 HP', 'Grenades (splash)',
     'about 0.4 tiles', 'a single soldier in olive fatigues and helmet, mid-throw with a grenade raised, grenade bandolier across the chest and a bag on the hip'),
    ('U03', 'rocket', 'Rocket Soldier', 'Infantry', 'Good against vehicles and towers.', 300, 'Infantry, 45 HP', 'Shoulder rocket launcher',
     'about 0.4 tiles', 'a single soldier in olive fatigues and helmet, kneeling with a long olive-and-gold shoulder rocket launcher, spare rockets on the back'),
    ('U04', 'eng', 'Engineer', 'Infantry', 'Captures enemy structures. Order it onto an enemy building.', 500, 'Infantry, 30 HP', 'None',
     'about 0.4 tiles', 'a single unarmed engineer in an orange safety vest over olive overalls, yellow hard hat, carrying a red toolbox'),
    ('U05', 'buggy', 'Recon Buggy', 'Vehicle', 'Fast scout with a machine gun. Good for raiding harvesters.', 300, 'Light, 140 HP', 'Machine gun',
     'about 0.8 tiles long', 'a four-wheel open-frame dune buggy with a roll cage, big off-road tires and a pintle machine gun mounted behind the seats'),
    ('U06', 'ltank', 'Light Tank', 'Vehicle', 'Quick, cheap tank.', 600, 'Heavy, 300 HP', 'Short cannon',
     'about 0.9 tiles long', 'a small fast tracked tank with a low angular hull, small turret and a short cannon'),
    ('U07', 'tank', 'Medium Tank', 'Vehicle', 'Main battle tank. Solid all-rounder.', 800, 'Heavy, 420 HP', 'Long cannon',
     'about 1 tile long', 'a main battle tank with sloped armor, a large turret, long cannon with a muzzle brake, side skirts over the tracks'),
    ('U08', 'htank', 'Heavy Tank', 'Vehicle', 'Twin cannons and heavy armor. Repairs itself to half health. Needs a Comm Center.', 1500, 'Heavy, 800 HP', 'Twin cannons',
     'about 1.2 tiles long', 'a huge heavy tank with a wide double-track hull, a massive turret with twin long cannons and a missile pod on each side of the turret'),
    ('U09', 'arty', 'Artillery', 'Vehicle', 'Long-range shells with splash. Cannot hit targets up close. Needs a Comm Center.', 600, 'Light, 110 HP', 'Howitzer (long range, splash)',
     'about 1 tile long', 'a tracked self-propelled howitzer with an open gun deck, stabilizer legs and a very long barrel raised high'),
    ('U10', 'harv', 'Harvester', 'Vehicle', 'Collects crystal and brings it to a Refinery.', 1400, 'Heavy, 600 HP', 'None',
     'about 1.1 tiles long', 'a big tracked mining vehicle with a toothed scoop drum at the front, cab on one side and an open rear hopper heaped with glowing green crystal'),
    ('U11', 'mcv', 'MCV', 'Vehicle', 'Mobile Construction Vehicle. Deploys into a Construction Yard. Needs a Comm Center.', 3000, 'Heavy, 800 HP', 'None',
     'about 1.3 tiles long', 'a large six-wheeled heavy truck carrying a folded boxy construction module on its back, with a small folded crane arm on top'),
]

STYLE = ('Same art style as my Iron Frontier building images: detailed, hand-painted real-time-strategy game art like classic Command and Conquer, '
         'isometric 3/4 view from the front-right corner, looking down at about 35 degrees, soft sun from the upper left. '
         'Vanguard faction colors: olive drab (#8A8457) with bold gold-yellow trim stripes (#D9AE3A), weathered metal, small details. '
         'One {kind} only, centered, filling about 80 percent of the frame, on a plain pure white background, no ground, no shadow, no text.')


def footer(c, d):
    c.saveState(); c.setFont('Helvetica', 8); c.setFillColor(MUTED)
    c.drawString(0.6 * inch, 0.45 * inch, 'Iron Frontier · Units')
    c.drawRightString(letter[0] - 0.6 * inch, 0.45 * inch, f'Page {d.page}')
    c.restoreState()


def box(text):
    t = Table([[Paragraph(text, st['prompt'])]], colWidths=[7.3 * inch])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), BOX), ('BOX', (0, 0), (-1, -1), 0.6, LINE),
                           ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    return t


def render(key, w):
    return Image(os.path.join(IMG, key + '.png'), width=w, height=w * 0.75)


story = [Paragraph('Iron Frontier: Units', st['title']),
         Paragraph(f'All {len(UNITS)} units in the game, with their job, stats, current look, and prompts to paste into ChatGPT. '
                   'The prompts ask for the same style as your Vanguard Batch 1 buildings so everything matches.', st['sub']),
         Paragraph('Match this style', st['h2']),
         Image(os.path.join(HERE, 'style-reference.png'), width=7.3 * inch, height=7.3 * inch / 4),
         Paragraph('Your Batch 1 buildings, already in the game. Attach this picture (or one of your building images) in ChatGPT with each prompt.', st['note']),
         Paragraph('What to make for each unit', st['h2']),
         Paragraph('<b>1. Main image</b> (required): the unit facing the front-right, like the buildings. White background, square. '
                   'Name it by ID, for example <b>U07-A.png</b>. This becomes the sidebar build icon right away.', st['body']),
         Paragraph('<b>2. Direction sheet</b> (optional, for the battlefield): units turn as they drive, so one picture cannot face every way. '
                   'A sheet of the same unit in 8 directions lets it turn on the map. Name it <b>U07-A-dirs.png</b>. '
                   'Without a sheet the unit keeps its 3D model on the battlefield and uses your picture in the sidebar.', st['body']),
         Paragraph('<b>3. Red Dominion</b> (later): the same prompts with "gunmetal grey (#58595D) with red trim (#B3261E)" in place of the Vanguard colors. Name these <b>U07-B.png</b>.', st['body']),
         Paragraph('All units', st['h2'])]

rows = [[Paragraph(h, st['ch']) for h in ('ID', 'Now in game', 'Unit', 'Job', 'Cost', 'Armor', 'Weapon')]]
for uid, key, name, kind, role, cost, armor, weapon, size, look in UNITS:
    rows.append([Paragraph(uid, st['cb']), render(key, 0.85 * inch), Paragraph(f'{name}<br/><font color="#5E6258">{kind}</font>', st['cb']),
                 Paragraph(role, st['c']), Paragraph(f'${cost:,}', st['c']), Paragraph(armor, st['c']), Paragraph(weapon, st['c'])])
t = Table(rows, colWidths=[0.42 * inch, 0.95 * inch, 1.15 * inch, 2.35 * inch, 0.55 * inch, 0.95 * inch, 0.93 * inch], repeatRows=1)
t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BACKGROUND', (0, 0), (-1, 0), HEAD), ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE),
                       ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2), ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4)]))
story.append(t)

for uid, key, name, kind, role, cost, armor, weapon, size, look in UNITS:
    noun = 'soldier' if kind == 'Infantry' else 'vehicle'
    head = Table([[render(key, 1.9 * inch), render(key + '_e', 1.9 * inch),
                   [Paragraph(f'{uid} · {name}', st['h1']), Paragraph(f'{kind} · ${cost:,}', st['note']), Paragraph(role, st['body']),
                    Paragraph(f'<b>Armor:</b> {armor}<br/><b>Weapon:</b> {weapon}<br/><b>Size on the map:</b> {size}', st['body'])]]],
                 colWidths=[2.0 * inch, 2.0 * inch, 3.3 * inch])
    head.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    main = f'Make a game unit image: <b>{name}</b>, {look}. ' + STYLE.format(kind=noun) + ' Square image, 1024 x 1024.'
    dirs = (f'Using the {name} you just made, make a direction sheet: the exact same {noun} drawn 8 times in a 4 x 2 grid, same size and same camera height in every cell, '
            'turned to face: south (toward the viewer), south-west, west, north-west, north (away from the viewer), north-east, east, south-east, in that order, '
            'left to right then top to bottom. Plain pure white background, even spacing, no labels, no grid lines. Wide image, 2048 x 1024.')
    story += [PageBreak(), head,
              Paragraph(f'Note: the left render shows the Vanguard model in the game now, the right one the Red Dominion model. Copy the idea, not these shapes.', st['note']),
              Paragraph('Prompt 1: main image', st['h2']), box(main),
              Paragraph(f'Save as <b>{uid}-A.png</b>.', st['note']),
              Paragraph('Prompt 2: direction sheet (optional)', st['h2']), box(dirs),
              Paragraph(f'Save as <b>{uid}-A-dirs.png</b>.', st['note'])]
    if kind == 'Infantry':
        story.append(Paragraph('Soldiers are tiny on the map, so keep the shape bold and simple: clear silhouette, bright gold helmet stripe, chunky gear.', st['note']))

doc = BaseDocTemplate(OUT, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.7 * inch,
                      title='Iron Frontier: Units', author='Boise Mold Removal')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)], onPage=footer)])
doc.build(story)
print('wrote', OUT)
