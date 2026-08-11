/** Texto normalizado de un campo monetario (input number o text). */
export function moneyInputText(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).trim();
}

/** Importe a cobrar al registrar pago: pago inicial si existe, si no anticipo. */
export function paymentDueAmount(pago: {
  pagoInicial?: string | number | null;
  anticipo?: string | number | null;
}): number {
  const inicial = parseMoney(pago.pagoInicial);
  if (inicial > 0) return inicial;
  return parseMoney(pago.anticipo);
}

/** Parsea montos/porcentajes desde texto de captura. */
export function parseMoney(raw: string | number | null | undefined): number {
  const n = Number(
    String(raw ?? '')
      .replace(/,/g, '')
      .replace(/[^0-9.-]/g, ''),
  );
  return Number.isFinite(n) ? n : 0;
}

/** Porcentaje de descuento entero (1.8 → 1). */
export function parseDiscountPct(raw: string | number | null | undefined): number {
  return Math.trunc(parseMoney(raw));
}

/** Saldo = precio − (precio × % descuento) − anticipo (≥ 0). */
export function computeSaldo(
  precioPlan: unknown,
  descuentoPct: unknown,
  anticipo: unknown,
): string {
  const precio = parseMoney(precioPlan);
  const pct = Math.min(100, Math.max(0, parseDiscountPct(descuentoPct)));
  const descuentoMonto = (precio * pct) / 100;
  const saldo = Math.max(0, precio - descuentoMonto - parseMoney(anticipo));
  return String(Number(saldo.toFixed(2)));
}
