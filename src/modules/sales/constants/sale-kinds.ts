export type SaleKind =
  | 'NUEVA'
  | 'RECONOCIMIENTO'
  | 'MEJORA'
  | 'MINORIA'
  | 'FUNEPET';

export const SALE_KINDS: Array<{
  value: SaleKind;
  label: string;
}> = [
  { value: 'NUEVA', label: 'Nueva' },
  { value: 'RECONOCIMIENTO', label: 'Reconocimiento de saldo' },
  { value: 'MEJORA', label: 'Mejora' },
  { value: 'MINORIA', label: 'Minoría' },
  { value: 'FUNEPET', label: 'Funepet' },
];

const KIND_TO_ESTATUS: Record<SaleKind, string> = {
  NUEVA: 'ACTIVO',
  RECONOCIMIENTO: 'REACTIVACION',
  MEJORA: 'MEJORA',
  MINORIA: 'MINORIA',
  FUNEPET: 'ACTIVO',
};

const ESTATUS_TO_KIND: Record<string, SaleKind> = {
  ACTIVO: 'NUEVA',
  REACTIVACION: 'RECONOCIMIENTO',
  MEJORA: 'MEJORA',
  MINORIA: 'MINORIA',
};

export function isSaleKind(value: unknown): value is SaleKind {
  return (
    value === 'NUEVA' ||
    value === 'RECONOCIMIENTO' ||
    value === 'MEJORA' ||
    value === 'MINORIA' ||
    value === 'FUNEPET'
  );
}

export function parseSaleKind(value: unknown): SaleKind | null {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase();
  return isSaleKind(raw) ? raw : null;
}

export function saleKindToEstatus(kind: SaleKind): string {
  return KIND_TO_ESTATUS[kind];
}

export function saleKindFromEstatus(estatus: string | null | undefined): SaleKind {
  const key = String(estatus ?? '')
    .trim()
    .toUpperCase();
  return ESTATUS_TO_KIND[key] ?? 'NUEVA';
}

export function saleNeedsOriginSales(
  kind: SaleKind | string | null | undefined,
): boolean {
  const parsed = parseSaleKind(kind);
  return (
    parsed === 'RECONOCIMIENTO' ||
    parsed === 'MEJORA' ||
    parsed === 'MINORIA'
  );
}

export function saleKindLabel(kind: SaleKind | string | null | undefined): string {
  const parsed = parseSaleKind(kind);
  if (!parsed) return 'Nueva';
  return SALE_KINDS.find((item) => item.value === parsed)?.label ?? 'Nueva';
}
