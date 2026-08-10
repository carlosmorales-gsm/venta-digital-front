import { getClientTimeZone } from '../../../shared/utils/datetime';

/** YYYY-MM-DD en zona horaria del dispositivo. */
export function toLocalDateInputValue(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getClientTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${day}`;
}

/** Últimos 7 días (hoy inclusive). */
export function lastWeekRange(): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return {
    dateFrom: toLocalDateInputValue(from),
    dateTo: toLocalDateInputValue(to),
  };
}

export function localDateKey(utcIso: string | null | undefined): string {
  if (!utcIso) return '';
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalDateInputValue(d);
}

export function matchesDateRange(
  utcIso: string | null | undefined,
  dateFrom: string,
  dateTo: string,
): boolean {
  const day = localDateKey(utcIso);
  if (!day) return !dateFrom && !dateTo;
  if (dateFrom && day < dateFrom) return false;
  if (dateTo && day > dateTo) return false;
  return true;
}

/** Minúsculas sin acentos/diacríticos para búsqueda. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export function textIncludesNormalized(
  haystack: string | null | undefined,
  needle: string | null | undefined,
): boolean {
  const q = normalizeSearchText(needle);
  if (!q) return true;
  return normalizeSearchText(haystack).includes(q);
}

export function textEqualsNormalized(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeSearchText(a) === normalizeSearchText(b);
}
