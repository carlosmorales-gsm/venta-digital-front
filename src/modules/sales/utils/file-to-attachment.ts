import type { SaleAttachment } from '../types/sale-form';
import { isAllowedUploadFile } from './attachment-preview';

/** Fotos de celular suelen pesar más; tope por archivo. */
export const MAX_UPLOAD_MB = 5;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/bmp,application/pdf,.pdf';

export const UPLOAD_ACCEPT = ACCEPT;

export function uploadSizeErrorMessage(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `La foto o archivo supera el máximo de ${MAX_UPLOAD_MB} MB. Elige uno más ligero.`;
  }
  return null;
}

export async function fileToAttachment(file: File): Promise<SaleAttachment> {
  if (!isAllowedUploadFile(file)) {
    throw new Error('Solo se permiten imágenes (JPG, PNG, WEBP, GIF) o PDF');
  }
  const sizeErr = uploadSizeErrorMessage(file);
  if (sizeErr) {
    throw new Error(sizeErr);
  }

  let mime = file.type || '';
  if (!mime) {
    mime = file.name.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'image/jpeg';
  }

  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    mime,
    dataBase64,
  };
}
