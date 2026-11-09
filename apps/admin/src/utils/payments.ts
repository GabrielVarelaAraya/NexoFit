import type { PaymentMethod } from './format';

/**
 * Monto escrito por el admin → centavos enteros. Acepta «15000», «15 000»,
 * «15.000», «15,50» y «15.000,50». Devuelve null si no es un monto válido > 0.
 */
export function parseAmountToCents(input: string): number | null {
  const raw = input.replace(/[\s₡$€]/g, '');
  if (!/^\d[\d.,]*$/.test(raw)) return null;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  let normalized = raw;
  // Separador decimal = último , o . seguido de 1–2 dígitos; el resto son miles.
  if (decimalIndex !== -1 && raw.length - decimalIndex - 1 <= 2) {
    normalized = `${raw.slice(0, decimalIndex).replace(/[.,]/g, '')}.${raw.slice(decimalIndex + 1)}`;
  } else {
    normalized = raw.replace(/[.,]/g, '');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export type StatusFilter = 'all' | 'paid' | 'pending' | 'refunded';
export type MethodFilter = 'all' | PaymentMethod;

interface PaymentLike {
  status: string;
  method: string;
  memberName: string | null;
}

export function filterPayments<T extends PaymentLike>(
  payments: readonly T[],
  status: StatusFilter,
  method: MethodFilter,
  query = ''
): T[] {
  const q = query.trim().toLowerCase();
  return payments.filter(
    (payment) =>
      (status === 'all' || payment.status === status) &&
      (method === 'all' || payment.method === method) &&
      (!q || (payment.memberName ?? '').toLowerCase().includes(q))
  );
}
