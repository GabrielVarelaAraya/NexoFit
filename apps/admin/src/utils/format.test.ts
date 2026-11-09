import { describe, expect, it } from 'vitest';
import {
  formatChange,
  formatMoney,
  formatRelative,
  formatShortDate,
  formatShortDateTime,
  formatTime,
  toCsv,
  METHOD_LABELS,
  STATUS_LABELS,
} from './format';

describe('admin formatting helpers', () => {
  it.each([
    [150000, 'CRC', '₡1\u00A0500'],
    [123456, 'CRC', '₡1\u00A0234,56'],
    [1500050, 'CRC', '₡15 000,50'],
    [1000, 'USD', '$10'],
    [1000, 'EUR', '€10'],
    [500, null, '$5'],
    [0, 'CRC', '₡0'],
  ] as const)('formats %s cents in %s', (cents, currency, expected) => {
    expect(formatMoney(cents, currency)).toBe(expected);
  });

  it('formats short dates and 24h times like the mobile app', () => {
    expect(formatShortDate('2026-10-15T15:00:00')).toBe('15 oct 2026');
    expect(formatTime('2026-10-15T18:30:00')).toBe('18:30');
    expect(formatShortDateTime('2026-10-15T18:30:00')).toBe('15 oct, 18:30');
  });

  it('formats relative times', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(formatRelative('2026-11-08T11:59:40Z', now)).toBe('hace un momento');
    expect(formatRelative('2026-11-08T11:45:00Z', now)).toBe('hace 15 min');
    expect(formatRelative('2026-11-08T09:00:00Z', now)).toBe('hace 3 h');
    expect(formatRelative('2026-11-07T10:00:00Z', now)).toBe('ayer');
    expect(formatRelative('2026-11-05T12:00:00Z', now)).toBe('hace 3 días');
  });

  it('formats period-over-period change', () => {
    expect(formatChange(120, 100)).toBe('+20 %');
    expect(formatChange(95, 100)).toBe('−5 %');
    expect(formatChange(100, 100)).toBe('0 %');
    expect(formatChange(10, 0)).toBeNull();
  });

  it('builds CSV with escaping', () => {
    expect(
      toCsv([
        ['Fecha', 'Miembro'],
        ['8 nov 2026', 'Varela, Gabriel'],
        ['9 nov 2026', 'Dice "hola"'],
      ])
    ).toBe('Fecha,Miembro\n8 nov 2026,"Varela, Gabriel"\n9 nov 2026,"Dice ""hola"""');
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
