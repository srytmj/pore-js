import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { loadPdf } from './parse.js';

async function makePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const titles = ['Chapter One', 'Chapter Two', 'Chapter Three'];
  titles.forEach((t, i) => {
    const page = pdf.addPage([400, 600]);
    page.drawText(`${t} — page ${i + 1} consequat lorem`, { x: 40, y: 540, size: 16, font });
  });
  return pdf.save();
}

describe('loadPdf', () => {
  it('reports the page count and page size', async () => {
    const doc = await loadPdf(await makePdf());
    expect(doc.pageCount).toBe(3);
    const size = await doc.pageSize(1);
    expect(Math.round(size.width)).toBe(400);
    expect(Math.round(size.height)).toBe(600);
    await doc.destroy();
  });

  it('extracts text per page', async () => {
    const doc = await loadPdf(await makePdf());
    const t1 = await doc.textContent(1);
    expect(t1).toContain('Chapter One');
    expect(t1).toContain('consequat');
    expect(await doc.textContent(2)).toContain('Chapter Two');
    await doc.destroy();
  });

  it('returns an empty outline when the PDF has no bookmarks', async () => {
    const doc = await loadPdf(await makePdf());
    expect(doc.outline).toEqual([]);
    await doc.destroy();
  });
});
