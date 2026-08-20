/**
 * Utilidades de zona horaria del navegador.
 * El backend guarda todo en UTC; aquí se muestra en horario local del dispositivo.
 */

export function getClientTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Fecha local de hoy en formato YYYY-MM-DD (para inputs type="date"). */
export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isIsoDateBefore(
  iso: string | null | undefined,
  minIso: string,
): boolean {
  const d = String(iso ?? '').trim().slice(0, 10);
  const min = String(minIso ?? '').trim().slice(0, 10);
  if (!d || !min) return false;
  return d < min;
}

/** Si la fecha es anterior a minIso, devuelve minIso. */
export function clampIsoDateMin(
  iso: string | null | undefined,
  minIso: string,
): string {
  const d = String(iso ?? '').trim().slice(0, 10);
  if (!d) return d;
  return isIsoDateBefore(d, minIso) ? minIso : d;
}

export function formatUtcToLocal(
  utcIso: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'short',
    timeStyle: 'short',
  },
): string {
  if (!utcIso) {
    return '—';
  }

  const date = typeof utcIso === 'string' ? new Date(utcIso) : utcIso;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    timeZone: getClientTimeZone(),
    ...options,
  }).format(date);
}
