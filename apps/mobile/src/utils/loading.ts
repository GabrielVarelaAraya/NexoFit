// Transiciones de carga suaves: cada pantalla que pide datos muestra su
// spinner durante al menos MIN_LOADING_MS, aunque la respuesta llegue antes.
// Así el cambio vacío → contenido se lee como una transición intencional y
// no como un parpadeo (decisión explícita de UX: se acepta un pequeño delay).
export const MIN_LOADING_MS = 500;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mantiene el estado de carga visible hasta completar el tiempo mínimo. */
export async function holdLoading(
  startedAt: number,
  minMs: number = MIN_LOADING_MS
): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await sleep(remaining);
  }
}
