// Utilidades de fecha en zona horaria LOCAL.
// Nunca usar toISOString().split('T')[0] para "hoy": devuelve la fecha UTC,
// que en horarios negativos (México, etc.) salta de día a partir de ~18:00.

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en la zona horaria local del dispositivo. */
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
