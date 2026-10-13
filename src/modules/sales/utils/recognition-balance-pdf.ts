import { jsPDF } from 'jspdf';
import { saleNeedsOriginSales } from '../constants/sale-kinds';
import {
  documentContractFolio,
  fullName,
  isSignedSaleStatus,
  type ReconocimientoVenta,
  type SaleFormData,
} from '../types/sale-form';

const TEMPLATE = '/forms/for-gsm-cmr-08.pdf';

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

export type RecognitionBalanceOpts = {
  saleId?: number | null;
  status?: string;
  /** Cotización anterior. Un formato por venta seleccionada. */
  originId?: number | null;
};

function v(text?: string | null) {
  return (text ?? '').trim();
}

export function isDraftRecognitionBalance(
  form: SaleFormData,
  opts?: RecognitionBalanceOpts,
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
      short: `${isoM[3]}/${isoM[2]}/${isoM[1]}`,
    };
  }
  const latam = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (latam) {
    return {
      day: String(Number(latam[1])),
      month: MESES[Number(latam[2]) - 1] || '',
      year: latam[3],
      short: `${latam[1]}/${latam[2]}/${latam[3]}`,
    };
  }
  const now = new Date();
  return {
    day: String(now.getDate()),
    month: MESES[now.getMonth()] ?? '',
    year: String(now.getFullYear()),
    short: '',
  };
}

function money(amount: number) {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
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
  size = 11,
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
  const drawX =
    align === 'center' ? x * scale - width / 2 : x * scale;
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

export async function buildRecognitionBalancePdf(
  form: SaleFormData,
  opts?: RecognitionBalanceOpts,
): Promise<Blob> {
  const res = await fetch(TEMPLATE);
  if (!res.ok) {
    throw new Error('No se encontró el formato FOR-GSM-CMR-08');
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  await ensurePdfWorker();
  const pdfjs = await import('pdfjs-dist');
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const date = parseDate(form.meta.fecha);
  const origin = selectedOrigin(form, opts?.originId);
  const contratos = v(origin?.folio);
  const fechas = origin ? parseDate(origin.dateOrder).short : '';
  const titularOrigen = v(origin?.partnerName);
  const pagado = Number(origin?.paidAmount ?? origin?.saldo) || 0;
  const aplica = documentContractFolio(
    form.meta.contrato,
    form.meta.folioSolicitud,
    opts?.saleId,
  );
  const cliente = fullName(form.contacto);
  const firma = v(form.documentos.firmaCliente?.dataBase64);
  const firmaUrl = firma
    ? firma.startsWith('data:')
      ? firma
      : `data:${form.documentos.firmaCliente?.mime || 'image/png'};base64,${firma}`
    : '';
  const firmaImg = firmaUrl ? await loadSignature(firmaUrl) : null;
  const draft = isDraftRecognitionBalance(form, opts);
  const asesor = v(form.pago.nombreAsesor);

  let doc: jsPDF | null = null;
  const pageCount = Math.min(1, pdf.numPages);

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
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

    if (i === 1) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(268 * scale, 808 * scale, 62 * scale, 22 * scale);
      paint(ctx, date.day, 318, 128, 40, scale, 11);
      paint(ctx, date.month, 382, 128, 88, scale, 11);
      paint(ctx, contratos, 230, 370, 290, scale, 10);
      paint(ctx, fechas, 230, 394, 290, scale, 10);
      paint(ctx, titularOrigen || cliente, 230, 418, 290, scale, 10);
      paint(ctx, v(form.contacto.curp), 230, 443, 290, scale, 10);
      paint(ctx, origin ? money(pagado) : '', 230, 468, 290, scale, 10);
      paint(ctx, aplica, 230, 500, 290, scale, 10);
      if (firmaImg) {
        const sw = 120 * scale;
        const sh = 36 * scale;
        ctx.drawImage(
          firmaImg,
          176.5 * scale - sw / 2,
          612 * scale,
          sw,
          sh,
        );
      }
      paint(ctx, cliente, 176.5, 650, 200, scale, 8, 'center');
      paint(ctx, asesor.toUpperCase(), 421, 650, 200, scale, 8, 'center');
    }
    if (draft) paintWatermark(ctx, canvas.width, canvas.height);

    if (!doc) {
      doc = new jsPDF({
        unit: 'pt',
        format: [base.width, base.height],
        compress: true,
      });
    } else {
      doc.addPage([base.width, base.height]);
    }
    doc.addImage(
      canvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      0,
      0,
      base.width,
      base.height,
    );
  }

  if (!doc) throw new Error('El formato FOR-GSM-CMR-08 no tiene páginas');
  return doc.output('blob');
}

export async function buildRecognitionBalanceBundle(
  form: SaleFormData,
  opts?: RecognitionBalanceOpts,
): Promise<{ blob: Blob; pages: string[] }> {
  const blob = await buildRecognitionBalancePdf(form, opts);
  const { renderPdfToPageImages } = await import('./pdf-page-renderer');
  try {
    const pages = await renderPdfToPageImages(blob);
    return { blob, pages };
  } catch {
    return { blob, pages: [] };
  }
}

export function saleUsesRecognitionLetter(form: SaleFormData): boolean {
  return saleNeedsOriginSales(form.meta.tipoVenta);
}
