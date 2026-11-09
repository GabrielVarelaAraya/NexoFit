import { describe, expect, it } from 'vitest';
import {
  dayLabel,
  endOfLocalDay,
  previousMonthToDate,
  startOfLocalDay,
  toLocalDateStr,
} from './date';

describe('previousMonthToDate', () => {
  it('covers the same stretch of the previous month', () => {
    const { start, end } = previousMonthToDate(new Date(2026, 10, 8, 14, 30));
    expect(new Date(start)).toEqual(new Date(2026, 9, 1));
    expect(new Date(end)).toEqual(new Date(2026, 9, 8, 14, 30));
  });

  it('clamps to the last day of a shorter previous month', () => {
    const { end } = previousMonthToDate(new Date(2026, 2, 31, 9, 0));
    expect(new Date(end)).toEqual(new Date(2026, 1, 28, 9, 0));
  });
});

describe('dayLabel', () => {
  const now = new Date(2026, 10, 8, 10, 0);
  it('labels today and tomorrow, otherwise null', () => {
    expect(dayLabel(new Date(2026, 10, 8, 20, 0).toISOString(), now)).toBe('Hoy');
    expect(dayLabel(new Date(2026, 10, 9, 7, 0).toISOString(), now)).toBe('Mañana');
    expect(dayLabel(new Date(2026, 10, 12, 7, 0).toISOString(), now)).toBeNull();
  });
});

describe('admin local date helpers', () => {
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
  });

  it('moves to the next local day across a month boundary', () => {
    const end = endOfLocalDay('2026-10-31');

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(10);
    expect(end.getDate()).toBe(1);
    expect(end.getHours()).toBe(0);
  });
});
