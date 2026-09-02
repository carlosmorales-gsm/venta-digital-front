/** Regímenes del SAT que ya usa Odoo en `res.partner.l10n_mx_edi_fiscal_regime`. */
export const FISCAL_REGIMEN_CARTA = [
  { value: '601', label: '601 General de Ley Personas Morales' },
  { value: '605', label: '605 Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { value: '606', label: '606 Arrendamiento' },
  { value: '612', label: '612 Personas Físicas con Actividades Empresariales y Profesionales' },
  { value: '626', label: '626 Régimen Simplificado de Confianza' },
] as const;

export const FISCAL_REGIMEN_OTROS = [
  { value: '603', label: '603 Personas Morales con Fines no Lucrativos' },
  { value: '607', label: '607 Régimen de Enajenación o Adquisición de Bienes' },
  { value: '608', label: '608 Demás ingresos' },
  { value: '610', label: '610 Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { value: '611', label: '611 Ingresos por Dividendos (socios y accionistas)' },
  { value: '614', label: '614 Ingresos por intereses' },
  { value: '615', label: '615 Régimen de los ingresos por obtención de premios' },
  { value: '616', label: '616 Sin obligaciones fiscales' },
  { value: '620', label: '620 Sociedades Cooperativas de Producción' },
  { value: '621', label: '621 Incorporación Fiscal' },
  { value: '622', label: '622 Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { value: '623', label: '623 Opcional para Grupos de Sociedades' },
  { value: '624', label: '624 Coordinados' },
  { value: '625', label: '625 Actividades Empresariales con Plataformas Tecnológicas' },
] as const;

export const FISCAL_REGIMEN_OTRO = 'OTRO';

export const TIPO_PERSONA_OPTIONS = [
  { value: 'FISICA', label: 'Persona física' },
  { value: 'MORAL', label: 'Persona moral' },
] as const;

const ALL_REGIMEN_CODES = new Set<string>([
  ...FISCAL_REGIMEN_CARTA.map((r) => r.value),
  ...FISCAL_REGIMEN_OTROS.map((r) => r.value),
]);

export function isKnownRegimen(code: string): boolean {
  return ALL_REGIMEN_CODES.has(code);
}

export function regimenSelectValue(code: string): string {
  if (!code) return '';
  if (code === FISCAL_REGIMEN_OTRO) return FISCAL_REGIMEN_OTRO;
  return FISCAL_REGIMEN_CARTA.some((r) => r.value === code)
    ? code
    : FISCAL_REGIMEN_OTRO;
}

/** RFC SAT: 12 (moral) o 13 (física). */
export function isValidRfc(raw: string): boolean {
  const rfc = raw.trim().toUpperCase();
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc);
}
