import { describe, expect, it, vi } from 'vitest';

// FadeIn.tsx importa react-native: se simula lo mínimo para probar la función pura.
vi.mock('react-native', () => ({
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false) },
  Animated: {},
  Easing: {},
  Platform: { OS: 'web' },
}));

import { staggerDelay } from './FadeIn';

describe('staggerDelay', () => {
  it('delays each item a little more than the previous one', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(45);
    expect(staggerDelay(3)).toBe(135);
  });

  it('caps the delay so long lists do not wait', () => {
    expect(staggerDelay(6)).toBe(270);
    expect(staggerDelay(40)).toBe(270);
  });

  it('never goes negative', () => {
    expect(staggerDelay(-3)).toBe(0);
  });
});
