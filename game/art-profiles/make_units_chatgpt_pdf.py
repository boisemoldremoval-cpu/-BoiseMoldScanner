"""Iron Frontier units, written for ChatGPT: upload this PDF and it makes all 11 unit images in the Batch 1 building style."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image, Table, TableStyle, KeepTogether

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make_units_pdf.py')).read()
ns = {'__file__': os.path.join(HERE, 'make_units_pdf.py')}
exec(src[:src.index('def footer')], ns)   # reuse UNITS, STYLE and the colors from the units sheet
UNITS, STYLE, INK, MUTED, GOLD, LINE, BOX = (ns[k] for k in ('UNITS', 'STYLE', 'INK', 'MUTED', 'GOLD', 'LINE', 'BOX'))
OUT = os.path.join(HERE, 'Iron-Frontier-Units-for-ChatGPT.pdf')

st = {
    'title': ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=INK, spaceAfter=6),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=GOLD, spaceBefore=10, spaceAfter=4),
    'body': ParagraphStyle('b', fontName='Helvetica', fontSize=10.5, leading=15, textColor=INK, spaceAfter=5),
    'li': ParagraphStyle('li', fontName='Helvetica', fontSize=10.5, leading=15, textColor=INK, leftIndent=14, bulletIndent=2, spaceAfter=2),
    'note': ParagraphStyle('n', fontName='Helvetica', fontSize=9, leading=12, textColor=MUTED, spaceAfter=4),
    'uh': ParagraphStyle('uh', fontName='Helvetica-Bold', fontSize=11.5, leading=14, textColor=INK, spaceAfter=3),
    'prompt': ParagraphStyle('p', fontName='Helvetica', fontSize=10, leading=14, textColor=INK),
}


def box(flow):
    t = Table([[flow]], colWidths=[7.3 * inch])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), BOX), ('BOX', (0, 0), (-1, -1), 0.6, LINE),
                           ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 9)]))
    return t


def footer(c, d):
    c.saveState(); c.setFont('Helvetica', 8); c.setFillColor(MUTED)
    c.drawString(0.6 * inch, 0.45 * inch, 'Iron Frontier · Unit images for ChatGPT')
    c.drawRightString(letter[0] - 0.6 * inch, 0.45 * inch, f'Page {d.page}')
    c.restoreState()


story = [Paragraph('Iron Frontier: Unit Images for ChatGPT', st['title']),
         Paragraph('<b>How to use:</b> upload this PDF to ChatGPT and type <b>"Follow the instructions in this PDF."</b> '
                   'When an image is done, type <b>"next"</b>. Save each image with the file name shown.', st['note']),
         Paragraph('Instructions for ChatGPT', st['h2']),
         box(Paragraph(
             'You are making <b>unit</b> art (soldiers and vehicles) for my real-time strategy game, Iron Frontier. '
             'The buildings are already finished, so <b>do not draw any buildings</b>. There are 11 units listed below. '
             'Make <b>one image at a time, in order, starting with U01</b>. After each image, tell me its file name, then wait until I type '
             '<b>"next"</b> before making the following one. Do not put more than one unit in an image. '
             'Copy only the art style of the example picture below, not its subjects, and follow these rules:<br/><br/>'
             '&bull; Hand-painted real-time-strategy game art like classic Command and Conquer, detailed and weathered.<br/>'
             '&bull; Isometric 3/4 view from the front-right corner, looking down at about 35 degrees, sun from the upper left.<br/>'
             '&bull; Vanguard faction colors: olive drab (#8A8457) with bold gold-yellow trim stripes (#D9AE3A).<br/>'
             '&bull; One unit only, centered, filling about 80 percent of the frame.<br/>'
             '&bull; Plain pure white background. No ground, no shadow, no text, no border.<br/>'
             '&bull; Square image, 1024 x 1024.', st['prompt'])),
         Spacer(1, 8),
         Paragraph('Style example only: do not draw these buildings', st['h2']),
         Image(os.path.join(HERE, 'style-reference.png'), width=7.3 * inch, height=7.3 * inch / 4),
         Paragraph('These are my finished buildings. Use them only for the painting style, colors and camera angle, '
                   'so the units look like they belong next to them.', st['note']),
         Paragraph('The 11 units to draw', st['h2']),
         Paragraph('The small picture beside each prompt is the plain placeholder model in the game now. It shows what the unit is; '
                   'make the new image far more detailed, in the style above.', st['note'])]

for i, (uid, key, name, kind, role, cost, armor, weapon, size, look) in enumerate(UNITS):
    noun = 'soldier' if kind == 'Infantry' else 'vehicle'
    extra = ' Keep the shape bold and simple because soldiers are tiny on the map: clear silhouette, bright gold helmet stripe, chunky gear.' if kind == 'Infantry' else ''
    prompt = f'<b>{name}</b>: {look}.{extra} ' + STYLE.format(kind=noun) + ' Square image, 1024 x 1024.'
    pic = Image(os.path.join(HERE, 'reference-renders', key + '.png'), width=1.25 * inch, height=1.25 * inch * 0.75)
    row = Table([[pic, Paragraph(prompt, st['prompt'])]], colWidths=[1.4 * inch, 5.9 * inch])
    row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BACKGROUND', (0, 0), (-1, -1), BOX), ('BOX', (0, 0), (-1, -1), 0.6, LINE),
                             ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    story.append(KeepTogether([Paragraph(f'{i + 1}. {uid} · {name} ({kind.lower()}) &nbsp;&nbsp;<font color="#5E6258" size="9">file name: <b>{uid}-A.png</b></font>', st['uh']),
                               row, Spacer(1, 8)]))

story += [Paragraph('When all 11 are done', st['h2']),
          Paragraph('Send the 11 images back to Claude, either one by one or together in a PDF, so they can go into the game. '
                    'Later, the same prompts with "gunmetal grey (#58595D) with red trim (#B3261E)" make the enemy Red Dominion versions, named U01-B.png and so on.', st['body'])]

doc = BaseDocTemplate(OUT, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.7 * inch,
                      title='Iron Frontier: Unit Images for ChatGPT', author='Boise Mold Removal')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)], onPage=footer)])
doc.build(story)
print('wrote', OUT)
