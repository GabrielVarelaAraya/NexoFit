// Utilidades de fecha en zona horaria LOCAL.
// Nunca usar toISOString().split('T')[0] para "hoy": devuelve la fecha UTC,
// que en horarios negativos (México, etc.) salta de día a partir de ~18:00.

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en la zona horaria local del navegador. */
export function toLocalDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Medianoche local del día indicado ('YYYY-MM-DD'). */
export function startOfLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Medianoche local del día siguiente al indicado. */
export function endOfLocalDay(dateStr: string): Date {
  const start = startOfLocalDay(dateStr);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}

/**
 * Mismo tramo del mes anterior: del día 1 al mismo día/hora de hoy. Comparar
 * el mes en curso contra el mes anterior completo siempre daría «−» a inicio
 * de mes. Si el mes anterior es más corto, se corta en su último día.
 */
export function previousMonthToDate(now: Date): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const end = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    Math.min(now.getDate(), lastDayPrev),
    now.getHours(),
    now.getMinutes()
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

/** 'Hoy' / 'Mañana' / 'lun 9 nov' para agrupar o rotular fechas cercanas. */
export function dayLabel(iso: string, now: Date = new Date()): string | null {
  const day = toLocalDateStr(new Date(iso));
  const today = toLocalDateStr(now);
  const tomorrow = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (day === today) return 'Hoy';
  if (day === tomorrow) return 'Mañana';
  return null;
}
