/**
 * Utilidades de zona horaria del navegador.
 * El backend guarda todo en UTC; aquí se muestra en horario local del dispositivo.
 */

export function getClientTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
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
