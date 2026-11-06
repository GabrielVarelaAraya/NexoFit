// Valor visible del badge de notificaciones de las tabs: oculto en 0 y
// «99+» por encima del tope, para que no deforme el ícono.
export const BADGE_MAX = 99;

export function badgeValue(unread: number): number | string | undefined {
  if (!Number.isFinite(unread) || unread <= 0) return undefined;
  return unread > BADGE_MAX ? `${BADGE_MAX}+` : unread;
}
