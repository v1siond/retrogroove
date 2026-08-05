// Printable load list for one event — the paper version of the venue checklist, for when
// ticking boxes with a pen beats holding a phone. Same pdf-lib pipeline as the tickets.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AdminEventEquipment } from './admin';

export { downloadPdf } from './pdf';

const PAGE_W = 595; // A4 portrait, points
const PAGE_H = 842;
const MARGIN = 48;

const INK = rgb(0.05, 0.05, 0.07);
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.65, 0.65, 0.7);
const GOLD = rgb(0.94, 0.76, 0.35);
const CYAN = rgb(0.35, 0.85, 0.9);

function groupByCategory(rows: AdminEventEquipment[]): [string, AdminEventEquipment[]][] {
  const groups = new Map<string, AdminEventEquipment[]>();
  for (const row of rows) {
    const key = row.category || 'Sin categoría';
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export async function buildEquipmentPdf(
  rows: AdminEventEquipment[],
  opts: { eventName: string; date?: string | null },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Equipo — ${opts.eventName}`);
  doc.setProducer('RetroGroove');

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: INK });

  let y = PAGE_H - MARGIN;

  page.drawText('LISTA DE EQUIPO', { x: MARGIN, y, size: 20, font: bold, color: CYAN });
  y -= 22;
  page.drawText(opts.eventName, { x: MARGIN, y, size: 13, font: bold, color: WHITE });
  y -= 16;
  page.drawText('CARGADO  □        DEVUELTO  □', { x: MARGIN, y, size: 8, font: reg, color: MUTED });
  y -= 22;

  // Start a fresh page when the current one runs out — long lists are the normal case.
  const ensureRoom = (needed: number) => {
    if (y - needed > MARGIN) return;
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: INK });
    y = PAGE_H - MARGIN;
  };

  for (const [category, group] of groupByCategory(rows)) {
    ensureRoom(40);
    page.drawText(category.toUpperCase(), { x: MARGIN, y, size: 9, font: bold, color: GOLD });
    y -= 15;

    for (const row of group) {
      ensureRoom(22);
      // Two tick boxes per line: into the van, back out of it.
      page.drawRectangle({ x: MARGIN, y: y - 2, width: 10, height: 10, borderColor: MUTED, borderWidth: 1 });
      page.drawRectangle({ x: MARGIN + 18, y: y - 2, width: 10, height: 10, borderColor: MUTED, borderWidth: 1 });

      const qty = `${row.quantity}×`;
      page.drawText(qty, { x: MARGIN + 38, y, size: 10, font: bold, color: GOLD });
      page.drawText(row.name, { x: MARGIN + 62, y, size: 10, font: reg, color: WHITE });

      if (row.notes) {
        y -= 11;
        page.drawText(row.notes.slice(0, 90), { x: MARGIN + 62, y, size: 7.5, font: reg, color: MUTED });
      }
      y -= 18;
    }
    y -= 6;
  }

  const total = rows.reduce((sum, r) => sum + r.quantity, 0);
  ensureRoom(30);
  y -= 6;
  page.drawText(`${rows.length} ítems · ${total} piezas en total`, {
    x: MARGIN, y, size: 9, font: bold, color: CYAN,
  });

  return doc.save();
}
