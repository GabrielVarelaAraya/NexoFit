import { describe, expect, it } from 'vitest';
import { canTakeAttendance, rosterSummary, sortRoster, type RosterEntry } from './roster';

const entry = (bookingId: string, status: string, fullName: string | null): RosterEntry => ({
  bookingId,
  status,
  fullName,
  phone: null,
});

describe('canTakeAttendance', () => {
  const start = '2026-11-08T16:00:00Z';

  it('opens 15 minutes before the class starts', () => {
    expect(canTakeAttendance(start, new Date('2026-11-08T15:44:00Z'))).toBe(false);
    expect(canTakeAttendance(start, new Date('2026-11-08T15:45:00Z'))).toBe(true);
    expect(canTakeAttendance(start, new Date('2026-11-08T18:00:00Z'))).toBe(true);
  });
});

describe('rosterSummary', () => {
  it('counts active spots and pending check-ins', () => {
    const summary = rosterSummary([
      entry('1', 'confirmed', 'Ana'),
      entry('2', 'attended', 'Beto'),
      entry('3', 'no_show', 'Caro'),
      entry('4', 'cancelled', 'Dani'),
    ]);
    expect(summary).toEqual({ active: 3, attended: 1, noShow: 1, pending: 1, cancelled: 1 });
  });
});

describe('sortRoster', () => {
  it('puts pending first, cancelled last, then by name', () => {
    const sorted = sortRoster([
      entry('1', 'cancelled', 'Ana'),
      entry('2', 'attended', 'Beto'),
      entry('3', 'confirmed', 'Zoe'),
      entry('4', 'confirmed', 'Ángel'),
    ]);
    expect(sorted.map((e) => e.bookingId)).toEqual(['4', '3', '2', '1']);
  });
});
