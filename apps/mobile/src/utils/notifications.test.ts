import { describe, expect, it } from 'vitest';
import {
  countUnread,
  markAllReadLocally,
  sortNotificationsDesc,
  type AppNotification,
} from './notifications';

function make(id: string, created_at: string, read = false): AppNotification {
  return {
    id,
    title: `Título ${id}`,
    body: 'Cuerpo de la notificación',
    created_at,
    read,
  };
}

describe('notification helpers', () => {
  it('orders notifications newest first without mutating the input', () => {
    const input = [
      make('a', '2026-10-01T10:00:00Z'),
      make('b', '2026-10-03T10:00:00Z'),
      make('c', '2026-10-02T10:00:00Z'),
    ];

    const sorted = sortNotificationsDesc(input);

    expect(sorted.map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(input.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('counts only unread notifications', () => {
    const items = [
      make('a', '2026-10-01T10:00:00Z', true),
      make('b', '2026-10-02T10:00:00Z'),
      make('c', '2026-10-03T10:00:00Z'),
    ];

    expect(countUnread(items)).toBe(2);
    expect(countUnread([])).toBe(0);
    expect(countUnread(items.map((item) => ({ ...item, read: true })))).toBe(0);
  });

  it('marks everything as read without mutating the input', () => {
    const read = make('a', '2026-10-01T10:00:00Z', true);
    const unread = make('b', '2026-10-02T10:00:00Z');
    const input = [read, unread];

    const updated = markAllReadLocally(input);

    expect(updated.every((item) => item.read)).toBe(true);
    expect(input[1].read).toBe(false);
    // Las que ya estaban leídas conservan su identidad (sin copias de más).
    expect(updated[0]).toBe(read);
  });
});
