import type { PlanKind } from '../types/sale-form';

/** Razón social en carátula (res.company Odoo: 1 Parque · 2 Plan a futuro). */
export function saleCompanyName(planKind: PlanKind | string): string {
  const k = String(planKind || '').toUpperCase();
  if (k === 'PARQUE') {
    return 'SAN MARTÍN GRUPO DESARROLLADOR INMOBILIARIO S.A. DE C.V.';
  }
  return 'INHUMACIONES ABC S.A. DE C.V.';
}
