import { describe, expect, it } from 'vitest';
import { filterPayments, parseAmountToCents } from './payments';

describe('parseAmountToCents', () => {
  it.each([
    ['15000', 1_500_000],
    ['15 000', 1_500_000],
    ['15.000', 1_500_000],
    ['₡15.000', 1_500_000],
    ['15,50', 1_550],
    ['15.5', 1_550],
    ['15.000,50', 1_500_050],
    ['1,234.56', 123_456],
  ])('parses %s', (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it.each(['', '0', 'abc', '-5', '12a'])('rejects %s', (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });
});

describe('filterPayments', () => {
  const payments = [
    { status: 'paid', method: 'cash', memberName: 'Gabriel Varela' },
    { status: 'pending', method: 'transfer', memberName: 'Sofía Lizano' },
  ];

  it('filters by status, method and member name', () => {
    expect(filterPayments(payments, 'paid', 'all')).toHaveLength(1);
    expect(filterPayments(payments, 'all', 'transfer')[0].memberName).toBe('Sofía Lizano');
    expect(filterPayments(payments, 'all', 'all', 'gabriel')).toHaveLength(1);
    expect(filterPayments(payments, 'refunded', 'all')).toHaveLength(0);
  });
});
