import { describe, expect, it } from 'vitest';
import { isHorizontalSwipe, swipeEnabled, swipeTarget } from './swipeTabs';

describe('isHorizontalSwipe', () => {
  it('ignores small movements and vertical scrolls', () => {
    expect(isHorizontalSwipe(8, 0)).toBe(false);
    expect(isHorizontalSwipe(60, 50)).toBe(false);
    expect(isHorizontalSwipe(20, 80)).toBe(false);
  });

  it('accepts a clearly horizontal drag in either direction', () => {
    expect(isHorizontalSwipe(40, 5)).toBe(true);
    expect(isHorizontalSwipe(-40, 10)).toBe(true);
  });
});

describe('swipeTarget', () => {
  // 5 pestañas: índices 0..4
  it('swipe left goes to the next tab, swipe right to the previous one', () => {
    expect(swipeTarget(5, 2, -80, 4)).toBe(3);
    expect(swipeTarget(5, 2, 80, 4)).toBe(1);
  });

  it('does nothing past the first or last tab', () => {
    expect(swipeTarget(5, 0, 90, 0)).toBeNull();
    expect(swipeTarget(5, 4, -90, 0)).toBeNull();
  });

  it('needs enough distance, unless the gesture is fast', () => {
    expect(swipeTarget(5, 2, -40, 0, 0.1)).toBeNull();
    expect(swipeTarget(5, 2, -40, 0, 0.8)).toBe(3);
    expect(swipeTarget(5, 2, -20, 0, 2)).toBeNull();
  });

  it('ignores diagonal and vertical gestures', () => {
    expect(swipeTarget(5, 2, -80, 70)).toBeNull();
    expect(swipeTarget(5, 2, -10, 120)).toBeNull();
  });
});

describe('swipeEnabled', () => {
  it('is always on in native apps', () => {
    expect(swipeEnabled('ios', 0)).toBe(true);
    expect(swipeEnabled('android', 0)).toBe(true);
  });

  it('on web only with a touch screen, so mouse drags still select text', () => {
    expect(swipeEnabled('web', 0)).toBe(false);
    expect(swipeEnabled('web', 5)).toBe(true);
  });
});
