import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncer } from './debounce';

afterEach(() => {
  vi.useRealTimers();
});

describe('debouncer', () => {
  it('runs once after the quiet window when triggered repeatedly', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 400);

    debouncer.trigger();
    await vi.advanceTimersByTimeAsync(200);
    debouncer.trigger();
    debouncer.trigger();

    await vi.advanceTimersByTimeAsync(399);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does nothing when cancelled before the quiet window ends', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 100);

    debouncer.trigger();
    debouncer.cancel();

    await vi.advanceTimersByTimeAsync(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('can fire again after a previous run', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 50);

    debouncer.trigger();
    await vi.advanceTimersByTimeAsync(50);
    debouncer.trigger();
    await vi.advanceTimersByTimeAsync(50);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
