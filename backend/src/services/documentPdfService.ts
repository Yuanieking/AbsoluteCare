import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { ASSETS_DIR } from "../config/paths.js";
import type {
  DocumentPayload,
  DocumentSection,
  DocumentTable,
} from "./documentDataService.js";

type PdfDoc = InstanceType<typeof PDFDocument>;

const PINE = "#14453b";
const INK = "#1f2a26";
const SOFT = "#5b6560";
const FAINT = "#8a938e";
const HAIRLINE = "#d8ddd9";
const CLAY = "#8f3b2f";

const PAGE_MARGIN = 48;
const HEADER_BAND = 118;
const FOOTER_BAND = 64;

export interface ClinicIdentity {
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  timezone: string;
}

export function clinicIdentity(general: {
  clinicName?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  timezone?: string;
}): ClinicIdentity {
  return {
    name: general.clinicName?.trim() || "AbsoluteCare Therapy Center",
    address: general.address?.trim() || "",
    phone: general.phone?.trim() || "",
    email: general.email?.trim() || "",
    currency: general.currency?.trim() || "PHP",
    timezone: general.timezone?.trim() || "Asia/Manila",
  };
}

export interface RenderInput {
  payload: DocumentPayload;
  trackingNumber: string;
  verificationUrl: string;
  /** False while FRONTEND_URL still points at localhost. */
  verifyIsPublic: boolean;
  issuedLabel: string;
  issuerLine: string;
  clinic: ClinicIdentity;
}

const contentWidth = (doc: PdfDoc): number => doc.page.width - PAGE_MARGIN * 2;

function ensureSpace(doc: PdfDoc, height: number): boolean {
  if (doc.y + height <= doc.page.height - FOOTER_BAND - 6) return false;
  doc.addPage();
  doc.x = PAGE_MARGIN;
  doc.y = HEADER_BAND;
  return true;
}

function columnWidths(doc: PdfDoc, count: number): number[] {
  const total = contentWidth(doc);
  const ratios: Record<number, number[]> = {
    2: [0.45, 0.55],
    3: [0.45, 0.25, 0.3],
    4: [0.25, 0.25, 0.25, 0.25],
    5: [0.16, 0.18, 0.18, 0.12, 0.36],
  };
  const chosen =
    ratios[count] ?? Array.from({ length: count }, () => 1 / count);
  const widths = chosen.map((ratio) => Math.floor(total * ratio));
  const used = widths.reduce((totalWidth, width) => totalWidth + width, 0);
  const last = widths.length - 1;
  if (last >= 0) widths[last] = (widths[last] ?? 0) + (total - used);
  return widths;
}

function drawFact(doc: PdfDoc, label: string, value: string): void {
  const labelWidth = 165;
  const valueWidth = contentWidth(doc) - labelWidth - 8;
  doc.font("Helvetica").fontSize(9);
  const height =
    Math.max(
      doc.heightOfString(label || " ", { width: labelWidth, lineGap: 1 }),
      doc.heightOfString(value || " ", { width: valueWidth, lineGap: 1 }),
      11,
    ) + 6;
  ensureSpace(doc, height);
  const y = doc.y;
  doc.fillColor(SOFT).text(label, PAGE_MARGIN, y, { width: labelWidth, lineGap: 1 });
  doc
    .fillColor(INK)
    .text(value, PAGE_MARGIN + labelWidth + 8, y, { width: valueWidth, lineGap: 1 });
  doc.x = PAGE_MARGIN;
  doc.y = y + height;
}

function drawTable(
  doc: PdfDoc,
  table: DocumentTable,
  fill: (text: string) => string,
): void {
  const widths = columnWidths(doc, table.columns.length);
  const widthAt = (index: number): number => (widths[index] ?? 40) - 6;
  const ruleAt = (y: number, color: string, lineWidth: number): void => {
    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + contentWidth(doc), y)
      .strokeColor(color)
      .lineWidth(lineWidth)
      .stroke();
  };
  const drawHead = (): void => {
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(PINE);
    const y = doc.y;
    let x = PAGE_MARGIN;
    let height = 10;
    table.columns.forEach((column, index) => {
      const width = widthAt(index);
      doc.text(fill(column), x, y, { width, lineGap: 1 });
      height = Math.max(height, doc.heightOfString(column, { width, lineGap: 1 }));
      x += widths[index] ?? 40;
    });
    const after = y + height + 5;
    ruleAt(after, HAIRLINE, 0.6);
    doc.x = PAGE_MARGIN;
    doc.y = after + 3;
  };

  ensureSpace(doc, 44);
  drawHead();

  if (!table.rows.length) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(SOFT)
      .text(table.emptyText ?? "No records.", PAGE_MARGIN, doc.y, {
        width: contentWidth(doc),
      });
    doc.moveDown(0.7);
    return;
  }

  for (const row of table.rows) {
    const cells = table.columns.map((_, index) => row[index] ?? "—");
    doc.font("Helvetica").fontSize(8.5);
    let rowHeight = 12;
    cells.forEach((cell, index) => {
      rowHeight = Math.max(
        rowHeight,
        doc.heightOfString(fill(cell) || " ", { width: widthAt(index), lineGap: 1 }) + 7,
      );
    });
    if (ensureSpace(doc, rowHeight)) drawHead();
    const y = doc.y;
    let x = PAGE_MARGIN;
    cells.forEach((cell, index) => {
      doc
        .fillColor(index === 0 ? INK : SOFT)
        .text(fill(cell) || "—", x, y, { width: widthAt(index), lineGap: 1 });
      x += widths[index] ?? 40;
    });
    const after = y + rowHeight;
    ruleAt(after, "#eef1ef", 0.5);
    doc.x = PAGE_MARGIN;
    doc.y = after + 2;
  }
  doc.moveDown(0.7);
}

function drawSection(
  doc: PdfDoc,
  section: DocumentSection,
  fill: (text: string) => string,
): void {
  if (section.heading) {
    ensureSpace(doc, 42);
    doc.moveDown(0.7);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(PINE)
      .text(fill(section.heading));
    doc.moveDown(0.3);
  }
  for (const paragraph of section.paragraphs ?? []) {
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(INK)
      .text(fill(paragraph), { lineGap: 1.5 });
    doc.moveDown(0.4);
  }
  for (const [label, value] of section.facts ?? []) {
    drawFact(doc, fill(label), fill(value));
  }
  for (const table of section.tables ?? []) drawTable(doc, table, fill);
  if (section.note) {
    doc.moveDown(0.3);
    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(SOFT)
      .text(fill(section.note), { lineGap: 1.2 });
    doc.moveDown(0.4);
  }
}

function drawSignatureBlock(doc: PdfDoc, input: RenderInput): void {
  ensureSpace(doc, 96);
  doc.moveDown(2);
  const y = doc.y;
  const width = contentWidth(doc);
  const secondX = PAGE_MARGIN + width - 120;
  doc
    .moveTo(PAGE_MARGIN, y + 26)
    .lineTo(PAGE_MARGIN + 120, y + 26)
    .strokeColor(HAIRLINE)
    .lineWidth(0.5)
    .stroke();
  doc
    .moveTo(secondX, y + 26)
    .lineTo(secondX + 120, y + 26)
    .strokeColor(HAIRLINE)
    .lineWidth(0.5)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(SOFT)
    .text("Issued by", PAGE_MARGIN, y + 30, { width: 120 })
    .text(input.issuerLine, PAGE_MARGIN, y + 41, { width: 120, lineGap: 1 })
    .text("Received by", secondX, y + 30, { width: 120 })
    .text("Signature", secondX, y + 41, { width: 120 });
  doc
    .font("Helvetica-Oblique")
    .fontSize(7)
    .fillColor(FAINT)
    .text(
      "Electronically issued. This document is valid without a handwritten signature; scan the QR code to confirm it.",
      PAGE_MARGIN,
      y + 62,
      { width },
    );
  doc.moveDown(2);
}

function verifyHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function fitText(doc: PdfDoc, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let value = text;
  while (value.length > 1 && doc.widthOfString(`${value}…`) > width) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

function drawHeader(
  doc: PdfDoc,
  input: RenderInput,
  qr: Buffer,
): void {
  doc.save();
  const pageWidth = doc.page.width;
  const contentRight = pageWidth - PAGE_MARGIN;
  const logoPath = path.join(ASSETS_DIR, "email/logo.png");
  const hasLogo = fs.existsSync(logoPath);
  let leftY = 34;
  if (hasLogo) {
    doc.image(logoPath, PAGE_MARGIN, leftY, { height: 32 });
    leftY += 36;
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(hasLogo ? 10 : 13)
    .fillColor(PINE)
    .text(input.clinic.name, PAGE_MARGIN, leftY, { width: 260 });
  const contact = [input.clinic.address, input.clinic.phone, input.clinic.email]
    .filter(Boolean)
    .join(" · ");
  if (contact) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(SOFT)
      .text(contact, PAGE_MARGIN, leftY + 14, { width: 250, lineGap: 1 });
  }

  const qrSize = 52;
  doc.image(qr, contentRight - qrSize, 30, { width: qrSize, height: qrSize });

  const rightX = pageWidth / 2;
  const rightWidth = contentRight - qrSize - 16 - rightX;
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(PINE)
    .text(input.payload.title, rightX, 36, {
      width: rightWidth,
      align: "right",
    });

  doc.font("Helvetica").fontSize(9);
  const trackingWidth = Math.min(doc.widthOfString(input.trackingNumber) + 14, rightWidth);
  const boxX = contentRight - qrSize - 16 - trackingWidth;
  doc
    .roundedRect(boxX, 58, trackingWidth, 17, 2)
    .strokeColor(HAIRLINE)
    .lineWidth(0.6)
    .stroke();
  doc
    .fillColor(INK)
    .text(input.trackingNumber, boxX + 7, 62, {
      width: trackingWidth - 14,
      align: "center",
      lineBreak: false,
    });

  if (!input.verifyIsPublic) {
    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(CLAY)
      .text("Verification URL is not public", rightX, 80, {
        width: rightWidth,
        align: "right",
      });
  }

  doc
    .moveTo(PAGE_MARGIN, 108)
    .lineTo(contentRight, 108)
    .strokeColor(HAIRLINE)
    .lineWidth(0.5)
    .stroke();
  doc.restore();
}

function drawFooter(
  doc: PdfDoc,
  input: RenderInput,
  page: number,
  total: number,
): void {
  doc.save();
  const pageHeight = doc.page.height;
  const contentRight = doc.page.width - PAGE_MARGIN;
  const width = contentRight - PAGE_MARGIN;
  doc
    .moveTo(PAGE_MARGIN, pageHeight - 58)
    .lineTo(contentRight, pageHeight - 58)
    .strokeColor(HAIRLINE)
    .lineWidth(0.5)
    .stroke();
  doc.font("Helvetica").fontSize(7).fillColor(SOFT);
  doc.text(fitText(doc, input.issuerLine, 205), PAGE_MARGIN, pageHeight - 49, {
    width: 205,
    lineBreak: false,
  });
  doc.text(`Page ${page} of ${total}`, PAGE_MARGIN + 205, pageHeight - 49, {
    width: width - 410,
    align: "center",
    lineBreak: false,
  });
  doc.text(
    fitText(doc, `Verify: ${input.verificationUrl}`, 200),
    contentRight - 200,
    pageHeight - 49,
    { width: 200, align: "right", lineBreak: false },
  );
  doc
    .fontSize(6.5)
    .fillColor(FAINT)
    .text(
      `Confidential. Issued by ${input.clinic.name}. Authenticity can be checked at ${verifyHost(input.verificationUrl)}.`,
      PAGE_MARGIN,
      pageHeight - 36,
      { width, align: "center", lineBreak: false },
    );
  doc.restore();
}

export async function renderDocumentPdf(input: RenderInput): Promise<Buffer> {
  const qr = await QRCode.toBuffer(input.verificationUrl, {
    type: "png",
    margin: 1,
    width: 180,
    errorCorrectionLevel: "M",
  });

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: HEADER_BAND,
      bottom: FOOTER_BAND,
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
    },
    bufferPages: true,
    info: {
      Title: input.payload.title,
      Author: input.clinic.name,
      Subject: input.trackingNumber,
      Creator: "AbsoluteCare",
    },
  });

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const fill = (text: string): string =>
    text.replaceAll("{{tracking}}", input.trackingNumber);

  doc.fillColor(INK).font("Helvetica");
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(PINE)
    .text(input.payload.title, { width: contentWidth(doc) });
  doc.moveDown(0.5);

  for (const section of input.payload.sections) {
    drawSection(doc, section, fill);
  }
  drawSignatureBlock(doc, input);

  // Header and footer are painted after pagination so "Page n of total" is exact
  // and every page carries the same letterhead.
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    // A bottom margin of zero stops the footer from triggering another page.
    doc.page.margins.bottom = 0;
    drawHeader(doc, input, qr);
    drawFooter(doc, input, index - range.start + 1, range.count);
  }

  doc.end();
  return finished;
}
