import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { InvoiceSheet } from "@/lib/invoice-view";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const BLACK = rgb(0, 0, 0);

let fontBytes: Uint8Array | null = null;

async function loadFont(): Promise<Uint8Array> {
  if (fontBytes) return fontBytes;
  const file = path.join(process.cwd(), "src/lib/fonts/NotoSansGeorgian.ttf");
  fontBytes = new Uint8Array(await readFile(file));
  return fontBytes;
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  const pushLong = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      const trial = chunk + ch;
      if (chunk && font.widthOfTextAtSize(trial, size) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = trial;
      }
    }
    current = chunk;
  };
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) > maxWidth) pushLong(word);
    else current = word;
  }
  if (current) lines.push(current);
  return lines;
}

class Sheet {
  page: PDFPage;
  y: number;

  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
  ) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  gap(amount: number) {
    this.ensure(amount);
    this.y -= amount;
  }

  rule() {
    this.ensure(10);
    this.y -= 4;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 1,
      color: BLACK,
    });
    this.y -= 12;
  }

  paragraph(text: string, size: number, x = MARGIN, width = PAGE_W - MARGIN * 2) {
    const lines = wrap(this.font, text, size, width);
    const lineH = size * 1.4;
    this.ensure(lines.length * lineH);
    for (const line of lines) {
      this.page.drawText(line, { x, y: this.y - size, size, font: this.font, color: BLACK });
      this.y -= lineH;
    }
  }

  pair(label: string, value: string, size = 11) {
    const labelW = 168;
    const valueX = MARGIN + labelW;
    const valueW = PAGE_W - MARGIN - valueX;
    const lineH = size * 1.45;
    const labels = wrap(this.font, label, size, labelW - 10);
    const values = wrap(this.font, value, size, valueW);
    const count = Math.max(labels.length, values.length);
    this.ensure(count * lineH);
    const top = this.y;
    labels.forEach((line, i) => {
      this.page.drawText(line, { x: MARGIN, y: top - size - i * lineH, size, font: this.font, color: BLACK });
    });
    values.forEach((line, i) => {
      this.page.drawText(line, { x: valueX, y: top - size - i * lineH, size, font: this.font, color: BLACK });
    });
    this.y = top - count * lineH;
  }

  amountRow(label: string, amount: string, size = 11) {
    const lineH = size * 1.5;
    const amountW = this.font.widthOfTextAtSize(amount, size);
    const labelW = PAGE_W - MARGIN * 2 - amountW - 12;
    const labels = wrap(this.font, label, size, labelW);
    this.ensure(labels.length * lineH);
    const top = this.y;
    labels.forEach((line, i) => {
      this.page.drawText(line, { x: MARGIN, y: top - size - i * lineH, size, font: this.font, color: BLACK });
    });
    this.page.drawText(amount, {
      x: PAGE_W - MARGIN - amountW,
      y: top - size,
      size,
      font: this.font,
      color: BLACK,
    });
    this.y = top - labels.length * lineH;
  }
}

/** A4 invoice PDF. Bank lines are whatever the sheet already stored from settings. */
export async function renderInvoicePdf(sheet: InvoiceSheet): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await loadFont(), { subset: true });
  doc.setTitle(`${sheet.brand} — ${sheet.ref}`);
  doc.setAuthor(sheet.brand);

  const page = new Sheet(doc, font);
  page.paragraph(sheet.brand, 22);
  page.gap(2);
  page.paragraph("ინვოისი", 12);
  page.paragraph(sheet.ref, 11);
  page.gap(6);
  page.rule();

  for (const row of sheet.details) page.pair(row.label, row.value);
  page.gap(10);
  page.rule();

  for (const line of sheet.lines) page.amountRow(line.label, line.amount);
  if (sheet.discount) page.amountRow(sheet.discount.label, sheet.discount.amount);
  page.gap(4);
  page.rule();
  page.amountRow(sheet.totalLabel, sheet.total, 14);
  page.gap(14);
  page.paragraph(sheet.bankIntro, 11);
  page.gap(4);
  for (const row of sheet.bank) page.pair(row.label, row.value);
  page.gap(16);
  page.paragraph(sheet.thanks, 11);

  return doc.save();
}
