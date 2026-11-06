// Transiciones de carga suaves (mismo criterio que la app móvil): cada
// pantalla que pide datos muestra su spinner durante al menos MIN_LOADING_MS,
// aunque la respuesta llegue antes. Decisión explícita de UX.
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
