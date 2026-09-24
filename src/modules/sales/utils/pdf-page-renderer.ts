import type { SaleAttachment } from '../types/sale-form';
import { attachmentPreviewSrc } from './attachment-preview';

let workerReady: Promise<void> | null = null;

function isTabletLike() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
}

async function ensurePdfWorker() {
  if (!workerReady) {
    workerReady = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    })();
  }
  await workerReady;
}

function computeScale(
  pageWidth: number,
  requested?: number,
  purpose: 'preview' | 'compose' = 'compose',
) {
  const tablet = isTabletLike();
  const dpr = window.devicePixelRatio || 1;
  if (purpose === 'preview') {
    const maxPixelWidth = tablet ? 1800 : 2600;
    let scale =
      requested ??
      (tablet
        ? Math.min(2.6, Math.max(1.8, dpr * 1.5))
        : Math.min(3.4, Math.max(2.4, dpr * 1.85)));
    if (pageWidth * scale > maxPixelWidth) {
      scale = maxPixelWidth / pageWidth;
    }
    return Math.max(1.8, scale);
  }
  const maxPixelWidth = tablet ? 880 : 1280;
  let scale =
    requested ??
    (tablet
      ? Math.min(1.25, Math.max(1, dpr * 0.85))
      : Math.min(2, Math.max(1.15, dpr * 1.15)));
  if (pageWidth * scale > maxPixelWidth) {
    scale = maxPixelWidth / pageWidth;
  }
  return Math.max(1, scale);
}

async function renderPages(
  data: Uint8Array,
  opts?: { scale?: number; purpose?: 'preview' | 'compose' },
): Promise<string[]> {
  await ensurePdfWorker();
  const pdfjs = await import('pdfjs-dist');
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  const purpose = opts?.purpose ?? 'compose';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const pageScale = computeScale(base.width, opts?.scale, purpose);
    const viewport = page.getViewport({ scale: pageScale });
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
      intent: purpose === 'preview' ? 'print' : 'display',
    } as Parameters<typeof page.render>[0]).promise;
    pages.push(
      purpose === 'preview'
        ? canvas.toDataURL('image/jpeg', 0.97)
        : canvas.toDataURL('image/jpeg', 0.92),
    );
  }

  return pages;
}

export async function renderPdfToPageImages(
  input: Blob | Uint8Array,
  opts?: { scale?: number; purpose?: 'preview' | 'compose' },
): Promise<string[]> {
  const data =
    input instanceof Blob ? new Uint8Array(await input.arrayBuffer()) : input;

  try {
    return await renderPages(data, opts);
  } catch {
    return renderPages(data, { scale: 1, purpose: opts?.purpose });
  }
}

export function pdfBlobViewUrl(blobUrl: string): string {
  return `${blobUrl}#navpanes=0&toolbar=0&view=FitH`;
}

export async function attachmentPdfBytes(
  att: SaleAttachment,
): Promise<Uint8Array | null> {
  const src = attachmentPreviewSrc(att);
  if (!src?.startsWith('data:')) return null;
  const comma = src.indexOf(',');
  if (comma < 0) return null;
  const b64 = src.slice(comma + 1);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
