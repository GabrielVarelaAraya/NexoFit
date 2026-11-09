const DAY_MS = 24 * 60 * 60_000;

/** Aviso de vencimiento a partir de esta cantidad de días restantes. */
export const EXPIRING_SOON_DAYS = 7;

/**
 * Días que le quedan a un plan (redondeado hacia arriba: si vence mañana a
 * cualquier hora, queda 1) y si conviene avisar que está por vencer.
 */
export function planStatus(
  validUntil: string,
  now: Date = new Date()
): { daysLeft: number; expiringSoon: boolean; expired: boolean } {
  const diff = new Date(validUntil).getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diff / DAY_MS));
  return {
    daysLeft,
    expired: diff <= 0,
    expiringSoon: diff > 0 && daysLeft <= EXPIRING_SOON_DAYS,
  };
}

export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Vencido';
  if (daysLeft === 1) return 'Vence mañana';
  return `Vence en ${daysLeft} días`;
}
