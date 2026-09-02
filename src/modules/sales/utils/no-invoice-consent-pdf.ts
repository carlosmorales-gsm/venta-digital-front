import { jsPDF } from 'jspdf';
import { saleCompanyName } from '../constants/sale-companies';
import { fullName, type SaleFormData } from '../types/sale-form';

const PAGE_W = 612.28;
const PAGE_H = 792;
const ML = 54;
const MR = 54;
const INK: [number, number, number] = [20, 22, 24];
const LINE: [number, number, number] = [40, 42, 46];
const LOGO: [number, number, number] = [74, 84, 94];
const HEADER_H = 62;
const CONTENT_W = PAGE_W - ML - MR;

type LogoAsset = { dataUrl: string; width: number; height: number };
type Doc = jsPDF;
export type NoInvoiceConsentOpts = { saleId?: number | null; status?: string };

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

function v(text?: string | null) {
  return (text ?? '').trim();
}

function setInk(doc: Doc, rgb = INK) {
  doc.setTextColor(...rgb);
}

function parseDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return { day: '', month: '', year: '' };
  return {
    day: String(Number(m[3])),
    month: MONTHS[Number(m[2]) - 1] || '',
    year: m[1],
  };
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

function blankLine(doc: Doc, x: number, y: number, w: number, value = '') {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.55);
  doc.line(x, y + 2.2, x + w, y + 2.2);
  if (!value) return;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  setInk(doc);
  const lines = doc.splitTextToSize(value, w - 4) as string[];
  doc.text(lines[0] || '', x + 2, y);
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
  doc.text('CONSENTIMIENTO DE NO FACTURA', PAGE_W / 2, 41, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setInk(doc);
  doc.text('FOR-GSM-CMR-04', PAGE_W - MR, 26, { align: 'right' });
  doc.text('V.001', PAGE_W - MR, 41, { align: 'right' });

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  doc.line(ML, HEADER_H - 2, PAGE_W - MR, HEADER_H - 2);
}

function drawDateLine(
  doc: Doc,
  date: { day: string; month: string; year: string },
) {
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

export function isDraftNoInvoiceConsent(
  form: SaleFormData,
  opts?: NoInvoiceConsentOpts,
): boolean {
  const status = String(opts?.status || '').toUpperCase();
  if (status === 'COMPLETED' || status === 'SUBMITTED') return false;
  return !form.documentos?.firmaCliente?.dataBase64?.trim();
}

function drawDraftWatermark(doc: Doc) {
  const ys = [PAGE_H * 0.28, PAGE_H * 0.52, PAGE_H * 0.76];
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

function drawJustified(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
) {
  const lines = doc.splitTextToSize(text, maxW) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineH;
}

function drawLetter(doc: Doc, form: SaleFormData, logo: LogoAsset | null) {
  const cliente = fullName(form.contacto);
  const company = saleCompanyName(form.ubicacionPlan.planKind);
  const hasIne = Boolean(
    form.documentos.ine?.dataBase64 || form.documentos.ine?.driveFileUrl,
  );
  const date = parseDate(form.meta.fecha);

  drawOfficialHeader(doc, logo);
  drawDateLine(doc, date);

  let y = 128;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setInk(doc);
  doc.text('NOMBRE DEL CLIENTE:', ML, y);
  const nameLabelW = doc.getTextWidth('NOMBRE DEL CLIENTE:');
  blankLine(doc, ML + nameLabelW + 8, y, CONTENT_W - nameLabelW - 8, cliente);

  y += 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  setInk(doc);
  doc.text('Identificación:', ML, y);
  checkBox(doc, hasIne, ML + 92, y - 7, 'INE');
  checkBox(doc, false, ML + 168, y - 7, 'PASAPORTE');
  checkBox(doc, false, ML + 278, y - 7, 'LICENCIA DE CONDUCIR');

  y += 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Presente.', ML, y);

  y += 28;
  const yoLabel = 'Por medio de la presente, yo ';
  doc.text(yoLabel, ML, y);
  const yoW = doc.getTextWidth(yoLabel);
  blankLine(doc, ML + yoW, y, CONTENT_W - yoW, cliente);

  y += 26;
  const manLabel = 'manifiesto a ';
  doc.text(manLabel, ML, y);
  const manW = doc.getTextWidth(manLabel);
  blankLine(doc, ML + manW, y, CONTENT_W - manW, company);

  y += 26;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setInk(doc);
  y = drawJustified(
    doc,
    'que tengo claro y entendido que, ACEPTO NO PROPORCIONAR DATOS FISCALES para la recepción de la factura que ampara mi compra, por lo que acepto y autorizo se emita RFC genérico (XAXX010101000), renunciando al derecho de solicitar refacturación una vez realizada la misma. Que he realizado las preguntas que me surgieron sobre la solicitud de documento Fiscal y que he recibido información suficiente sobre el mismo.',
    ML,
    y,
    CONTENT_W,
    16,
  );

  y += 18;
  y = drawJustified(
    doc,
    'En mi propio derecho doy mi consentimiento que NO SOLICITARÉ SE INCLUYAN DATOS FISCALES A MI FACTURA (RFC) por el servicio prestado, por así convenir a mis intereses.',
    ML,
    y,
    CONTENT_W,
    16,
  );

  y += 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setInk(doc);
  doc.text('ATENTAMENTE.', PAGE_W / 2, y, { align: 'center' });

  const firma = form.documentos.firmaCliente;
  const lineY = y + 78;
  if (firma?.dataBase64?.trim()) {
    const dataUrl = firma.dataBase64.startsWith('data:')
      ? firma.dataBase64
      : `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`;
    try {
      doc.addImage(dataUrl, 'PNG', PAGE_W / 2 - 70, y + 16, 140, 42);
    } catch {
      /* ignore */
    }
  }
  if (cliente) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setInk(doc);
    doc.text(cliente, PAGE_W / 2, lineY - 4, { align: 'center' });
  }
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.55);
  doc.line(PAGE_W / 2 - 150, lineY, PAGE_W / 2 + 150, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setInk(doc);
  doc.text('Nombre y Firma.', PAGE_W / 2, lineY + 16, { align: 'center' });
}

export async function buildNoInvoiceConsentPdf(
  form: SaleFormData,
  opts?: NoInvoiceConsentOpts,
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });
  const logo = await loadHeaderLogo();
  drawLetter(doc, form, logo);
  if (isDraftNoInvoiceConsent(form, opts)) {
    drawDraftWatermark(doc);
  }
  return doc.output('blob');
}

export async function buildNoInvoiceConsentBundle(
  form: SaleFormData,
  opts?: NoInvoiceConsentOpts,
): Promise<{ blob: Blob; pages: string[] }> {
  const blob = await buildNoInvoiceConsentPdf(form, opts);
  const { renderPdfToPageImages } = await import('./pdf-page-renderer');
  try {
    const pages = await renderPdfToPageImages(blob);
    return { blob, pages };
  } catch {
    return { blob, pages: [] };
  }
}
