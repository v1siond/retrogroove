// Client-side ticket PDF generation.
//
// Replaces the old server `GET /tickets/:token/pdf` endpoint (ChromicPDF +
// headless Chrome). Everything the ticket needs is already in the UI, so we
// build a branded PDF in the browser with pdf-lib and trigger a download.
//
// QR fidelity: the backend renders `qr_svg` and that exact image is what the
// door scans (it encodes the staff check-in URL with the server's frontend_url,
// which the client never sees). So we DO NOT regenerate the QR — we rasterize
// the existing `qr_svg` to a PNG and embed it, keeping the scanned value
// byte-identical to what the buyer sees on screen.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Ticket } from './types';

// RetroGroove palette (mirrors app/globals.css tokens).
const INK = rgb(0.03, 0.01, 0.05); // #08020e — near-black background
const PINK = rgb(1, 0.078, 0.576); // #ff1493
const GOLD = rgb(1, 0.843, 0); // #ffd700
const CYAN = rgb(0, 0.898, 1); // #00e5ff
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.72, 0.72, 0.78);
const FAINT = rgb(0.5, 0.5, 0.56);
const CARD = rgb(0.09, 0.06, 0.13);

// Ticket-sized page: a tall ticket stub, ~95mm x 200mm in points (1pt = 1/72in).
const PAGE_W = 380;
const PAGE_H = 620;
const MARGIN = 28;

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// Turn the backend qr_svg string into a PNG data URL by drawing it on a canvas.
// Returns null when there's no QR or the browser can't rasterize it.
async function svgToPngBytes(svg: string, size = 600): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // White background so a transparent/edge-cropped QR still scans cleanly.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false; // keep QR modules crisp
    ctx.drawImage(img, 0, 0, size, size);
    return await canvasToPngBytes(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('svg image load failed'));
    img.src = url;
  });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('canvas toBlob failed'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

// Draw a left-aligned line of text, returning the new y cursor.
function line(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  color = WHITE,
  letterSpacing = 0,
): number {
  if (letterSpacing) {
    let cursorX = x;
    for (const ch of text) {
      page.drawText(ch, { x: cursorX, y, size: fontSize, font, color });
      cursorX += font.widthOfTextAtSize(ch, fontSize) + letterSpacing;
    }
  } else {
    page.drawText(text, { x, y, size: fontSize, font, color });
  }
  return y - fontSize;
}

// Word-wrap `text` to `maxWidth`, drawing each line; returns the new y cursor.
function wrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  lineGap: number,
  color = WHITE,
): number {
  const words = text.split(/\s+/);
  let cursor = '';
  let cy = y;
  for (const w of words) {
    const trial = cursor ? `${cursor} ${w}` : w;
    if (font.widthOfTextAtSize(trial, fontSize) > maxWidth && cursor) {
      page.drawText(cursor, { x, y: cy, size: fontSize, font, color });
      cy -= fontSize + lineGap;
      cursor = w;
    } else {
      cursor = trial;
    }
  }
  if (cursor) {
    page.drawText(cursor, { x, y: cy, size: fontSize, font, color });
    cy -= fontSize + lineGap;
  }
  return cy;
}

interface TicketPdfData {
  eventName: string;
  venue?: string | null;
  date?: string | null;
  sectionName?: string | null;
  seatLabel?: string | null;
  buyerName?: string | null;
  code?: string | null;
  token?: string | null;
  qrPng?: Uint8Array | null;
}

async function drawTicketPage(doc: PDFDocument, t: TicketPdfData): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  // Background.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: INK });

  // Header band.
  const headerH = 70;
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: CARD });
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: 3, color: PINK });
  line(page, 'RETROGROOVE', MARGIN, PAGE_H - 34, bold, 20, CYAN, 1.5);
  line(page, 'ENTRADA OFICIAL · NO TRANSFERIBLE', MARGIN, PAGE_H - 52, reg, 7.5, FAINT, 1.2);

  let y = PAGE_H - headerH - 34;

  // Event name.
  y = wrapped(page, t.eventName || 'RetroGroove', MARGIN, y, bold, 22, PAGE_W - MARGIN * 2, 4, WHITE);
  y -= 8;

  // Date + venue.
  const dateStr = formatDate(t.date);
  if (dateStr) y = wrapped(page, dateStr, MARGIN, y, reg, 10, PAGE_W - MARGIN * 2, 3, CYAN) - 4;
  if (t.venue) y = wrapped(page, t.venue, MARGIN, y, reg, 10, PAGE_W - MARGIN * 2, 3, MUTED) - 6;

  // Section / seat block.
  if (t.sectionName) {
    y = line(page, 'SECCIÓN', MARGIN, y, reg, 7.5, FAINT, 1.2) - 2;
    y = line(page, t.sectionName, MARGIN, y, bold, 13, GOLD) - 8;
  }
  if (t.seatLabel) {
    y = line(page, 'UBICACIÓN', MARGIN, y, reg, 7.5, FAINT, 1.2) - 2;
    y = wrapped(page, t.seatLabel, MARGIN, y, bold, 12, PAGE_W - MARGIN * 2, 3, WHITE) - 6;
  }
  if (t.buyerName) {
    y = line(page, 'A NOMBRE DE', MARGIN, y, reg, 7.5, FAINT, 1.2) - 2;
    line(page, t.buyerName, MARGIN, y, bold, 12, WHITE);
  }

  // Perforation divider.
  const perfY = 286;
  for (let px = MARGIN; px < PAGE_W - MARGIN; px += 10) {
    page.drawRectangle({ x: px, y: perfY, width: 5, height: 1, color: rgb(0.3, 0.3, 0.36) });
  }

  // QR block — centered white card.
  const qrCard = 200;
  const qrCardX = (PAGE_W - qrCard) / 2;
  const qrCardY = perfY - qrCard - 26;
  page.drawRectangle({
    x: qrCardX, y: qrCardY, width: qrCard, height: qrCard,
    color: WHITE, borderColor: rgb(0.2, 0.2, 0.24), borderWidth: 1,
  });
  if (t.qrPng) {
    try {
      const png = await doc.embedPng(t.qrPng);
      const pad = 14;
      page.drawImage(png, {
        x: qrCardX + pad, y: qrCardY + pad,
        width: qrCard - pad * 2, height: qrCard - pad * 2,
      });
    } catch {
      // QR embed failed — leave the white card, code below still scannable manually.
    }
  } else {
    line(page, 'QR no disponible', qrCardX + 44, qrCardY + qrCard / 2, reg, 9, rgb(0.4, 0.4, 0.4));
  }

  // Entry code under the QR.
  let cy = qrCardY - 24;
  cy = line(page, 'CÓDIGO DE ENTRADA', PAGE_W / 2 - 56, cy, reg, 7.5, FAINT, 1.2) - 4;
  const codeText = t.token || t.code || '—';
  const codeW = bold.widthOfTextAtSize(codeText, 16) + (codeText.length - 1) * 3;
  line(page, codeText, (PAGE_W - codeW) / 2, cy, bold, 16, GOLD, 3);

  // Footer note.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 3, color: PINK });
  line(page, 'Presenta este QR en la puerta · Válida para una persona',
    MARGIN, 22, reg, 7.5, FAINT);
}

// Build the PDF for one ticket (rasterizing its QR) and return the bytes.
export async function buildTicketPdf(ticket: Ticket, opts: {
  eventName: string;
  venue?: string | null;
  date?: string | null;
  buyerName?: string | null;
} ): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`RetroGroove — ${opts.eventName}`);
  doc.setProducer('RetroGroove');

  const qrPng = ticket.qr_svg ? await svgToPngBytes(ticket.qr_svg) : null;

  await drawTicketPage(doc, {
    eventName: opts.eventName,
    venue: opts.venue,
    date: opts.date ?? ticket.event_starts_at,
    sectionName: ticket.section_name,
    seatLabel: ticket.seat_label,
    buyerName: opts.buyerName,
    code: ticket.code,
    token: ticket.public_token,
    qrPng,
  });

  return doc.save();
}

// Build a multi-page PDF — one ticket per page — for a whole order.
export async function buildOrderPdf(tickets: Ticket[], opts: {
  eventName: string;
  venue?: string | null;
  date?: string | null;
  buyerName?: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`RetroGroove — ${opts.eventName}`);
  doc.setProducer('RetroGroove');

  for (const ticket of tickets) {
    const qrPng = ticket.qr_svg ? await svgToPngBytes(ticket.qr_svg) : null;
    await drawTicketPage(doc, {
      eventName: opts.eventName,
      venue: opts.venue,
      date: opts.date ?? ticket.event_starts_at,
      sectionName: ticket.section_name,
      seatLabel: ticket.seat_label,
      buyerName: opts.buyerName,
      code: ticket.code,
      token: ticket.public_token,
      qrPng,
    });
  }

  return doc.save();
}

// Trigger a browser download of the given PDF bytes.
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has a chance to register.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Slugify a label into a safe filename fragment.
export function ticketFilename(eventName: string, token?: string | null): string {
  const slug = (eventName || 'entrada')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'entrada';
  return token ? `retrogroove-${slug}-${token}.pdf` : `retrogroove-${slug}.pdf`;
}
