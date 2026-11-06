import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdLoading, MIN_LOADING_MS, sleep } from './loading';

afterEach(() => {
  vi.useRealTimers();
});

describe('admin loading helpers', () => {
  it('uses a 500 ms minimum', () => {
    expect(MIN_LOADING_MS).toBe(500);
  });

  it('resolves immediately when the minimum time already elapsed', async () => {
    const startedAt = Date.now() - MIN_LOADING_MS;

    await expect(holdLoading(startedAt)).resolves.toBeUndefined();
  });

  it('waits the remaining time before resolving', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    let resolved = false;
    const pending = holdLoading(0).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(MIN_LOADING_MS - 1);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toBe(true);
  });

  it('sleep resolves after the requested time', async () => {
    vi.useFakeTimers();

    let resolved = false;
    const pending = sleep(120).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(119);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toBe(true);
  });
});
