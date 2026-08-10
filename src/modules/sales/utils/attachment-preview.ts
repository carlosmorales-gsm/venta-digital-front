import type { SaleAttachment, SaleFormData } from '../types/sale-form';

export type AttachmentKind =
  | 'ine'
  | 'comprobanteDomicilio'
  | 'ticketPago'
  | 'firmaCliente';

export type AttachmentListItem = {
  kind: AttachmentKind;
  label: string;
  attachment: SaleAttachment;
};

const LABELS: Record<AttachmentKind, string> = {
  ine: 'INE',
  comprobanteDomicilio: 'Comprobante de domicilio',
  ticketPago: 'Ticket de pago',
  firmaCliente: 'Firma del cliente',
};

export function isAllowedUploadFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/pdf') return true;
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|pdf)$/.test(name);
}

export function attachmentPreviewSrc(att: SaleAttachment): string | null {
  const raw = att.dataBase64?.trim();
  if (raw) {
    if (raw.startsWith('data:')) return raw;
    const mime = att.mime || 'application/octet-stream';
    return `data:${mime};base64,${raw}`;
  }
  if (att.driveFileUrl?.trim()) return att.driveFileUrl.trim();
  return null;
}

export function isPdfAttachment(att: SaleAttachment): boolean {
  const mime = (att.mime || '').toLowerCase();
  if (mime.includes('pdf')) return true;
  return att.name.toLowerCase().endsWith('.pdf');
}

export function isImageAttachment(att: SaleAttachment): boolean {
  const mime = (att.mime || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(att.name);
}

export function listSaleAttachments(form: SaleFormData): AttachmentListItem[] {
  const docs = form.documentos;
  const keys: AttachmentKind[] = [
    'ine',
    'comprobanteDomicilio',
    'ticketPago',
    'firmaCliente',
  ];
  const items: AttachmentListItem[] = [];
  for (const kind of keys) {
    const attachment = docs[kind];
    if (!attachment) continue;
    if (!attachment.dataBase64?.trim() && !attachment.driveFileUrl?.trim()) {
      continue;
    }
    items.push({
      kind,
      label: LABELS[kind],
      attachment,
    });
  }
  return items;
}
