"""Generate original, deterministic PDFs; no copyrighted source documents."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
root = Path(__file__).resolve().parents[1] / 'tests/browser/fixtures'
root.mkdir(parents=True, exist_ok=True)
for name, pages in [('reading-loop', 12), ('other-paper', 2)]:
    c = canvas.Canvas(str(root / (name + '.pdf')), pagesize=A4, invariant=1)
    c.setTitle('PaperPeek ' + name + ' synthetic fixture')
    for page in range(1, pages+1):
        size = landscape(A4) if page == 4 else A4
        c.setPageSize(size)
        if page == 5: c.setPageRotation(90)
        c.bookmarkPage('page'+str(page)); c.addOutlineEntry('Physical page '+str(page), 'page'+str(page), level=0)
        c.setFont('Helvetica', 18); c.drawString(42, size[1]-50, f'{name}: physical page {page}')
        c.setFont('Helvetica', 12)
        c.drawString(42, size[1]-80, f'Unique evidence on physical page {page}: temperature may rise by 2.5 K.')
        c.drawString(42, size[1]-105, 'The treatment improved accuracy under the stated assumptions.')
        c.drawString(42, size[1]-130, 'Repeated phrase for conservative anchor matching.')
        c.drawString(42, size[1]-155, 'Repeated phrase for conservative anchor matching.')
        if page == 3:
            for row in range(14):
                c.drawString(42, size[1]-190-row*18, f'Left column observation {row+1}.')
                c.drawString(320, size[1]-190-row*18, f'Right column method {row+1}.')
        c.linkRect('', 'page1', (42,40,200,65), relative=0)
        c.drawString(42,45,'Internal link to first page')
        c.showPage()
    c.save()
