/**
 * Formatos de fecha/hora de NexoFit, en la hora local del dispositivo.
 * Se arman a mano (no con Intl) para que se vean igual en todos los motores:
 * Intl varía entre navegadores y Hermes (puntos, mayúsculas, «a. m.»).
 *
 *   formatTime          10:05
 *   formatDayMonth      9 nov
 *   formatDate          9 nov 2026
 *   formatWeekdayDate   lun 9 nov
 *   formatLongDate      lunes 9 de noviembre
 *   formatDateTime      9 nov, 10:05
 */

const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type DateInput = Date | string | number;

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));
const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(value: DateInput): string {
  const d = toDate(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDayMonth(value: DateInput): string {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatDate(value: DateInput): string {
  const d = toDate(value);
  return `${formatDayMonth(d)} ${d.getFullYear()}`;
}

export function formatWeekdayDate(value: DateInput): string {
  const d = toDate(value);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${formatDayMonth(d)}`;
}

export function formatLongDate(value: DateInput): string {
  const d = toDate(value);
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  return `${formatDayMonth(d)}, ${formatTime(d)}`;
}

/** Mes abreviado (para chips de calendario: «OCT»). */
export function formatMonthShort(value: DateInput): string {
  return MONTHS_SHORT[toDate(value).getMonth()];
}
