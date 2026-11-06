import { describe, expect, it } from 'vitest';
import { BADGE_MAX, badgeValue } from './tabBadge';

describe('notification badge value', () => {
  it('hides the badge when there is nothing unread', () => {
    expect(badgeValue(0)).toBeUndefined();
    expect(badgeValue(-3)).toBeUndefined();
  });

  it('shows the exact count up to the cap', () => {
    expect(badgeValue(1)).toBe(1);
    expect(badgeValue(42)).toBe(42);
    expect(badgeValue(BADGE_MAX)).toBe(BADGE_MAX);
  });

  it('caps large counts as 99+', () => {
    expect(badgeValue(BADGE_MAX + 1)).toBe(`${BADGE_MAX}+`);
    expect(badgeValue(1234)).toBe('99+');
  });

  it('ignores non-finite values', () => {
    expect(badgeValue(Number.NaN)).toBeUndefined();
    expect(badgeValue(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
