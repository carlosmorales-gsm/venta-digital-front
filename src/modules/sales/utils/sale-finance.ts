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
