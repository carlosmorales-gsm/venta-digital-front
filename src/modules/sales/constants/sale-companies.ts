import type { PlanKind } from '../types/sale-form';

/** Razón social en carátula (res.company Odoo: 1 Parque · 2 Plan a futuro). */
export function saleCompanyName(planKind: PlanKind | string): string {
  const k = String(planKind || '').toUpperCase();
  if (k === 'PARQUE') {
    return 'SAN MARTÍN GRUPO DESARROLLADOR INMOBILIARIO S.A. DE C.V.';
  }
  return 'INHUMACIONES ABC S.A. DE C.V.';
}

export type SaleCompanyLetter = {
  /** Líneas grandes del recuadro derecho. */
  boxTitle: string[];
  address: string[];
  phone: string;
  rfcDisplay: string;
  /** Nombre corto en el texto legal. */
  legalName: string;
  legalRfc: string;
};

/** Datos de la carta de autorización (domiciliación). */
export function saleCompanyLetter(
  planKind: PlanKind | string,
): SaleCompanyLetter {
  const k = String(planKind || '').toUpperCase();
  if (k === 'PARQUE') {
    return {
      boxTitle: [
        'San Martín Grupo Desarrollador',
        'Inmobiliario, S.A de C.V',
      ],
      address: [
        'RUBÍ NO. 836 SUR COL. GUADALUPE',
        'CULIACÁN, SINALOA. C.P 80220',
      ],
      phone: 'TEL. 6 LÍNEAS (667) 716-59-39, 716-14-59',
      rfcDisplay: 'RFC. SMG-930315-9Z2',
      legalName: 'SAN MARTIN GRUPO DESARROLLADOR INMOBILIARIO',
      legalRfc: 'SMG9303159Z2',
    };
  }
  return {
    boxTitle: ['INHUMACIONES ABC', 'S.A de C.V'],
    address: [
      'BLVD. EMILIANO ZAPATA PTE. 145, GUADALUPE',
      'CULIACÁN, SINALOA. C.P 80220.',
    ],
      phone: 'TEL. 6 LÍNEAS (667) 716-59-39, 716-14-59',
      rfcDisplay: 'RFC. IAB081111ID6',
    legalName: 'INHUMACIONES ABC',
    legalRfc: 'IAB081111ID6',
  };
}
