import { GState, jsPDF } from 'jspdf';
import { saleCompanyName } from '../constants/sale-companies';
import {
  fullName,
  hasIneDocumentos,
  isSignedSaleStatus,
  type SaleFormData,
} from '../types/sale-form';
import type { NoInvoiceConsentOpts } from './no-invoice-consent-pdf';

/** Membrete del formato (1436×2048). El alto conserva esa proporción. */
const PAGE_W = 595.28;
const PAGE_H = 849.05;
const ML = 50;
const CONTENT_W = PAGE_W - ML * 2;
const INK: [number, number, number] = [20, 22, 24];

const MESES = [
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

function parseDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return { day: '', month: '', year: '' };
  return {
    day: String(Number(m[3])),
    month: MESES[Number(m[2]) - 1] || '',
    year: m[1],
  };
}

function loadFondo(): Promise<string | null> {
  return fetch('/forms/funepet-no-factura-fondo.jpg')
    .then(async (res) => {
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => null);
}

function drawParagraph(doc: Doc, text: string, x: number, y: number, lineH: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineH;
}

function checkBox(doc: Doc, on: boolean, x: number, y: number, label: string) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  doc.rect(x, y, 9, 9);
  if (on) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('X', x + 1.8, y + 7.1);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(label, x + 13, y + 7.4);
}

function drawDraft(doc: Doc) {
  const ys = [PAGE_H * 0.34, PAGE_H * 0.55, PAGE_H * 0.74];
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.12 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(58);
  doc.setTextColor(120, 128, 136);
  for (const y of ys) {
    doc.text('BORRADOR', PAGE_W / 2, y, {
      align: 'center',
      baseline: 'middle',
      angle: 32,
    });
  }
  doc.restoreGraphicsState();
}

function drawLetter(doc: Doc, form: SaleFormData, fondo: string | null) {
  if (fondo) {
    doc.addImage(fondo, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
  }

  const cliente = fullName(form.contacto);
  const company = saleCompanyName('PLAN_FUTURO');
  const date = parseDate(form.meta.fecha);
  const hasIne = hasIneDocumentos(form.documentos);

  let y = 188;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const fecha = date.day
    ? `Culiacán, Sinaloa ${date.day} de ${date.month} del ${date.year}.`
    : 'Culiacán, Sinaloa _____ de _______________ del _______.';
  doc.text(fecha, ML, y);

  y += 28;
  doc.setFont('helvetica', 'bold');
  doc.text('NOMBRE DEL CLIENTE:', ML, y);
  const labelW = doc.getTextWidth('NOMBRE DEL CLIENTE:');
  doc.setFont('helvetica', 'normal');
  if (cliente) {
    doc.text(cliente, ML + labelW + 8, y, { maxWidth: CONTENT_W - labelW - 8 });
  } else {
    doc.text('________________________________', ML + labelW + 8, y);
  }

  y += 28;
  doc.text('Identificación:', ML, y);
  checkBox(doc, hasIne, ML + 96, y - 8, 'INE');
  checkBox(doc, false, ML + 168, y - 8, 'PASAPORTE');
  checkBox(doc, false, ML + 290, y - 8, 'LICENCIA DE CONDUCIR');

  y += 28;
  doc.setFontSize(11);
  doc.text('Presente.', ML, y);

  y += 26;
  const quien = cliente || '________________________________';
  y = drawParagraph(
    doc,
    `Por medio de la presente, yo ${quien} manifiesto a ${company} que tengo claro y entendido que, ACEPTO NO PROPORCIONAR DATOS FISCALES para la recepción de la factura que ampara mi compra, por lo que acepto y autorizo se emita RFC genérico (XAXX010101000), renunciando al derecho de solicitar facturación una vez realizada la misma. Que he realizado las preguntas que me surgieron sobre la solicitud de documento Fiscal y que he recibido información suficiente sobre el mismo.`,
    ML,
    y,
    15,
  );

  y += 16;
  y = drawParagraph(
    doc,
    'En mi propio derecho doy mi consentimiento que NO SOLICITARÉ SE INCLUYAN DATOS FISCALES A MI FACTURA (RFC) por el servicio prestado, por así convenir a mis intereses.',
    ML,
    y,
    15,
  );

  y += 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('ATENTAMENTE.', PAGE_W / 2, y, { align: 'center' });

  const firma = form.documentos.firmaCliente;
  const lineY = y + 72;
  if (firma?.dataBase64?.trim()) {
    const dataUrl = firma.dataBase64.startsWith('data:')
      ? firma.dataBase64
      : `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`;
    try {
      doc.addImage(dataUrl, 'PNG', PAGE_W / 2 - 70, y + 12, 140, 42, undefined, 'FAST');
    } catch {
      /* ignore */
    }
  }
  if (cliente) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(cliente, PAGE_W / 2, lineY - 6, { align: 'center', maxWidth: 280 });
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(PAGE_W / 2 - 130, lineY, PAGE_W / 2 + 130, lineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CLIENTE', PAGE_W / 2, lineY + 16, { align: 'center' });
}

export async function buildFunepetNoInvoicePdf(
  form: SaleFormData,
  opts?: NoInvoiceConsentOpts,
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });
  const fondo = await loadFondo();
  drawLetter(doc, form, fondo);
  const status = String(opts?.status || '').toUpperCase();
  const draft =
    !isSignedSaleStatus(status) &&
    !form.documentos?.firmaCliente?.dataBase64?.trim();
  if (draft) drawDraft(doc);
  return doc.output('blob');
}
