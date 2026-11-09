import { describe, expect, it } from 'vitest';
import { parseReps, parseWeight } from './workoutInput';

describe('parseWeight', () => {
  it('accepts dot and comma decimals', () => {
    expect(parseWeight('40.5')).toBe(40.5);
    expect(parseWeight('40,5')).toBe(40.5);
  });

  it('returns null for empty, text or negative values', () => {
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('abc')).toBeNull();
    expect(parseWeight('-5')).toBeNull();
  });
});

describe('parseReps', () => {
  it('returns whole numbers because the column is an integer', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps('8,5')).toBe(9);
    expect(parseReps('7.4')).toBe(7);
  });

  it('returns null for empty or invalid values', () => {
    expect(parseReps('')).toBeNull();
    expect(parseReps('x')).toBeNull();
  });
});
