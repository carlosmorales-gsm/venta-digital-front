import { GState, jsPDF } from 'jspdf';
import { saleCompanyName, saleCompanyNameById } from '../constants/sale-companies';
import { parseSaleKind, saleNeedsOriginSales } from '../constants/sale-kinds';
import { fillOriginCompanies } from './odoo-clientes';
import {
  fullName,
  isSignedSaleStatus,
  type ReconocimientoVenta,
  type SaleFormData,
} from '../types/sale-form';

const PAGE_W = 612.28;
const PAGE_H = 792;
const ML = 54;
const MR = 54;
const INK: [number, number, number] = [20, 22, 24];
const LINE: [number, number, number] = [40, 42, 46];
const LOGO: [number, number, number] = [28, 42, 68];
const CONTENT_W = PAGE_W - ML - MR;

const LEGAL =
  'DE ACUERDO A LO ANTES MENCIONADO, Y DE CONFORMIDAD TAL CONTRATO QUEDA CANCELADO DE MANERA VOLUNTARIA POR EL CONTRATANTE, EXTINGUIÉNDOSE TODOS LOS DERECHOS Y OBLIGACIONES QUE SE GENERAN DEL MISMO. ASÍ TAMBIÉN POR TRATARSE DE UNA CANCELACIÓN VOLUNTARIA POR PARTE DEL CITADO CONTRATANTE, Y CON FUNDAMENTO EN LA CLÁUSULA DÉCIMA PRIMERA DEL CONTRATO DE REFERENCIA, NO SE HARÁ DEVOLUCIÓN ECONÓMICA ALGUNA A FAVOR DE ESTE ÚLTIMO, ACEPTANDO DE CONFORMIDAD LO AQUÍ EXPUESTO.';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type LogoAsset = { dataUrl: string; width: number; height: number };
type Doc = jsPDF;
type DateParts = { day: string; month: string; year: string };

export type CancellationRequestOpts = {
  saleId?: number | null;
  status?: string;
  originId?: number | null;
};

export function saleUsesCancellationRequest(kind: string): boolean {
  return saleNeedsOriginSales(kind);
}

function cancellationReason(kind: string): string {
  const parsed = parseSaleKind(kind);
  if (parsed === 'MEJORA') return 'MEJORA DE LA VENTA';
  if (parsed === 'MINORIA') return 'MINORA DE LA VENTA';
  return 'RECONOCIMIENTO DE SALDO';
}

export function isDraftCancellationRequest(
  form: SaleFormData,
  opts?: CancellationRequestOpts,
): boolean {
  const status = String(opts?.status || '').toUpperCase();
  if (isSignedSaleStatus(status)) return false;
  return !form.documentos?.firmaCliente?.dataBase64?.trim();
}

function setInk(doc: Doc, rgb = INK) {
  doc.setTextColor(...rgb);
}

function parseDate(iso: string): DateParts {
  const raw = (iso || '').trim();
  const isoM = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoM) {
    return {
      day: String(Number(isoM[3])),
      month: MONTHS[Number(isoM[2]) - 1] || '',
      year: isoM[1],
    };
  }
  const latam = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(raw);
  if (latam) {
    return {
      day: String(Number(latam[1])),
      month: MONTHS[Number(latam[2]) - 1] || '',
      year: latam[3],
    };
  }
  return { day: '', month: '', year: '' };
}

function dateBlank(parts: DateParts): string {
  const day = parts.day || '____';
  const month = (parts.month || '__________').toUpperCase();
  const year = parts.year || '______';
  return `${day} DE ${month} DE ${year}`;
}

function selectedOrigin(
  form: SaleFormData,
  originId?: number | null,
): ReconocimientoVenta | null {
  const list = form.meta.reconocimientoVentas ?? [];
  if (originId != null) {
    return list.find((item) => item.id === originId) ?? list[0] ?? null;
  }
  return list[0] ?? null;
}

function originFolio(origin: ReconocimientoVenta | null): string {
  const folio = (origin?.folio || origin?.folioSolicitud || '').trim();
  if (folio) return folio;
  if (origin?.id) return String(origin.id);
  return '';
}

function loadHeaderLogo(): Promise<LogoAsset | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 114;
      const height = img.naturalHeight || 52;
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = `rgb(${LOGO.join(',')})`;
      ctx.fillRect(0, 0, width, height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width, height });
    };
    img.onerror = () => resolve(null);
    img.src = '/logo-sanmartin.svg';
  });
}

function loadSignature(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function drawDraftWatermark(doc: Doc) {
  const ys = [PAGE_H * 0.28, PAGE_H * 0.52, PAGE_H * 0.76];
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.11 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(72);
  doc.setTextColor(130, 138, 146);
  for (const y of ys) {
    doc.text('BORRADOR', PAGE_W / 2, y, {
      align: 'center',
      baseline: 'middle',
      angle: 32,
    });
  }
  doc.restoreGraphicsState();
}

function fitLine(doc: Doc, text: string, maxWidth: number, size: number, min = 8) {
  let current = size;
  doc.setFontSize(current);
  while (current > min && doc.getTextWidth(text) > maxWidth) {
    current -= 0.4;
    doc.setFontSize(current);
  }
  return current;
}

function wrapMixedParagraph(
  doc: Doc,
  runs: { text: string; bold: boolean }[],
  maxWidth: number,
  fontSize: number,
): { word: string; bold: boolean }[][] {
  doc.setFontSize(fontSize);
  const words: { word: string; bold: boolean }[] = [];
  for (const run of runs) {
    for (const word of run.text.trim().split(/\s+/).filter(Boolean)) {
      words.push({ word, bold: run.bold });
    }
  }
  const lines: { word: string; bold: boolean }[][] = [];
  let line: { word: string; bold: boolean }[] = [];
  let lineWidth = 0;
  for (const item of words) {
    doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
    const wordWidth = doc.getTextWidth(item.word);
    const gap = line.length ? doc.getTextWidth(' ') : 0;
    if (line.length && lineWidth + gap + wordWidth > maxWidth) {
      lines.push(line);
      line = [item];
      lineWidth = wordWidth;
    } else {
      line.push(item);
      lineWidth += gap + wordWidth;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

function drawMixedParagraph(
  doc: Doc,
  runs: { text: string; bold: boolean }[],
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
): number {
  const lines = wrapMixedParagraph(doc, runs, maxWidth, fontSize);

  let cursorY = y;
  lines.forEach((row, index) => {
    let wordsWidth = 0;
    for (const item of row) {
      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      wordsWidth += doc.getTextWidth(item.word);
    }
    doc.setFont('helvetica', 'normal');
    const normalSpace = doc.getTextWidth(' ');
    const gaps = row.length - 1;
    const gapWidth =
      index === lines.length - 1 || gaps === 0
        ? normalSpace
        : (maxWidth - wordsWidth) / gaps;
    let cursorX = x;
    row.forEach((item, wordIndex) => {
      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      setInk(doc);
      doc.text(item.word, cursorX, cursorY);
      cursorX += doc.getTextWidth(item.word);
      if (wordIndex < row.length - 1) cursorX += gapWidth;
    });
    cursorY += lineHeight;
  });
  return cursorY;
}

function drawFooterSign(
  doc: Doc,
  x: number,
  w: number,
  name: string,
  label: string,
  firma: HTMLImageElement | null,
) {
  const labelY = PAGE_H - 50;
  const lineY = labelY - 16;
  const nameY = lineY - 16;
  const center = x + w / 2;
  if (firma) {
    const boxH = 46;
    const boxW = Math.min(168, w - 12);
    doc.addImage(firma, 'PNG', center - boxW / 2, nameY - 8 - boxH, boxW, boxH);
  }
  doc.setFont('helvetica', 'bold');
  setInk(doc);
  if (name) {
    fitLine(doc, name, w - 8, 11, 8);
    doc.text(name, center, nameY, { align: 'center' });
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(x, lineY, x + w, lineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setInk(doc);
  doc.text(label, center, labelY, { align: 'center' });
}

export async function buildCancellationRequestPdf(
  form: SaleFormData,
  opts?: CancellationRequestOpts,
): Promise<Blob> {
  const logo = await loadHeaderLogo();
  await fillOriginCompanies(form.meta.reconocimientoVentas ?? []);
  const origin = selectedOrigin(form, opts?.originId);
  const company =
    saleCompanyNameById(origin?.companyId, origin?.companyName) ||
    saleCompanyName(form.ubicacionPlan.planKind);
  const folio = originFolio(origin);
  const holder = fullName(form.contacto).toUpperCase();
  const letterDate = parseDate(form.meta.fecha);
  const acquired = parseDate(origin?.dateOrder || '');
  const reason = cancellationReason(form.meta.tipoVenta);
  const firma = form.documentos.firmaCliente?.dataBase64?.trim() || '';
  const firmaUrl = firma
    ? firma.startsWith('data:')
      ? firma
      : `data:${form.documentos.firmaCliente?.mime || 'image/png'};base64,${firma}`
    : '';
  const firmaImg = firmaUrl ? await loadSignature(firmaUrl) : null;
  const draft = isDraftCancellationRequest(form, opts);

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const logoH = 36;
  if (logo) {
    const logoW = (logo.width / logo.height) * logoH;
    doc.addImage(logo.dataUrl, 'PNG', ML, 14, logoW, logoH);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setInk(doc);
  doc.text('FORMATO', PAGE_W / 2, 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const titleLines = doc.splitTextToSize(
    'SOLICITUD DE CANCELACIÓN DE CONTRATO',
    230,
  ) as string[];
  doc.text(titleLines, PAGE_W / 2, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('N° CONTRATO', PAGE_W - MR, 26, { align: 'right' });
  if (folio) {
    doc.setFont('helvetica', 'bold');
    doc.text(folio, PAGE_W - MR, 40, { align: 'right' });
  }

  const ruleY = Math.max(58, 40 + titleLines.length * 12);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.7);
  doc.line(ML, ruleY, PAGE_W - MR, ruleY);

  const statementRuns = [
    {
      text: 'POR MEDIO DE LA PRESENTE, AUTORIZO LA CANCELACIÓN DEL CONTRATO ARRIBA MENCIONADO, A NOMBRE DE',
      bold: false,
    },
    { text: holder, bold: true },
    {
      text: `ADQUIRIDO EL ${dateBlank(acquired)} POR LAS SIGUIENTES RAZONES:`,
      bold: false,
    },
    { text: reason, bold: true },
  ];
  const statementLineH = 16;

  doc.setFont('helvetica', 'bold');
  fitLine(doc, company, CONTENT_W, 11, 8);
  const companyLines = doc.splitTextToSize(company, CONTENT_W) as string[];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const legal = doc.splitTextToSize(LEGAL, CONTENT_W) as string[];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setInk(doc);
  let y = ruleY + 22;
  doc.text(`CULIACÁN, SIN, A ${dateBlank(letterDate)}`, ML, y);

  y += 16;
  doc.setFont('helvetica', 'bold');
  fitLine(doc, company, CONTENT_W, 11, 8);
  doc.text(companyLines, ML, y);
  y += companyLines.length * 13 + 28;
  const statementEnd = drawMixedParagraph(
    doc,
    statementRuns,
    ML,
    y,
    CONTENT_W,
    11,
    statementLineH,
  );
  y = statementEnd + 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  setInk(doc);
  doc.text(legal, ML, y, { align: 'justify', maxWidth: CONTENT_W, lineHeightFactor: 1.35 });

  const colGap = 36;
  const colW = (CONTENT_W - colGap) / 2;
  drawFooterSign(doc, ML, colW, fullName(form.contacto), 'FIRMA DEL CLIENTE', firmaImg);
  drawFooterSign(
    doc,
    ML + colW + colGap,
    colW,
    (form.pago.nombreAsesor || '').trim().toLocaleUpperCase('es-MX'),
    'REPRESENTANTE',
    null,
  );

  if (draft) drawDraftWatermark(doc);
  return doc.output('blob');
}

export async function buildCancellationRequestBundle(
  form: SaleFormData,
  opts?: CancellationRequestOpts,
): Promise<{ blob: Blob; pages: string[] }> {
  const blob = await buildCancellationRequestPdf(form, opts);
  const { renderPdfToPageImages } = await import('./pdf-page-renderer');
  try {
    const pages = await renderPdfToPageImages(blob);
    return { blob, pages };
  } catch {
    return { blob, pages: [] };
  }
}
