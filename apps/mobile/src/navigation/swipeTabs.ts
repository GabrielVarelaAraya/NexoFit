// Lógica pura del deslizamiento entre pestañas (sin React ni react-native,
// para poder probarla). El componente que la usa está en SwipeTabsLayout.tsx.

/** Desplazamiento horizontal mínimo para soltar y cambiar de pestaña. */
export const SWIPE_DISTANCE = 56;
/** Con un gesto rápido basta un trazo más corto. */
export const SWIPE_FAST_DISTANCE = 28;
export const SWIPE_FAST_VELOCITY = 0.5;
/** Cuántas veces mayor que el vertical debe ser el movimiento horizontal. */
export const HORIZONTAL_DOMINANCE = 2;
/** Desde aquí el gesto se considera un deslizamiento (y no un toque o scroll). */
export const SWIPE_START_DISTANCE = 14;

/**
 * ¿El movimiento ya es claramente horizontal? Mientras el gesto sea más bien
 * vertical se deja que la pantalla haga scroll con normalidad.
 */
export function isHorizontalSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > SWIPE_START_DISTANCE && Math.abs(dx) > HORIZONTAL_DOMINANCE * Math.abs(dy);
}

/**
 * Índice de la pestaña a la que cambiar al soltar el dedo, o null si no
 * corresponde (gesto corto, vertical, o ya se está en la primera/última).
 * Deslizar hacia la izquierda avanza; hacia la derecha retrocede.
 */
export function swipeTarget(
  tabCount: number,
  currentIndex: number,
  dx: number,
  dy: number,
  vx = 0
): number | null {
  if (!isHorizontalSwipe(dx, dy)) return null;
  const farEnough =
    Math.abs(dx) >= SWIPE_DISTANCE ||
    (Math.abs(dx) >= SWIPE_FAST_DISTANCE && Math.abs(vx) >= SWIPE_FAST_VELOCITY);
  if (!farEnough) return null;
  const target = currentIndex + (dx < 0 ? 1 : -1);
  return target >= 0 && target < tabCount ? target : null;
}

/**
 * En web el deslizamiento solo se activa en pantallas táctiles: con ratón,
 * arrastrar es seleccionar texto y no debe cambiar de pestaña.
 */
export function swipeEnabled(platform: string, maxTouchPoints: number): boolean {
  return platform !== 'web' || maxTouchPoints > 0;
}
