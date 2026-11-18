import { http, tokenStorage } from '../../../shared/api/http';

/** Código de sale.order.origin. Ese código es el que se guarda en origenVenta. */
export type SaleOriginOption = {
  value: string;
  label: string;
};

type OriginRow = {
  code?: string;
  name?: string;
};

let memory: SaleOriginOption[] = [];
let inflight: Promise<SaleOriginOption[]> | null = null;

function asOptions(rows: unknown): SaleOriginOption[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const item = row as OriginRow;
      return {
        value: String(item.code || '').trim(),
        label: String(item.name || '').trim(),
      };
    })
    .filter((row) => row.value && row.label);
}

export function saleOriginOptions(): SaleOriginOption[] {
  return memory;
}

export function saleOriginLabel(value: string | null | undefined): string {
  const code = String(value || '').trim();
  if (!code) return '';
  return memory.find((row) => row.value === code)?.label || code;
}

/** Lee el catálogo activo de Odoo (sale.order.origin). */
export function loadSaleOrigins(): Promise<SaleOriginOption[]> {
  if (memory.length) return Promise.resolve(memory);
  if (inflight) return inflight;
  inflight = http
    .get<OriginRow[]>(
      tokenStorage.getAccess()
        ? '/odoo/origenes-venta'
        : '/public/sign/origenes-venta',
      { skipGlobalLoading: true },
    )
    .then(({ data }) => {
      const rows = asOptions(data);
      if (rows.length) memory = rows;
      return memory;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
