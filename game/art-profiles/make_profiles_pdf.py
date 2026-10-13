from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
                                Image, PageBreak, KeepTogether)

OUT = '/home/user/-BoiseMoldScanner/game/art-profiles/Iron-Frontier-Art-Profiles.pdf'
IMG = '/home/user/-BoiseMoldScanner/game/art-profiles/reference-renders/'

INK = colors.HexColor('#1C1E1B')
MUTED = colors.HexColor('#5E6258')
GOLD = colors.HexColor('#B8891C')
LINE = colors.HexColor('#CFD1C8')
PANEL = colors.HexColor('#F2F3EE')
PROMPT_BG = colors.HexColor('#F7F4E8')

ss = {
    'title': ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=34, leading=38, textColor=INK, spaceAfter=6),
    'sub': ParagraphStyle('sub', fontName='Helvetica', fontSize=13, leading=18, textColor=MUTED, spaceAfter=18),
    'eyebrow': ParagraphStyle('eyebrow', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=GOLD, spaceAfter=4),
    'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=INK, spaceAfter=8),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=INK, spaceBefore=10, spaceAfter=4),
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=10, leading=14.5, textColor=INK, spaceAfter=6),
    'small': ParagraphStyle('small', fontName='Helvetica', fontSize=8.5, leading=12, textColor=MUTED),
    'cell': ParagraphStyle('cell', fontName='Helvetica', fontSize=9, leading=12.2, textColor=INK),
    'cellb': ParagraphStyle('cellb', fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=MUTED),
    'prompt': ParagraphStyle('prompt', fontName='Courier', fontSize=7.6, leading=9.8, textColor=INK),
    'cap': ParagraphStyle('cap', fontName='Helvetica', fontSize=8, leading=10, textColor=MUTED, alignment=1),
    'bullet': ParagraphStyle('bullet', fontName='Helvetica', fontSize=10, leading=14.5, textColor=INK, leftIndent=14, bulletIndent=2, spaceAfter=3),
}

STYLE = ('Highly detailed pre-rendered 3D game asset for a classic-style 1990s real-time strategy game, '
         'remastered in high resolution. Realistic materials: weathered painted steel, cast concrete, canvas, rubber, burlap. '
         'Crisp silhouette, subtle wear, dust and dirt, muted military palette.')
CAMERA = ('Camera: classic overhead strategy-game view. The camera is directly in front of the object (not turned toward a corner) and looks down at about 58 degrees, so the front face points straight at the bottom of the image, the roof is clearly visible, and the base reads as a level rectangle. Whole object in frame, centered, with a small margin. Lighting: warm sun from the upper left, soft shadow cast toward the lower right.')
OUTPUT = 'Output: square 1024x1024 PNG with a fully transparent background. No text, numbers, logos, insignia or watermarks.'
VAN = 'Vanguard faction colors: olive-drab tan body (#8A8457), mustard-gold trim stripes (#D9AE3A), dark olive accents (#4F4B32).'
RED = 'Red Dominion faction colors: gunmetal grey body (#58595D), crimson trim stripes (#B3261E), near-black accents (#2C2D30).'

STRUCTURES = [
    ('S01', 'hq', 'Construction Yard', '3 x 3 tiles (about 30 m square)',
     'Builds every structure; the heart of the base. Deploys from the MCV.',
     'Concrete foundation slab with a lighter inset. A long prefabricated assembly hall with a flat metal roof and a faction-colored band. '
     'Wide roll-up bay door with horizontal ribs. A tall square corner tower topped by a slewing tower crane: long boom painted in the trim color, '
     'counterweight block, cable and hook. Small red warning beacon on the tower. Equipment crates beside the hall.'),
    ('S02', 'power', 'Power Plant', '2 x 2 tiles',
     'Provides power. Puts out less power when damaged.',
     'Compact generator hall on a concrete slab, flat roof with a trim band. Two tall tapered concrete smokestacks with dark caps and thin white steam. '
     'Glowing amber vent grilles on the side wall. A small transformer box with cable conduits.'),
    ('S03', 'refinery', 'Refinery', '3 x 2 tiles plus a 1-tile dock in front',
     'Processes crystal into credits and stores 1,000. Harvesters unload at its dock.',
     'Processing hall with a roof trim band and a loading door. Two tall cylindrical storage silos with domed tops, linked by a pipe. '
     'A glowing green crystal level gauge on the front wall. In front, a separate square concrete unloading pad with yellow hazard stripes where harvesters park.'),
    ('S04', 'silo', 'Crystal Silo', '2 x 1 tiles',
     'Stores 1,500 crystal.',
     'A pair of squat cylindrical tanks with domed tops on a concrete slab, a trim-colored band around each tank, a short connecting pipe, '
     'and a vertical glowing green fill gauge on the front of each tank.'),
    ('S05', 'barracks', 'Barracks', '2 x 2 tiles',
     'Trains infantry. Infantry walk out through the front flap.',
     'An olive-green canvas half-cylinder (quonset) tent on a concrete slab, darker canvas end walls, a dark entry flap at the front, '
     'a low curved row of burlap sandbags in front, and a thin flagpole with a small faction-colored flag.'),
    ('S06', 'factory', 'War Factory', '3 x 3 tiles',
     'Builds vehicles. Vehicles roll out through the front door.',
     'Large vehicle hangar with concrete walls and a flat roof with a trim band. A big ribbed steel roll-up door at the front (show it closed). '
     'A gantry crane beam on two posts across the roof, an exhaust chimney at the rear corner, and a rooftop machinery box.'),
    ('S07', 'radar', 'Comm Center', '2 x 2 tiles',
     'Turns on the radar map and unlocks advanced units and defenses.',
     'A small command building with a flat roof and trim band, and next to it a tall steel mast carrying a large white parabolic radar dish tilted upward with a feed horn.'),
    ('S08', 'repair', 'Repair Pad', '2 x 2 tiles (vehicles drive onto it)',
     'Repairs vehicles parked on it, for credits.',
     'A flat dark concrete service pad with a large painted yellow cross, oil stains, four slim light posts at the corners with amber lamps, '
     'and a trim-colored overhead bar along the back edge.'),
    ('S09', 'tower', 'Guard Tower', '1 x 1 tile',
     'Machine-gun defense, strong against infantry.',
     'A ring of stacked burlap sandbags around a short round concrete pillbox, topped by a rotating domed turret in the faction color with a single machine-gun barrel.'),
    ('S10', 'atower', 'Advanced Tower', '1 x 1 tile',
     'Missile defense, strong against vehicles. Needs power.',
     'A tall square concrete tower with a faction-colored band near the top, carrying a rotating turret fitted with two box-shaped missile launch pods.'),
    ('S11', 'wall', 'Sandbags', '1 x 1 tile, placed in rows',
     'Blocks movement. Laid in lines to make walls.',
     'A chest-high wall segment of stacked tan burlap sandbags with no foundation. It must line up seamlessly with copies placed to its left and right.'),
]
UNITS = [
    ('U01', 'rifle', 'Rifleman', 'Infantry, about 1.8 m tall', 'Cheap infantry, good against infantry.',
     'A soldier in faction-colored fatigues with a dark webbing belt and a combat helmet in the dark faction color, holding an assault rifle at the ready. Full figure, standing.'),
    ('U02', 'gren', 'Grenadier', 'Infantry', 'Lobs grenades with splash damage.',
     'A soldier in faction-colored fatigues with a grenade satchel on the hip, a short carbine slung, round helmet, one arm raised mid-throw holding a grenade.'),
    ('U03', 'rocket', 'Rocket Soldier', 'Infantry', 'Strong against vehicles and towers.',
     'A soldier in faction-colored fatigues aiming a long olive shoulder-fired rocket launcher tube, standing braced.'),
    ('U04', 'eng', 'Engineer', 'Infantry', 'Captures enemy buildings. Unarmed.',
     'A technician in a bright orange high-visibility work vest over fatigues, a yellow hard hat, carrying a red metal toolbox. No weapon.'),
    ('U05', 'buggy', 'Recon Buggy', 'Light vehicle, about 4 m long', 'Fast scout and harvester raider.',
     'A fast open-frame four-wheel dune buggy with knobby tires, front body panels in the faction color with a trim stripe, a steel roll bar, and a rear pintle-mounted machine gun.'),
    ('U06', 'ltank', 'Light Tank', 'Tracked, about 6 m long', 'Quick, cheap tank.',
     'A small agile tank with two tracks and road wheels, a low hull with a sloped front plate, a compact turret with a short cannon, and a trim stripe across the rear deck.'),
    ('U07', 'tank', 'Medium Tank', 'Tracked, about 7 m long', 'Main battle tank.',
     'A main battle tank with sloped front armor, wide tracks with road wheels, a turret with a commander hatch, a long cannon with a muzzle brake, and a trim stripe on the turret and rear deck.'),
    ('U08', 'htank', 'Heavy Tank', 'Tracked, about 9 m long', 'Twin cannons, heavy armor, slowly repairs itself.',
     'A huge heavily armored tank with extra-wide tracks, a massive turret carrying two long cannons side by side, and a box-shaped missile pod on each side of the turret.'),
    ('U09', 'arty', 'Artillery', 'Tracked, about 7 m long', 'Long-range shells with splash; cannot hit targets up close.',
     'A tracked self-propelled howitzer: small armored hull, a rotating mount, and a very long barrel elevated about 35 degrees.'),
    ('U10', 'harv', 'Harvester', 'Tracked, about 9 m long', 'Collects crystal and hauls it to the Refinery.',
     'A large heavy-duty tracked mining vehicle with a big rotating cutting drum across the front, a cab with windows on one side, '
     'and an open hopper on the back heaped with glowing green crystal shards. Dirty and well used.'),
    ('U11', 'mcv', 'MCV (Mobile Construction Vehicle)', 'Six-wheeled, about 11 m long', 'Deploys into a Construction Yard.',
     'A six-wheeled heavy truck with a cab at the front and a large boxy construction module on the back, a folded crane arm lying on top, a small white dish, and a trim band around the module.'),
]
ENV = [
    ('E01', 'Ground terrain tile', 'Seamless texture for the battlefield floor.',
     'Seamless tileable top-down ground texture for a temperate RTS battlefield: patchy olive grass, worn brown dirt, small pebbles and fine soil detail. '
     'Viewed straight down, even lighting, no shadows of objects, no perspective. Output: 1024x1024 PNG that tiles seamlessly on all four edges.'),
    ('E02', 'Crystal field', 'The resource harvesters collect. Hurts infantry standing in it.',
     STYLE + ' Subject: clusters of glowing green crystalline spikes growing out of dark soil, in four different sizes from a single small sprout to a dense cluster, arranged in a row on one sheet. '
     + CAMERA + ' Output: 2048x512 PNG sprite sheet with a fully transparent background. No text.'),
    ('E03', 'Rocks', 'Impassable terrain.',
     STYLE + ' Subject: four variations of grey weathered boulder groups, from one rock to a cluster of three, arranged in a row. '
     + CAMERA + ' Output: 2048x512 PNG sprite sheet with a fully transparent background. No text.'),
    ('E04', 'Trees', 'Impassable terrain along the map.',
     STYLE + ' Subject: four variations of temperate deciduous trees with round leafy crowns in slightly different greens, arranged in a row. '
     + CAMERA + ' Output: 2048x512 PNG sprite sheet with a fully transparent background. No text.'),
    ('E05', 'Explosion', 'Plays when units and buildings are destroyed.',
     'Game VFX sprite sheet: an 8-frame explosion animation in a single row, from a bright white-yellow flash, to an orange fireball, to dark rolling smoke fading away. '
     'Viewed from about 55 degrees above. Output: 4096x512 PNG with a fully transparent background, each frame 512x512. No text.'),
    ('E06', 'Smoke puff', 'Used for chimneys, burning buildings and dust.',
     'Game VFX: a single soft grey smoke puff, round and billowy, semi-transparent edges, centered. Output: 512x512 PNG with a fully transparent background. No text.'),
    ('E07', 'Scorch mark', 'Left on the ground after explosions.',
     'Game decal: a dark burnt scorch mark on the ground seen from straight above, irregular soot splatter fading to transparent at the edges. Output: 512x512 PNG with a fully transparent background. No text.'),
    ('E08', 'Game logo', 'Title screen wordmark.',
     'Logo wordmark reading exactly "IRON FRONTIER" in bold condensed military stencil letters, "IRON" in off-white and "FRONTIER" in mustard gold (#D9AE3A), '
     'with subtle scratched metal texture and a thin dark outline. Output: 2048x768 PNG with a fully transparent background.'),
]


def prompt_for(name, desc, faction):
    return f'{STYLE} Subject: {name}. {desc} {faction} {CAMERA} {OUTPUT}'


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.75 * inch, 0.5 * inch, 'Iron Frontier · Art asset profiles')
    canvas.drawRightString(letter[0] - 0.75 * inch, 0.5 * inch, f'Page {doc.page}')
    canvas.setStrokeColor(LINE)
    canvas.line(0.75 * inch, 0.68 * inch, letter[0] - 0.75 * inch, 0.68 * inch)
    canvas.restoreState()


def kv_table(rows):
    data = [[Paragraph(k, ss['cellb']), Paragraph(v, ss['cell'])] for k, v in rows]
    t = Table(data, colWidths=[1.25 * inch, 5.75 * inch])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))
    return t


def prompt_box(label, text):
    t = Table([[Paragraph(f'<b>{label}</b>', ss['cellb'])], [Paragraph(text, ss['prompt'])]], colWidths=[7.0 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PROMPT_BG),
        ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#D8CFA8')),
        ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, 0), 6), ('BOTTOMPADDING', (0, -1), (-1, -1), 7),
    ]))
    return t


def images_row(key):
    w, h = 2.7 * inch, 2.7 * inch * 0.75
    row = [Image(IMG + key + '.png', width=w, height=h), Image(IMG + key + '_e.png', width=w, height=h)]
    caps = [Paragraph('Current in-game model · Vanguard (player)', ss['cap']), Paragraph('Current in-game model · Red Dominion (enemy)', ss['cap'])]
    t = Table([row, caps], colWidths=[3.5 * inch, 3.5 * inch])
    t.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    return t


def profile(pid, key, name, size, role, desc, kind):
    out = [Paragraph(f'{kind} · PROFILE {pid}', ss['eyebrow']), Paragraph(name, ss['h1']), images_row(key), Spacer(1, 4),
           kv_table([('Role in game', role), ('Footprint / size', size), ('Must include', desc)]), Spacer(1, 10),
           prompt_box(f'PROMPT {pid}-A · Vanguard version (copy this into ChatGPT)', prompt_for(name, desc, VAN)), Spacer(1, 6),
           prompt_box(f'PROMPT {pid}-B · Red Dominion version', prompt_for(name, desc, RED)), PageBreak()]
    return out


def swatches(title, items):
    cells = []
    for hexc, label in items:
        sw = Table([['']], colWidths=[0.55 * inch], rowHeights=[0.38 * inch])
        sw.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(hexc)), ('BOX', (0, 0), (-1, -1), 0.4, LINE)]))
        cells.append([sw, Paragraph(f'<b>{hexc}</b><br/>{label}', ss['small'])])
    t = Table([[Paragraph(f'<b>{title}</b>', ss['cell'])] + [''] * 5, sum(cells, [])], colWidths=[0.6 * inch, 1.73 * inch] * 3)
    t.setStyle(TableStyle([('SPAN', (0, 0), (-1, 0)), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, 0), 6)]))
    return t


story = []
# ---- cover ----
story += [Spacer(1, 1.2 * inch), Paragraph('ART ASSET PROFILES', ss['eyebrow']), Paragraph('Iron Frontier', ss['title']),
          Paragraph('Image profiles for every building, unit and effect in the game, with ready-to-paste prompts for generating high-quality artwork in ChatGPT.', ss['sub'])]
cover = Table([[Image(IMG + 'hq.png', width=2.3 * inch, height=1.725 * inch), Image(IMG + 'tank.png', width=2.3 * inch, height=1.725 * inch), Image(IMG + 'harv.png', width=2.3 * inch, height=1.725 * inch)]],
              colWidths=[2.35 * inch] * 3)
story += [cover, Spacer(1, 0.4 * inch)]
story.append(kv_table([
    ('Contents', 'How to use this with ChatGPT (page 2) · Style guide (page 3) · 11 structures (S01–S11) · 11 units (U01–U11) · 8 environment, effects and logo profiles (E01–E08) · Checklist'),
    ('Each profile has', 'The current in-game model in both faction colors (for shape only), what the asset does, its size, what it must include, and two prompts: one per faction.'),
    ('Reference files', 'The same renders are saved as separate PNG files in game/art-profiles/reference-renders/ in the repository, if you would rather attach them one at a time.'),
]))
story.append(PageBreak())

# ---- how to use ----
story += [Paragraph('GETTING STARTED', ss['eyebrow']), Paragraph('How to use this with ChatGPT', ss['h1']),
          Paragraph('ChatGPT makes one image per request, so work through the profiles one at a time. The renders in this PDF are the current, simple in-game models: '
                    'use them for shape and layout only, and let the prompt describe the finished look.', ss['body']),
          Paragraph('1. Start a new chat and attach this PDF', ss['h2']),
          Paragraph('Then paste this message:', ss['body']),
          prompt_box('FIRST MESSAGE',
                     'I am making a real-time strategy game called Iron Frontier. The attached PDF has an art profile for each game asset: an ID, a reference render of the current '
                     'low-detail model, details, and a prompt. When I give you a profile ID, generate that image by following its prompt exactly. Use the reference render only for '
                     'the overall shape and layout, not its simple style. Keep every image consistent with the Style Guide page: same camera angle, lighting and palette, and a '
                     'transparent background unless the profile says otherwise. Start with prompt S01-A.'),
          Paragraph('2. Ask for the next profile', ss['h2']),
          Paragraph('After each image, send the next ID, for example "Now do U07-A". For the enemy faction, ask for the -B prompt, or say "Same image, Red Dominion colors".', ss['body']),
          Paragraph('3. Keep the set consistent', ss['h2'])]
for b in ['If an image drifts in style, say "Match the camera angle, lighting and level of detail of image S01" and regenerate.',
          'If the background comes back white instead of transparent, ask "Make the background fully transparent and give me the PNG".',
          'Generate the Vanguard (-A) version of everything first, then the Red Dominion (-B) versions, so each faction is consistent.',
          'Save each file named by its profile ID, for example S01-A.png or U07-B.png. That makes them easy to drop back into the game.']:
    story.append(Paragraph(b, ss['bullet'], bulletText='•'))
story += [Paragraph('4. Bring them back', ss['h2']),
          Paragraph('Upload the finished PNGs here. They can go straight in as the sidebar build icons and the title logo. For the 3D battlefield models, the images work as '
                    'concept art: an image-to-3D tool can turn them into 3D model files (.glb) that can be loaded into the game.', ss['body']),
          PageBreak()]

# ---- style guide ----
story += [Paragraph('STYLE GUIDE', ss['eyebrow']), Paragraph('One look for every asset', ss['h1']),
          Paragraph('Every prompt already includes these rules. They are listed here so the whole set stays consistent.', ss['body']),
          kv_table([('Art style', STYLE), ('Camera & light', CAMERA), ('Output', OUTPUT),
                    ('Avoid', 'Real-world military markings, national flags, brand names, the names of existing games or franchises, text on the models, and cartoon or toy-like proportions.')]),
          Spacer(1, 14), swatches('Vanguard (player)', [('#8A8457', 'Body: olive-drab tan'), ('#D9AE3A', 'Trim: mustard gold'), ('#4F4B32', 'Accent: dark olive')]),
          Spacer(1, 10), swatches('Red Dominion (enemy)', [('#58595D', 'Body: gunmetal grey'), ('#B3261E', 'Trim: crimson'), ('#2C2D30', 'Accent: near black')]),
          Spacer(1, 10), swatches('Shared materials', [('#74756E', 'Concrete foundations'), ('#9C9A8A', 'Building walls'), ('#56E04A', 'Crystal glow (green)')]),
          Spacer(1, 14), Paragraph('In-game scale', ss['h2']),
          Paragraph('One map tile is roughly 10 m. Structures sit on a tile grid (their footprints are listed on each profile); infantry are tiny next to buildings, '
                    'and a Medium Tank is about two-thirds of one tile long. Keep that sense of scale when describing changes to ChatGPT.', ss['body']),
          PageBreak()]

for p in STRUCTURES:
    story += profile(*p, kind='STRUCTURE')
for p in UNITS:
    story += profile(*p, kind='UNIT')

# ---- environment ----
story += [Paragraph('ENVIRONMENT, EFFECTS & LOGO', ss['eyebrow']), Paragraph('Terrain, effects and title art', ss['h1']),
          Paragraph('These have no single in-game model to show. Each prompt is self-contained.', ss['body'])]
for pid, name, role, prompt in ENV:
    story.append(KeepTogether([Paragraph(f'{pid} · {name}', ss['h2']), Paragraph(role, ss['small']), Spacer(1, 4), prompt_box(f'PROMPT {pid}', prompt), Spacer(1, 6)]))
story.append(PageBreak())

# ---- checklist ----
story += [Paragraph('CHECKLIST', ss['eyebrow']), Paragraph('Track what you have generated', ss['h1'])]
rows = [[Paragraph('<b>ID</b>', ss['cellb']), Paragraph('<b>Asset</b>', ss['cellb']), Paragraph('<b>Vanguard (-A)</b>', ss['cellb']), Paragraph('<b>Red Dominion (-B)</b>', ss['cellb'])]]
for pid, _k, name, *_ in STRUCTURES + UNITS:
    rows.append([Paragraph(pid, ss['cell']), Paragraph(name, ss['cell']), Paragraph('[  ]', ss['cell']), Paragraph('[  ]', ss['cell'])])
for pid, name, *_ in ENV:
    rows.append([Paragraph(pid, ss['cell']), Paragraph(name, ss['cell']), Paragraph('[  ]', ss['cell']), Paragraph('n/a', ss['small'])])
t = Table(rows, colWidths=[0.7 * inch, 3.3 * inch, 1.5 * inch, 1.5 * inch], repeatRows=1)
t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE), ('BACKGROUND', (0, 0), (-1, 0), PANEL),
                       ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
story.append(t)

doc = BaseDocTemplate(OUT, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.7 * inch, bottomMargin=0.85 * inch,
                      title='Iron Frontier: Art Asset Profiles', author='Boise Mold Removal', subject='Image profiles and ChatGPT prompts for game art')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')], onPage=footer)])
doc.build(story)
print('wrote', OUT)
