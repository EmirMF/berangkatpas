"""Build the submission README.pdf from README.md (requires reportlab)."""
from pathlib import Path
import html
import re
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'README.md').read_text(encoding='utf-8')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleBP', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=19,
                          leading=23, textColor=colors.HexColor('#163047'), spaceAfter=9))
styles.add(ParagraphStyle(name='H2BP', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11,
                          leading=13, textColor=colors.HexColor('#17617A'), spaceBefore=9, spaceAfter=4))
styles.add(ParagraphStyle(name='BodyBP', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.5,
                          leading=11.2, spaceAfter=4))
styles.add(ParagraphStyle(name='CodeBP', fontName='Courier', fontSize=6.5, leading=9,
                          leftIndent=8, rightIndent=8, backColor=colors.HexColor('#F1F5F7'),
                          borderPadding=6, spaceAfter=7))

def inline(text):
    text = html.escape(text)
    text = re.sub(r'\[([^]]+)\]\(([^)]+)\)', r'\1 (\2)', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`([^`]+)`', r'<font name="Courier">\1</font>', text)
    text = text.replace('→', '->').replace('≥', '&gt;=').replace('–', '-').replace('—', '-')
    return text

story = []
code = []
in_code = False
for raw in source.splitlines():
    line = raw.rstrip()
    if line.startswith('```'):
        if in_code:
            story.append(Preformatted('\n'.join(code), styles['CodeBP'], maxLineLength=95))
            code = []
        in_code = not in_code
        continue
    if in_code:
        code.append(line)
    elif not line:
        continue
    elif line.startswith('# '):
        story.append(Paragraph(inline(line[2:]), styles['TitleBP']))
        story.append(Spacer(1, 3 * mm))
    elif line.startswith('## '):
        story.append(Paragraph(inline(line[3:]), styles['H2BP']))
    else:
        story.append(KeepTogether([Paragraph(inline(line), styles['BodyBP'])]))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#B4C4CD'))
    canvas.line(18 * mm, 17 * mm, 192 * mm, 17 * mm)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#526A78'))
    canvas.drawString(18 * mm, 12 * mm, 'BerangkatPas - dokumentasi backend')
    canvas.drawRightString(192 * mm, 12 * mm, str(doc.page))
    canvas.restoreState()

doc = SimpleDocTemplate(str(ROOT / 'README.pdf'), pagesize=A4, leftMargin=17*mm, rightMargin=17*mm,
                        topMargin=16*mm, bottomMargin=20*mm, title='BerangkatPas Backend README',
                        author='Kelompok BerangkatPas')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(ROOT / 'README.pdf')
