/** Quita las clases que ya terminaron (p. ej. de «Clases de hoy» por la tarde). */
export function stillAhead<T extends { ends_at: string }>(
  sessions: readonly T[],
  now: Date = new Date()
): T[] {
  const nowMs = now.getTime();
  return sessions.filter((session) => new Date(session.ends_at).getTime() > nowMs);
}
