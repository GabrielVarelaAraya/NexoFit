import { describe, expect, it } from 'vitest';
import { formatMoney, formatShortDate, METHOD_LABELS, STATUS_LABELS } from './usePayments';

describe('payment formatting', () => {
  it.each([
    [150000, 'CRC', '₡1\u00A0500'],
    [123456, 'CRC', '₡1\u00A0234,56'],
    [1000, 'USD', '$10'],
    [1000, 'EUR', '€10'],
    [500, null, '$5'],
    [0, 'CRC', '₡0'],
  ] as const)('formats %s cents in %s', (cents, currency, expected) => {
    expect(formatMoney(cents, currency)).toBe(expected);
  });

  it('formats short dates in Spanish', () => {
    expect(formatShortDate('2026-10-15T15:00:00')).toBe('15 oct 2026');
  });

  it('exposes Spanish labels for payment methods and statuses', () => {
    expect(METHOD_LABELS).toEqual({
      cash: 'Efectivo',
      transfer: 'Transferencia',
      card: 'Tarjeta',
      other: 'Otro',
    });
    expect(STATUS_LABELS).toEqual({
      paid: 'Pagado',
      pending: 'Pendiente',
      refunded: 'Reembolsado',
    });
  });
});
