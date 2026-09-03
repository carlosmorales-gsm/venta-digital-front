/** Texto normalizado de un campo monetario (input number o text). */
export function moneyInputText(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).trim();
}

export type PaymentDueConcept = {
  key: 'anticipo' | 'pagoInicial';
  label: string;
  amount: number;
};

/** Conceptos que se cobran al registrar el pago (anticipo y/o primera cuota). */
export function paymentDueConcepts(pago: {
  pagoInicial?: string | number | null;
  anticipo?: string | number | null;
}): PaymentDueConcept[] {
  const anticipo = parseMoney(pago.anticipo);
  const inicial = parseMoney(pago.pagoInicial);
  const items: PaymentDueConcept[] = [];
  if (anticipo > 0) {
    items.push({ key: 'anticipo', label: 'Anticipo', amount: anticipo });
  }
  if (inicial > 0) {
    items.push({ key: 'pagoInicial', label: 'Pago inicial', amount: inicial });
  }
  return items;
}

/** Importe a cobrar: anticipo + pago inicial (si ambos existen). */
export function paymentDueAmount(pago: {
  pagoInicial?: string | number | null;
  anticipo?: string | number | null;
}): number {
  return Number(
    paymentDueConcepts(pago)
      .reduce((sum, item) => sum + item.amount, 0)
      .toFixed(2),
  );
}

/** Parsea montos/porcentajes desde texto de captura o respuestas del API. */
export function parseMoney(raw: unknown): number {
  const n = Number(
    String(raw ?? '')
      .replace(/,/g, '')
      .replace(/[^0-9.-]/g, ''),
  );
  return Number.isFinite(n) ? n : 0;
}

/** Porcentaje de descuento entero (1.8 → 1). */
export function parseDiscountPct(raw: unknown): number {
  return Math.trunc(parseMoney(raw));
}

export type SaleFrequencyCode =
  | 'MENSUAL'
  | 'QUINCENAL'
  | 'SEMANAL'
  | 'CONTADO'
  | '';

/** Parámetros financieros (equivalente a res.company en Odoo). */
export type FinancingConfig = {
  /** Plan sin interés (product.without_interest). */
  withoutInterest: boolean;
  /** Tasa anual en decimal (ej. 0.24 = 24 %). */
  annualPercentage: number;
  /** Comisión de venta en % entero. */
  salesCommissionPct: number;
  /** Comisión de cobranza en % entero. */
  collectionCommissionPct: number;
  /** IVA incluido en precios de lista. */
  vatRate: number;
};

export const DEFAULT_FINANCING_CONFIG: FinancingConfig = {
  withoutInterest: false,
  annualPercentage: 0.24,
  salesCommissionPct: 0,
  collectionCommissionPct: 0,
  vatRate: 0.16,
};

type FrequencySpec = {
  factor: number;
  operator: 'multiplication' | 'division';
  singlePayment?: boolean;
};

/** Factores alineados con sale.order.frequency en Odoo (operador multiplication). */
const FREQUENCY_SPECS: Record<
  Exclude<SaleFrequencyCode, ''>,
  FrequencySpec
> = {
  MENSUAL: { factor: 1, operator: 'multiplication' },
  QUINCENAL: { factor: 2, operator: 'multiplication' },
  SEMANAL: { factor: 4, operator: 'multiplication' },
  CONTADO: { factor: 1, operator: 'multiplication', singlePayment: true },
};

export function normalizeFrequency(raw: string | null | undefined): SaleFrequencyCode {
  const t = String(raw ?? '').trim().toUpperCase();
  if (t === 'MENSUAL' || t === 'QUINCENAL' || t === 'SEMANAL' || t === 'CONTADO') {
    return t;
  }
  if (t.includes('CONTADO') || t.includes('UNA SOLA')) return 'CONTADO';
  return '';
}

export function frequencyLabel(code: SaleFrequencyCode): string {
  switch (code) {
    case 'MENSUAL':
      return 'Mensual';
    case 'QUINCENAL':
      return 'Quincenal';
    case 'SEMANAL':
      return 'Semanal';
    case 'CONTADO':
      return 'Pago en una sola exhibición';
    default:
      return '—';
  }
}

/** Precio de contado tras descuento (≈ cash_price en Odoo). */
export function computeCashPrice(
  precioPlan: unknown,
  descuentoPct: unknown,
): number {
  const precio = parseMoney(precioPlan);
  const pct = Math.min(100, Math.max(0, parseDiscountPct(descuentoPct)));
  const descuentoMonto = (precio * pct) / 100;
  return Math.max(0, Number((precio - descuentoMonto).toFixed(2)));
}

/** Lo ya pagado en una venta origen (precio − saldo pendiente). */
export function paidOnRecognizedSale(v: {
  amountTotal?: number;
  saldo?: number;
}): number {
  const total = parseMoney(v.amountTotal);
  const remaining = parseMoney(v.saldo);
  return Math.max(0, Number((total - remaining).toFixed(2)));
}

/** Suma de saldos a reconocer (pagado en las ventas origen). */
export function totalRecognizedPaid(
  ventas: Array<{ amountTotal?: number; saldo?: number }> | null | undefined,
): number {
  if (!Array.isArray(ventas) || !ventas.length) return 0;
  return Number(
    ventas
      .reduce((sum, item) => sum + paidOnRecognizedSale(item), 0)
      .toFixed(2),
  );
}

/** Saldo = precio contado − anticipo − saldo reconocido (≥ 0). */
export function computeSaldo(
  precioPlan: unknown,
  descuentoPct: unknown,
  anticipo: unknown,
  recognizedBalance: unknown = 0,
): string {
  const cash = computeCashPrice(precioPlan, descuentoPct);
  const saldo = Math.max(
    0,
    cash - parseMoney(anticipo) - parseMoney(recognizedBalance),
  );
  return String(Number(saldo.toFixed(2)));
}

export function computeNumberFrequencies(
  frecuencia: string | null | undefined,
  plazoMeses: unknown,
): number {
  const code = normalizeFrequency(frecuencia);
  if (!code) return 0;
  const spec = FREQUENCY_SPECS[code];
  if (spec.singlePayment) return 1;

  const months = Math.max(0, Math.trunc(parseMoney(plazoMeses)));
  if (!months) return 0;

  if (spec.operator === 'multiplication') {
    return Math.max(1, Math.trunc(months * spec.factor));
  }
  return Math.max(1, Math.trunc(months / (spec.factor || 1)));
}

function paymentDenominator(
  frecuencia: string | null | undefined,
  plazoMeses: unknown,
): number {
  const code = normalizeFrequency(frecuencia);
  if (!code) return 0;
  const spec = FREQUENCY_SPECS[code];
  if (spec.singlePayment) return 1;

  const months = Math.max(0, Math.trunc(parseMoney(plazoMeses)));
  if (!months) return 0;

  if (spec.operator === 'multiplication') {
    return months * spec.factor;
  }
  return months / (spec.factor || 1);
}

/** Réplica de preview_financed_price (sale_financing.py). */
export function computePreviewFinancedPrice(
  cashPrice: number,
  hitch: number,
  plazoMeses: number,
  config: FinancingConfig,
  recognizedBalance = 0,
): number {
  if (!cashPrice) return 0;

  const salesRate = config.salesCommissionPct / 100;
  const collectionRate = config.collectionCommissionPct / 100;
  const commissionRate = salesRate + collectionRate + 1;
  const vatFactor = 1 + config.vatRate;

  const priceWithoutVat = cashPrice / vatFactor;
  const priceWithoutCommission = priceWithoutVat / commissionRate;

  const hitchWithoutVat = hitch / vatFactor;
  const hitchWithoutCommission = hitchWithoutVat / commissionRate;

  const priceWithoutHitch = priceWithoutCommission - hitchWithoutCommission;

  const financingCost =
    priceWithoutHitch *
    ((config.annualPercentage * 100) / 12 * plazoMeses) /
    100;

  const salesCommission = priceWithoutHitch * salesRate;
  const collectionCommission = priceWithoutHitch * collectionRate;

  let preview =
    (priceWithoutHitch +
      financingCost +
      salesCommission +
      collectionCommission) *
    vatFactor;

  if (recognizedBalance > 0) {
    preview -= recognizedBalance;
  }

  return Math.max(0, Number(preview.toFixed(2)));
}

function ceilPeso(amount: number): number {
  return Math.ceil(Math.round(amount * 10000) / 10000);
}

export type FinancingBreakdown = {
  cashPrice: number;
  saldo: number;
  numberFrequencies: number;
  importeCadaPago: number;
  financedPrice: number;
  frequencyCode: SaleFrequencyCode;
};

/**
 * Calcula cuota y totales con la misma lógica que sale.order (sale_financing.py).
 */
export function computeFinancingBreakdown(input: {
  precioPlan: unknown;
  descuentoPct: unknown;
  anticipo: unknown;
  frecuencia: string | null | undefined;
  plazo: unknown;
  config?: Partial<FinancingConfig>;
  recognizedBalance?: unknown;
}): FinancingBreakdown {
  const config = { ...DEFAULT_FINANCING_CONFIG, ...input.config };
  const frequencyCode = normalizeFrequency(input.frecuencia);
  const hitch = parseMoney(input.anticipo);
  const recognized = Math.max(0, parseMoney(input.recognizedBalance));
  const cashPrice = computeCashPrice(input.precioPlan, input.descuentoPct);
  const saldo = Math.max(0, cashPrice - hitch - recognized);
  const plazoMeses = Math.max(0, Math.trunc(parseMoney(input.plazo)));
  const numberFrequencies = computeNumberFrequencies(
    input.frecuencia,
    plazoMeses,
  );
  const denom = paymentDenominator(input.frecuencia, plazoMeses);

  let importeCadaPago = 0;
  let financedPrice = 0;

  if (!frequencyCode || !cashPrice) {
    return {
      cashPrice,
      saldo,
      numberFrequencies,
      importeCadaPago,
      financedPrice,
      frequencyCode,
    };
  }

  if (frequencyCode === 'CONTADO') {
    importeCadaPago = Math.max(0, cashPrice - recognized);
    financedPrice = importeCadaPago;
    return {
      cashPrice,
      saldo,
      numberFrequencies: 1,
      importeCadaPago,
      financedPrice,
      frequencyCode,
    };
  }

  if (!denom || !plazoMeses) {
    return {
      cashPrice,
      saldo,
      numberFrequencies,
      importeCadaPago,
      financedPrice,
      frequencyCode,
    };
  }

  if (config.withoutInterest) {
    const base = Math.max(0, cashPrice - hitch - recognized);
    importeCadaPago = ceilPeso(base / denom);
    const spec = FREQUENCY_SPECS[frequencyCode];
    if (spec.operator === 'multiplication') {
      financedPrice = hitch + importeCadaPago * plazoMeses * spec.factor;
    } else {
      financedPrice = hitch + importeCadaPago * plazoMeses;
    }
  } else {
    const preview = computePreviewFinancedPrice(
      cashPrice,
      hitch,
      plazoMeses,
      config,
      recognized,
    );
    importeCadaPago = ceilPeso(preview / denom);
    const spec = FREQUENCY_SPECS[frequencyCode];
    if (spec.operator === 'multiplication') {
      financedPrice = importeCadaPago * plazoMeses * spec.factor;
    } else {
      financedPrice = importeCadaPago * (plazoMeses / spec.factor);
    }
  }

  return {
    cashPrice,
    saldo,
    numberFrequencies,
    importeCadaPago,
    financedPrice: Number(financedPrice.toFixed(2)),
    frequencyCode,
  };
}

export function formatMoneyField(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return String(Number(amount.toFixed(2)));
}

/** Monto con formato MXN para UI y PDF ($1,234.56). Vacío → cadena vacía. */
export function formatMoneyDisplay(
  raw: string | number | null | undefined,
): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const n = parseMoney(raw);
  if (!Number.isFinite(n)) return t;
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
