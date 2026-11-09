// Formato de pagos y fechas, idéntico a la app móvil. Las fechas usan los
// helpers de @nexofit/core para que ambas apps las muestren igual.
import { formatDate, formatDateTime, formatTime as coreFormatTime } from '@nexofit/core';

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other';

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

export const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  refunded: 'Reembolsado',
};

/** Centavos enteros → '₡15 000' / '$1 234,56'. */
export function formatMoney(cents: number, currency: string | null): string {
  const amount = cents / 100;
  const symbol = currency === 'CRC' ? '₡' : currency === 'EUR' ? '€' : '$';
  // Con céntimos, siempre 2 decimales («15 000,50», no «15 000,5»).
  const formatted = amount.toLocaleString('es-CR', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

/** Fecha corta en español: '15 oct 2026'. */
export function formatShortDate(iso: string): string {
  return formatDate(iso);
}

/** Hora local 24 h: '18:30'. */
export function formatTime(iso: string): string {
  return coreFormatTime(iso);
}

/** '9 nov, 18:30'. */
export function formatShortDateTime(iso: string): string {
  return formatDateTime(iso);
}

/**
 * «hace 5 min» / «hace 3 h» / «ayer» / fecha corta: para «Actualizado …» y
 * el feed de actividad.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return formatDate(iso);
}

/** Variación porcentual con signo: '+12 %' / '−5 %' / null si no hay base. */
export function formatChange(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return '0 %';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`;
}

/** Escapa un valor para CSV (comillas, comas y saltos de línea). */
export function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
