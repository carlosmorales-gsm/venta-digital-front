import { jsPDF } from 'jspdf';
import {
  FISCAL_REGIMEN_CARTA,
  FISCAL_REGIMEN_OTRO,
  FISCAL_REGIMEN_OTROS,
} from '../constants/fiscal-regimes';
import { fullName, type SaleFormData } from '../types/sale-form';

const PAGE_W = 612.28;
const PAGE_H = 792;
const ML = 54;
const MR = 54;
const INK: [number, number, number] = [20, 22, 24];
const MUTED: [number, number, number] = [70, 74, 80];
const LINE: [number, number, number] = [40, 42, 46];
const LOGO: [number, number, number] = [74, 84, 94];
const HEADER_H = 62;
const CONTENT_W = PAGE_W - ML - MR;

type LogoAsset = { dataUrl: string; width: number; height: number };

/** Logo San Martín en gris (el SVG del sistema es blanco). */
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
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width,
        height,
      });
    };
    img.onerror = () => resolve(null);
    img.src = '/logo-sanmartin.svg';
  });
}

function drawOfficialHeader(doc: Doc, logo: LogoAsset | null) {
  if (logo) {
    const logoH = 34;
    const logoW = (logo.width / logo.height) * logoH;
    doc.addImage(logo.dataUrl, 'PNG', ML, 14, logoW, logoH);
  } else {
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    setInk(doc, LOGO);
    doc.text('SAN MARTÍN', ML, 28);
    doc.setFont('times', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(120, 128, 136);
    doc.text('TU VIDA, UN LEGADO', ML, 37);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setInk(doc);
  doc.text('FORMATO', PAGE_W / 2, 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('CARTA DE REQUERIMIENTO DE FACTURA', PAGE_W / 2, 41, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setInk(doc);
  doc.text('FOR-GSM-CMR-05', PAGE_W - MR, 26, { align: 'right' });
  doc.text('V.001', PAGE_W - MR, 41, { align: 'right' });

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  doc.line(ML, HEADER_H - 2, PAGE_W - MR, HEADER_H - 2);
}

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

type Doc = jsPDF;
export type InvoiceLetterOpts = { saleId?: number | null; status?: string };

function v(text?: string | null) {
  return (text ?? '').trim();
}

function setInk(doc: Doc, rgb = INK) {
  doc.setTextColor(...rgb);
}

function parseDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return { day: '', month: '', year: '' };
  const monthIdx = Number(m[2]) - 1;
  return {
    day: String(Number(m[3])),
    month: MONTHS[monthIdx] || '',
    year: m[1],
  };
}

function checkBox(doc: Doc, on: boolean, x: number, y: number, label: string) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  doc.rect(x, y, 8.5, 8.5);
  if (on) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setInk(doc);
    doc.text('X', x + 1.6, y + 6.8);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setInk(doc);
  doc.text(label, x + 13, y + 7);
}

function blankLine(doc: Doc, x: number, y: number, w: number, value = '') {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.55);
  doc.line(x, y + 2.2, x + w, y + 2.2);
  if (!value) return;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setInk(doc);
  const lines = doc.splitTextToSize(value, w - 4) as string[];
  doc.text(lines[0] || '', x + 2, y);
}

function labeledLine(
  doc: Doc,
  label: string,
  value: string,
  y: number,
  lineW = 220,
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setInk(doc);
  doc.text(label, ML, y);
  const labelW = doc.getTextWidth(label);
  blankLine(doc, ML + labelW + 8, y, lineW, value);
}

export function isDraftInvoiceLetter(
  form: SaleFormData,
  opts?: InvoiceLetterOpts,
): boolean {
  const status = String(opts?.status || '').toUpperCase();
  if (status === 'COMPLETED' || status === 'SUBMITTED') return false;
  return !form.documentos?.firmaCliente?.dataBase64?.trim();
}

function drawDraftWatermark(doc: Doc) {
  const ys = [PAGE_H * 0.22, PAGE_H * 0.48, PAGE_H * 0.74];
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.11 }));
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

function regimenCode(form: SaleFormData): string {
  const code = v(form.contacto.regimenFiscal).toUpperCase();
  if (code === FISCAL_REGIMEN_OTRO) {
    return v(form.contacto.regimenFiscalOtro).toUpperCase();
  }
  return code;
}

function otroRegimenLabel(form: SaleFormData): string {
  const code = regimenCode(form);
  if (FISCAL_REGIMEN_CARTA.some((r) => r.value === code)) return '';
  const found = FISCAL_REGIMEN_OTROS.find((r) => r.value === code);
  if (found) return found.label;
  return v(form.contacto.regimenFiscalOtro);
}

function drawDateLine(doc: Doc, date: { day: string; month: string; year: string }) {
  const y = 88;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setInk(doc);
  const end = PAGE_W - MR;
  const yearW = 48;
  const monthW = 132;
  const dayW = 32;
  let x = end;
  doc.text('.', x, y);
  x -= 6;
  x -= yearW;
  blankLine(doc, x, y, yearW, date.year);
  x -= 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setInk(doc);
  const delW = doc.getTextWidth('del');
  x -= delW;
  doc.text('del', x, y);
  x -= 8;
  x -= monthW;
  blankLine(doc, x, y, monthW, date.month);
  x -= 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setInk(doc);
  const deW = doc.getTextWidth('de');
  x -= deW;
  doc.text('de', x, y);
  x -= 8;
  x -= dayW;
  blankLine(doc, x, y, dayW, date.day);
  x -= 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setInk(doc);
  const city = 'Culiacán, Sinaloa';
  x -= doc.getTextWidth(city);
  doc.text(city, x, y);
}

function drawLetter(doc: Doc, form: SaleFormData, logo: LogoAsset | null) {
  const c = form.contacto;
  const date = parseDate(form.meta.fecha);
  const tipo = v(c.tipoPersona).toUpperCase();
  const code = regimenCode(form);

  drawOfficialHeader(doc, logo);
  drawDateLine(doc, date);

  let y = 128;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setInk(doc);
  doc.text('TIPO DE PERSONA :', ML, y);
  y += 16;
  checkBox(doc, tipo === 'FISICA', ML, y, 'FISICA');
  y += 18;
  checkBox(doc, tipo === 'MORAL', ML, y, 'MORAL');

  y += 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setInk(doc);
  doc.text('RAZÓN SOCIAL:', ML, y);
  y += 13;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    'Escríbela tal cual estás registrado en el SAT incluyendo espacios y puntos, excluyendo el régimen capital.',
    ML,
    y,
    { maxWidth: CONTENT_W },
  );
  y += 22;
  blankLine(doc, ML, y, CONTENT_W, v(c.razonSocial).toUpperCase());

  y += 36;
  labeledLine(doc, 'RFC:', v(c.rfc).toUpperCase(), y, 160);

  y += 32;
  labeledLine(doc, 'CÓDIGO POSTAL:', v(c.facturaCp || c.cp), y, 90);

  y += 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setInk(doc);
  doc.text('REGIMEN FISCAL:', ML, y);
  y += 18;
  for (const item of FISCAL_REGIMEN_CARTA) {
    checkBox(doc, code === item.value, ML, y, item.label);
    y += 18;
  }
  const otroOn =
    Boolean(code) && !FISCAL_REGIMEN_CARTA.some((r) => r.value === code);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setInk(doc);
  doc.text('OTRO:', ML, y);
  blankLine(doc, ML + 40, y, 220, otroOn ? otroRegimenLabel(form) : '');

  y += 36;
  labeledLine(
    doc,
    'TELÉFONO DE CONTACTO:',
    v(c.telefonoFactura || c.celular1),
    y,
    260,
  );

  y += 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setInk(doc);
  doc.text(
    '*CONSTANCIA DE SITUACIÓN FISCAL; NO ES OBLIGATORIA SOLO PARA CORROBORAR TUS DATOS.',
    ML,
    y,
    { maxWidth: CONTENT_W },
  );

  y += 52;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setInk(doc);
  doc.text('ATENTAMENTE.', PAGE_W / 2, y, { align: 'center' });

  const firma = form.documentos.firmaCliente;
  const lineY = y + 70;
  if (firma?.dataBase64?.trim()) {
    const dataUrl = firma.dataBase64.startsWith('data:')
      ? firma.dataBase64
      : `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`;
    try {
      doc.addImage(dataUrl, 'PNG', PAGE_W / 2 - 70, y + 14, 140, 42);
    } catch {
      /* ignore */
    }
  }

  const signer = v(c.razonSocial) || fullName(c);
  if (signer) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setInk(doc);
    doc.text(signer, PAGE_W / 2, lineY - 4, { align: 'center' });
  }

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.55);
  doc.line(PAGE_W / 2 - 150, lineY, PAGE_W / 2 + 150, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setInk(doc);
  doc.text('Nombre y Firma.', PAGE_W / 2, lineY + 16, { align: 'center' });
}

export async function buildInvoiceLetterPdf(
  form: SaleFormData,
  opts?: InvoiceLetterOpts,
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });
  const logo = await loadHeaderLogo();
  drawLetter(doc, form, logo);
  if (isDraftInvoiceLetter(form, opts)) {
    drawDraftWatermark(doc);
  }
  return doc.output('blob');
}

export async function buildInvoiceLetterBundle(
  form: SaleFormData,
  opts?: InvoiceLetterOpts,
): Promise<{ blob: Blob; pages: string[] }> {
  const blob = await buildInvoiceLetterPdf(form, opts);
  const { renderPdfToPageImages } = await import('./pdf-page-renderer');
  try {
    const pages = await renderPdfToPageImages(blob);
    return { blob, pages };
  } catch {
    return { blob, pages: [] };
  }
}
