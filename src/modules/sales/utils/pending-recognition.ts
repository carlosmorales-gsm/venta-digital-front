import type { CatalogCliente } from './odoo-clientes';
import type { ReconocimientoVenta } from '../types/sale-form';

const KEY = 'vd.pendingRecognition';

export type PendingRecognition = {
  cliente: CatalogCliente;
  ventas: ReconocimientoVenta[];
};

export function setPendingRecognition(payload: PendingRecognition) {
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function takePendingRecognition(): PendingRecognition | null {
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingRecognition;
    if (!parsed?.cliente?.id) return null;
    return {
      cliente: parsed.cliente,
      ventas: Array.isArray(parsed.ventas) ? parsed.ventas : [],
    };
  } catch {
    return null;
  }
}
