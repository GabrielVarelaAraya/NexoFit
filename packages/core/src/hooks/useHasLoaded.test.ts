import { describe, expect, it } from 'vitest';
import { nextLoadedKey, shouldShowSkeleton } from './useHasLoaded';

const NONE = Symbol('none') as never;

describe('nextLoadedKey', () => {
  it('remembers the key when a load finishes (loading true → false)', () => {
    expect(nextLoadedKey(true, false, NONE, 'dia-1')).toBe('dia-1');
  });

  it('keeps the previous value while still loading or when nothing changed', () => {
    expect(nextLoadedKey(false, true, NONE, 'dia-1')).toBe(NONE);
    expect(nextLoadedKey(true, true, 'dia-1', 'dia-1')).toBe('dia-1');
    expect(nextLoadedKey(false, false, 'dia-1', 'dia-2')).toBe('dia-1');
  });

  it('does not mark a new key as loaded just because the key changed', () => {
    // La clave cambió pero la carga nueva aún no empezó (loading sigue en false).
    expect(nextLoadedKey(false, false, 'dia-1', 'dia-2')).not.toBe('dia-2');
  });
});

describe('shouldShowSkeleton', () => {
  it('shows the skeleton only on the first load', () => {
    expect(shouldShowSkeleton(true, false)).toBe(true);
  });

  it('keeps content visible while refreshing data that was already loaded', () => {
    expect(shouldShowSkeleton(true, true)).toBe(false);
  });

  it('shows nothing special once loading ends', () => {
    expect(shouldShowSkeleton(false, true)).toBe(false);
    expect(shouldShowSkeleton(false, false)).toBe(false);
  });
});
