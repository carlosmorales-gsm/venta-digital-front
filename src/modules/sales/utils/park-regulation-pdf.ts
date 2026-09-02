import { jsPDF } from 'jspdf';
import { fullName, realContrato, type SaleFormData } from '../types/sale-form';

const PAGE_W = 612;
const PAGE_H = 792;
const INK: [number, number, number] = [20, 22, 24];
const LETTERHEAD = '/forms/reglamento-parque.png';

type Doc = jsPDF;
export type ParkRegulationOpts = { saleId?: number | null; status?: string };

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

function parseDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return { long: '', short: '' };
  const day = String(Number(m[3]));
  const month = MONTHS[Number(m[2]) - 1] || '';
  const year = m[1];
  return {
    long: day && month ? `${day} de ${month} de ${year}` : '',
    short: `${String(m[3])}/${m[2]}/${year}`,
  };
}

function loadLetterhead(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = LETTERHEAD;
  });
}

function fillLine(
  doc: Doc,
  value: string,
  x: number,
  y: number,
  maxW: number,
  size = 11,
) {
  const text = v(value);
  if (!text) return;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(text, maxW) as string[];
  doc.text(lines[0] || '', x, y);
}

export function isDraftParkRegulation(
  form: SaleFormData,
  opts?: ParkRegulationOpts,
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

function contractNumber(form: SaleFormData, opts?: ParkRegulationOpts) {
  return (
    realContrato(form.meta.contrato) ||
    v(form.meta.folioSolicitud) ||
    (opts?.saleId ? String(opts.saleId) : '')
  );
}

function drawFilledFields(doc: Doc, form: SaleFormData, opts?: ParkRegulationOpts) {
  const date = parseDate(form.meta.fecha);
  const cliente = fullName(form.contacto);
  const contrato = contractNumber(form, opts);

  fillLine(doc, date.long, 450, 82, 110, 10.5);
  fillLine(doc, cliente, 192, 528.5, 360);
  fillLine(doc, contrato, 204, 543, 348);
  fillLine(doc, date.short || date.long, 128, 557, 424);

  const firma = form.documentos.firmaCliente;
  if (firma?.dataBase64?.trim()) {
    const dataUrl = firma.dataBase64.startsWith('data:')
      ? firma.dataBase64
      : `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`;
    try {
      doc.addImage(dataUrl, 'PNG', 95, 590, 160, 46);
    } catch {
      /* ignore */
    }
  }
}

export async function buildParkRegulationPdf(
  form: SaleFormData,
  opts?: ParkRegulationOpts,
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });
  const bg = await loadLetterhead();
  if (bg) {
    doc.addImage(bg, 'PNG', 0, 0, PAGE_W, PAGE_H);
  }
  drawFilledFields(doc, form, opts);
  if (isDraftParkRegulation(form, opts)) {
    drawDraftWatermark(doc);
  }
  return doc.output('blob');
}

export async function buildParkRegulationBundle(
  form: SaleFormData,
  opts?: ParkRegulationOpts,
): Promise<{ blob: Blob; pages: string[] }> {
  const blob = await buildParkRegulationPdf(form, opts);
  const { renderPdfToPageImages } = await import('./pdf-page-renderer');
  try {
    const pages = await renderPdfToPageImages(blob);
    return { blob, pages };
  } catch {
    return { blob, pages: [] };
  }
}
