import { jsPDF } from 'jspdf';
import type { SaleAttachment } from '../types/sale-form';
import { renderPdfToPageImages } from './pdf-page-renderer';

const PAGE_W = 612;
const PAGE_H = 792;
const M = 36;
const INK: [number, number, number] = [26, 34, 42];

function rawBase64(att: SaleAttachment) {
  const raw = (att.dataBase64 || '').trim();
  return raw.includes(',') ? raw.split(',')[1]! : raw;
}

function isPdfAtt(att: SaleAttachment) {
  const mime = (att.mime || '').toLowerCase();
  if (mime.includes('pdf')) return true;
  return att.name.toLowerCase().endsWith('.pdf');
}

function bytesFromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function attachmentToImageDataUrl(att: SaleAttachment): Promise<string> {
  if (isPdfAtt(att)) {
    const pages = await renderPdfToPageImages(bytesFromBase64(rawBase64(att)));
    if (!pages[0]) throw new Error('No se pudo leer el PDF de la tarjeta');
    return compressImageDataUrl(pages[0]);
  }
  const raw = (att.dataBase64 || '').trim();
  const src = raw.startsWith('data:')
    ? raw
    : `data:${att.mime || 'image/jpeg'};base64,${raw}`;
  return compressImageDataUrl(src);
}

async function compressImageDataUrl(src: string, maxSide = 1600): Promise<string> {
  const size = await measureImage(src);
  const scale = Math.min(1, maxSide / Math.max(size.w, size.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size.w * scale));
  canvas.height = Math.max(1, Math.round(size.h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  const img = await loadImage(src);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen de la tarjeta'));
    img.src = src;
  });
}

function measureImage(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        w: img.naturalWidth || 1,
        h: img.naturalHeight || 1,
      });
    img.onerror = () => reject(new Error('No se pudo leer la imagen de la tarjeta'));
    img.src = src;
  });
}

function fitBox(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
) {
  const ratio = Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * ratio;
  const h = srcH * ratio;
  return {
    w,
    h,
    x: (boxW - w) / 2,
    y: (boxH - h) / 2,
  };
}

function imageFormat(src: string): 'PNG' | 'JPEG' {
  const head = src.slice(0, 32).toLowerCase();
  if (head.includes('image/png') || head.includes('image/webp')) return 'PNG';
  return 'JPEG';
}

export type TwoSidesPdfLabels = {
  title: string;
  frontLabel?: string;
  backLabel?: string;
};

export async function buildTwoSidesPdf(
  frente: SaleAttachment,
  reverso: SaleAttachment,
  labels: TwoSidesPdfLabels,
): Promise<Blob> {
  const [frontSrc, backSrc] = await Promise.all([
    attachmentToImageDataUrl(frente),
    attachmentToImageDataUrl(reverso),
  ]);
  const [frontSize, backSize] = await Promise.all([
    measureImage(frontSrc),
    measureImage(backSrc),
  ]);

  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(labels.title, PAGE_W / 2, 28, { align: 'center' });

  const colW = PAGE_W - M * 2;
  const halfH = (PAGE_H - 56) / 2;
  const frontLabel = labels.frontLabel ?? 'FRENTE';
  const backLabel = labels.backLabel ?? 'REVERSO';
  const boxes = [
    { label: frontLabel, src: frontSrc, size: frontSize, top: 40 },
    { label: backLabel, src: backSrc, size: backSize, top: 40 + halfH },
  ];

  for (const box of boxes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(box.label, M, box.top + 12);
    const areaY = box.top + 18;
    const areaH = halfH - 28;
    const fit = fitBox(box.size.w, box.size.h, colW, areaH);
    const format = imageFormat(box.src);
    try {
      doc.addImage(box.src, format, M + fit.x, areaY + fit.y, fit.w, fit.h);
    } catch {
      doc.addImage(
        box.src,
        format === 'PNG' ? 'JPEG' : 'PNG',
        M + fit.x,
        areaY + fit.y,
        fit.w,
        fit.h,
      );
    }
  }

  return doc.output('blob');
}

export async function buildCardSidesPdf(
  frente: SaleAttachment,
  reverso: SaleAttachment,
): Promise<Blob> {
  return buildTwoSidesPdf(frente, reverso, {
    title: 'TARJETA DE DOMICILIACIÓN',
  });
}

export async function buildIneSidesPdf(
  frente: SaleAttachment,
  reverso: SaleAttachment,
): Promise<Blob> {
  return buildTwoSidesPdf(frente, reverso, { title: 'INE' });
}

async function buildTwoSidesAttachment(
  frente: SaleAttachment,
  reverso: SaleAttachment,
  buildPdf: (f: SaleAttachment, r: SaleAttachment) => Promise<Blob>,
  name: string,
): Promise<SaleAttachment> {
  const blob = await buildPdf(frente, reverso);
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    name,
    mime: 'application/pdf',
    dataBase64: btoa(binary),
  };
}

export async function buildCardSidesAttachment(
  frente: SaleAttachment,
  reverso: SaleAttachment,
  name = 'tarjeta-ambos-lados.pdf',
): Promise<SaleAttachment> {
  return buildTwoSidesAttachment(frente, reverso, buildCardSidesPdf, name);
}

export async function buildIneSidesAttachment(
  frente: SaleAttachment,
  reverso: SaleAttachment,
  name = 'ine-ambos-lados.pdf',
): Promise<SaleAttachment> {
  return buildTwoSidesAttachment(frente, reverso, buildIneSidesPdf, name);
}

async function buildTwoSidesBundle(
  frente: SaleAttachment,
  reverso: SaleAttachment,
  buildPdf: (f: SaleAttachment, r: SaleAttachment) => Promise<Blob>,
) {
  const blob = await buildPdf(frente, reverso);
  const pages = await renderPdfToPageImages(blob);
  return { blob, pages };
}

export async function buildCardSidesBundle(
  frente: SaleAttachment,
  reverso: SaleAttachment,
) {
  return buildTwoSidesBundle(frente, reverso, buildCardSidesPdf);
}

export async function buildIneSidesBundle(
  frente: SaleAttachment,
  reverso: SaleAttachment,
) {
  return buildTwoSidesBundle(frente, reverso, buildIneSidesPdf);
}
