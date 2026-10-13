import { jsPDF } from 'jspdf';
import { saleNeedsOriginSales } from '../constants/sale-kinds';
import { fillOriginFolioSolicitud } from './odoo-clientes';
import {
  fullName,
  isSignedSaleStatus,
  type ReconocimientoVenta,
  type SaleFormData,
} from '../types/sale-form';

const TEMPLATE = '/forms/for-gsm-cmr-09.pdf';

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

export type NoStationeryOpts = {
  saleId?: number | null;
  status?: string;
  /** Contrato anterior que se cancela. Un formato por venta seleccionada. */
  originId?: number | null;
};

function v(text?: string | null) {
  return (text ?? '').trim();
}

export function isDraftNoStationery(
  form: SaleFormData,
  opts?: NoStationeryOpts,
): boolean {
  if (opts?.status && isSignedSaleStatus(opts.status)) return false;
  return !v(form.documentos.firmaCliente?.dataBase64);
}

function parseDate(iso: string) {
  const raw = v(iso);
  const isoM = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoM) {
    return {
      day: String(Number(isoM[3])),
      month: MESES[Number(isoM[2]) - 1] || '',
      year: isoM[1],
    };
  }
  const latam = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (latam) {
    return {
      day: String(Number(latam[1])),
      month: MESES[Number(latam[2]) - 1] || '',
      year: latam[3],
    };
  }
  return { day: '', month: '', year: '' };
}

function selectedOrigin(
  form: SaleFormData,
  originId?: number | null,
): ReconocimientoVenta | null {
  const origins = form.meta.reconocimientoVentas ?? [];
  if (originId != null) {
    return origins.find((item) => item.id === originId) ?? null;
  }
  return origins.length === 1 ? origins[0] : null;
}

let workerReady: Promise<void> | null = null;

async function ensurePdfWorker() {
  if (!workerReady) {
    workerReady = (async () => {
      const pdfjs = await import('pdfjs-dist');
      if (import.meta.env.DEV) {
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        return;
      }
      const src = `${import.meta.env.BASE_URL}pdf.worker.min.js`;
      const res = await fetch(src);
      const buf = await res.arrayBuffer();
      pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
        new Blob([buf], { type: 'application/javascript' }),
      );
    })();
  }
  await workerReady;
}

function paint(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  scale: number,
  size = 10,
  align: 'left' | 'center' = 'left',
) {
  const value = v(text);
  if (!value) return;
  ctx.fillStyle = '#14181c';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let s = size;
  ctx.font = `600 ${s * scale}px Helvetica, Arial, sans-serif`;
  while (s > 7 && ctx.measureText(value).width > maxW * scale) {
    s -= 0.3;
    ctx.font = `600 ${s * scale}px Helvetica, Arial, sans-serif`;
  }
  const width = ctx.measureText(value).width;
  const drawX = align === 'center' ? x * scale - width / 2 : x * scale;
  ctx.fillText(value, drawX, y * scale);
}

function paintWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#787878';
  ctx.font = `700 ${Math.round(width * 0.09)}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-0.55);
  ctx.fillText('BORRADOR', 0, 0);
  ctx.restore();
}

async function loadSignature(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function buildNoStationeryPdf(
  form: SaleFormData,
  opts?: NoStationeryOpts,
): Promise<Blob> {
  const res = await fetch(TEMPLATE);
  if (!res.ok) {
    throw new Error('No se encontró el formato FOR-GSM-CMR-09');
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  await ensurePdfWorker();
  const pdfjs = await import('pdfjs-dist');
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  } as Parameters<typeof page.render>[0]).promise;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 650 * scale, canvas.width, canvas.height - 650 * scale);

  const letterDate = parseDate(form.meta.fecha);
  await fillOriginFolioSolicitud(
    form.meta.reconocimientoVentas ?? [],
    form.meta.tipoVenta,
  );
  const origin = selectedOrigin(form, opts?.originId);
  const originDate = parseDate(origin?.dateOrder ?? '');
  const cliente = fullName(form.contacto);
  const firma = v(form.documentos.firmaCliente?.dataBase64);
  const firmaUrl = firma
    ? firma.startsWith('data:')
      ? firma
      : `data:${form.documentos.firmaCliente?.mime || 'image/png'};base64,${firma}`
    : '';
  const firmaImg = firmaUrl ? await loadSignature(firmaUrl) : null;

  paint(ctx, letterDate.day, 304, 110, 28, scale, 10);
  paint(ctx, letterDate.month, 353, 110, 84, scale, 10);
  paint(ctx, letterDate.year, 478, 110, 42, scale, 10);
  paint(ctx, v(origin?.folio), 179, 258, 100, scale, 9);
  paint(ctx, v(origin?.folioSolicitud), 344, 258, 52, scale, 9);
  paint(ctx, originDate.day, 101, 271, 30, scale, 10);
  paint(ctx, originDate.month, 151, 271, 100, scale, 10);
  paint(ctx, originDate.year, 295, 271, 42, scale, 10);
  if (firmaImg) {
    const sw = 110 * scale;
    const sh = 32 * scale;
    ctx.drawImage(firmaImg, 192.6 * scale - sw / 2, 546 * scale, sw, sh);
  }
  paint(ctx, cliente, 192.6, 578, 180, scale, 8, 'center');
  paint(ctx, v(form.pago.nombreAsesor).toUpperCase(), 432, 578, 170, scale, 8, 'center');
  if (isDraftNoStationery(form, opts)) {
    paintWatermark(ctx, canvas.width, canvas.height);
  }

  const doc = new jsPDF({
    unit: 'pt',
    format: [base.width, base.height],
    compress: true,
  });
  doc.addImage(
    canvas.toDataURL('image/jpeg', 0.92),
    'JPEG',
    0,
    0,
    base.width,
    base.height,
  );
  return doc.output('blob');
}

export async function buildNoStationeryBundle(
  form: SaleFormData,
  opts?: NoStationeryOpts,
): Promise<{ blob: Blob; pages: string[] }> {
  const blob = await buildNoStationeryPdf(form, opts);
  const { renderPdfToPageImages } = await import('./pdf-page-renderer');
  try {
    const pages = await renderPdfToPageImages(blob);
    return { blob, pages };
  } catch {
    return { blob, pages: [] };
  }
}

export function saleUsesNoStationery(form: SaleFormData): boolean {
  return saleNeedsOriginSales(form.meta.tipoVenta);
}
