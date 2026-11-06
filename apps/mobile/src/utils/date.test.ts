import { describe, expect, it } from 'vitest';
import { endOfLocalDay, startOfLocalDay, toLocalDateStr } from './date';

describe('local date helpers', () => {
  it('formats dates as YYYY-MM-DD with zero padding', () => {
    expect(toLocalDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalDateStr(new Date(2026, 9, 15))).toBe('2026-10-15');
    expect(toLocalDateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('builds local midnight for a day', () => {
    const start = startOfLocalDay('2026-10-15');

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it('moves to the next local day across a month boundary', () => {
    const end = endOfLocalDay('2026-10-31');

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(10);
    expect(end.getDate()).toBe(1);
    expect(end.getHours()).toBe(0);
  });

  it('handles a leap day', () => {
    expect(startOfLocalDay('2028-02-29').getDate()).toBe(29);
    expect(endOfLocalDay('2028-02-29').getMonth()).toBe(2);
    expect(endOfLocalDay('2028-02-29').getDate()).toBe(1);
  });
});
