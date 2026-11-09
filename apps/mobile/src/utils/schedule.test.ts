import { describe, expect, it } from 'vitest';
import { stillAhead } from './schedule';

describe('stillAhead', () => {
  const now = new Date('2026-11-08T18:00:00Z');
  const ended = { id: 'a', ends_at: '2026-11-08T17:00:00Z' };
  const ongoing = { id: 'b', ends_at: '2026-11-08T18:30:00Z' };
  const later = { id: 'c', ends_at: '2026-11-08T21:00:00Z' };

  it('drops classes that already ended and keeps ongoing ones', () => {
    expect(stillAhead([ended, ongoing, later], now).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('treats a class ending exactly now as finished', () => {
    expect(stillAhead([{ id: 'x', ends_at: now.toISOString() }], now)).toHaveLength(0);
  });
});
