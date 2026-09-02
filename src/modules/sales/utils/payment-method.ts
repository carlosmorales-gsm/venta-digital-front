export type TipoCobranza = 'VENTANILLA' | 'DOMICILIADO' | 'NOMINA' | 'OTRO';

export const TIPO_COBRANZA_OPTIONS: Array<{
  value: TipoCobranza;
  label: string;
  hint: string;
}> = [
  {
    value: 'DOMICILIADO',
    label: 'Domiciliado',
    hint: 'Cargo automático a tarjeta',
  },
  {
    value: 'NOMINA',
    label: 'Nómina',
    hint: 'Descuento por convenio',
  },
  {
    value: 'OTRO',
    label: 'Otro',
    hint: 'Otro esquema de cobro',
  },
];

export function normalizeTipoCobranza(value: string): TipoCobranza | '' {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'VENTANILLA') return 'VENTANILLA';
  if (raw === 'DOMICILIADO') return 'DOMICILIADO';
  if (raw === 'NOMINA' || raw === 'NÓMINA') return 'NOMINA';
  if (raw === 'OTRO') return 'OTRO';
  return '';
}

export function normalizeFormaPago(value: string): string {
  return String(value || '').trim().toUpperCase();
}

export function isTarjetaFormaPago(value: string): boolean {
  return normalizeFormaPago(value).startsWith('TARJETA');
}

export function showBancoCuenta(formaPago: string): boolean {
  const forma = normalizeFormaPago(formaPago);
  return (
    forma === 'TRANSFERENCIA' ||
    forma === 'CHEQUE' ||
    isTarjetaFormaPago(forma)
  );
}

export function requiresCuenta(formaPago: string): boolean {
  const forma = normalizeFormaPago(formaPago);
  return forma === 'TRANSFERENCIA' || isTarjetaFormaPago(forma);
}

export function formaPagoOptionsFor(tipo: string): { value: string; label: string }[] {
  const all = [
    { value: 'TRANSFERENCIA', label: 'Transferencia' },
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'TARJETA DEBITO', label: 'Tarjeta débito' },
    { value: 'TARJETA CREDITO', label: 'Tarjeta crédito' },
  ];
  if (normalizeTipoCobranza(tipo) === 'DOMICILIADO') {
    return all.filter((item) => item.value.startsWith('TARJETA'));
  }
  return all;
}

export function digitsOnly(value: string, max = 19): string {
  return String(value || '').replace(/\D/g, '').slice(0, max);
}

/** Visa / Mastercard: 4111 1111 1111 1111 */
export function formatCardNumber(value: string): string {
  const digits = digitsOnly(value, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function isAmexCard(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.startsWith('34') || digits.startsWith('37');
}

function luhnOk(digits: string): boolean {
  if (!digits || !/^\d+$/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    total += n;
  }
  return total % 10 === 0;
}

export function cardNumberError(value: string, tipoCobranza: string): string | null {
  const digits = digitsOnly(value);
  if (!digits) return 'Número de tarjeta';
  if (normalizeTipoCobranza(tipoCobranza) === 'DOMICILIADO' && isAmexCard(digits)) {
    return 'American Express no aplica en domiciliación';
  }
  if (digits.length < 12 || digits.length > 19) {
    return 'La tarjeta debe tener entre 12 y 19 dígitos';
  }
  if (!luhnOk(digits)) return 'El número de tarjeta no es válido';
  return null;
}

export function normalizeCardExpiry(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length < 4) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
}

function hasValue(value?: string | null) {
  return Boolean(String(value ?? '').trim());
}

export function isLikelyEmail(value: string) {
  const raw = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

/** Campos faltantes del método de cobranza (domiciliado / nómina / otro). */
export function cobranzaMissing(input: {
  tipoCobranza?: string | null;
  cuenta?: string | null;
  vencimientoTarjeta?: string | null;
  cvv?: string | null;
  titularTarjeta?: string | null;
  banco?: string | null;
  correo?: string | null;
  celular1?: string | null;
  direccion?: string | null;
  empresaNominaId?: number | null;
  empresaNomina?: string | null;
  nombreEmpleado?: string | null;
  numeroEmpleado?: string | null;
}): string[] {
  const tipo = normalizeTipoCobranza(input.tipoCobranza || '');
  const missing: string[] = [];
  if (!tipo) missing.push('Tipo de cobranza');

  if (tipo === 'DOMICILIADO') {
    const cardErr = cardNumberError(input.cuenta || '', tipo);
    if (cardErr) missing.push(cardErr);
    const expErr = cardExpiryError(input.vencimientoTarjeta || '');
    if (expErr) missing.push(expErr);
    if (!hasValue(input.titularTarjeta)) missing.push('Titular de la tarjeta');
    if (digitsOnly(input.cvv || '', 3).length !== 3) {
      missing.push('Dígitos de seguridad');
    }
    if (!hasValue(input.banco)) missing.push('Banco');
    if (!hasValue(input.correo)) {
      missing.push('Correo del titular');
    } else if (!isLikelyEmail(input.correo || '')) {
      missing.push('Correo del titular válido');
    }
    if (!hasValue(input.celular1)) missing.push('Celular 1 del titular');
    if (!hasValue(input.direccion)) missing.push('Dirección del titular');
  } else if (tipo === 'NOMINA') {
    if (!input.empresaNominaId && !hasValue(input.empresaNomina)) {
      missing.push('Empresa de convenio');
    }
    if (!hasValue(input.nombreEmpleado)) missing.push('Nombre del empleado');
    if (!hasValue(input.numeroEmpleado)) missing.push('Número de empleado');
  }
  return missing;
}

export function cardExpiryError(value: string): string | null {
  const normalized = normalizeCardExpiry(value);
  if (!normalized || normalized.length !== 5) return 'Vencimiento de la tarjeta (MM/AA)';
  const [mm, yy] = normalized.split('/');
  const month = Number(mm);
  const year = 2000 + Number(yy);
  if (!month || month < 1 || month > 12) return 'Mes de vencimiento inválido';
  const lastDay = new Date(year, month, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today > lastDay) return 'La tarjeta está vencida';
  const minValid = new Date(today);
  minValid.setMonth(minValid.getMonth() + 6);
  if (lastDay <= minValid) {
    return 'La tarjeta debe tener al menos 6 meses de vigencia';
  }
  return null;
}
