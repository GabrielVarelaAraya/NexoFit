// Formato de pagos y fechas (es-CR), idéntico a la app móvil.

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
  const formatted = amount.toLocaleString('es-CR', { maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
}

/** Fecha corta en español: '15 oct 2026'. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Hora local en español: '18:30'. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
