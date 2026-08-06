import type { SaleAttachment } from '../types/sale-form';

const MAX_BYTES = 1.5 * 1024 * 1024;

export async function fileToAttachment(file: File): Promise<SaleAttachment> {
  if (file.size > MAX_BYTES) {
    throw new Error('El archivo no puede superar 1.5 MB');
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
    mime: file.type || 'application/octet-stream',
    dataBase64,
  };
}
