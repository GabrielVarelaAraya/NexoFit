import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatLongDate,
  formatMonthShort,
  formatTime,
  formatWeekdayDate,
} from './dates';

// Fechas construidas en hora local: el resultado no depende de la zona del equipo.
const monday = new Date(2026, 10, 9, 10, 5); // lunes 9 nov 2026, 10:05
const sunday = new Date(2026, 0, 4, 7, 0); // domingo 4 ene 2026, 07:00

describe('date formats', () => {
  it('formats times as 24h HH:mm', () => {
    expect(formatTime(monday)).toBe('10:05');
    expect(formatTime(sunday)).toBe('07:00');
  });

  it('formats short and full dates', () => {
    expect(formatDayMonth(monday)).toBe('9 nov');
    expect(formatDate(monday)).toBe('9 nov 2026');
    expect(formatWeekdayDate(sunday)).toBe('dom 4 ene');
  });

  it('formats long dates and date-times', () => {
    expect(formatLongDate(monday)).toBe('lunes 9 de noviembre');
    expect(formatDateTime(monday)).toBe('9 nov, 10:05');
    expect(formatMonthShort(sunday)).toBe('ene');
  });

  it('accepts ISO strings and timestamps', () => {
    expect(formatDate(monday.toISOString())).toBe('9 nov 2026');
    expect(formatTime(monday.getTime())).toBe('10:05');
  });
});
