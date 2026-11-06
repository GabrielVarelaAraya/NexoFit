/**
 * Convierte un error técnico (Supabase/Postgres/red) en un mensaje apto para
 * la persona usuaria. El detalle crudo SIEMPRE se registra en consola para
 * depuración; nunca llega a la pantalla.
 *
 * `fallback` debe ser copy en español, sin jerga técnica, y específico del
 * momento (ej. 'No se pudo guardar la reserva.').
 */
export function friendlyError(error: unknown, fallback: string): string {
  const raw = extractMessage(error);
  if (raw) console.warn('[nexofit]', raw);
  if (/network request failed|failed to fetch|load failed/i.test(raw)) {
    return 'Sin conexión. Revisa tu red e inténtalo de nuevo.';
  }
  return fallback;
}

/** Soporta Error, string y objetos tipo PostgrestError ({ message, code, ... }). */
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

/**
 * Para `catch` mixtos: el bloque puede lanzar errores de negocio propios
 * (Error sin `code`, copy en español — ej. validaciones) Y errores técnicos
 * de Supabase/Postgres/red. Los técnicos se ocultan tras `fallback`; los de
 * negocio pasan tal cual para no perder la explicación concreta.
 */
export function caughtError(cause: unknown, fallback: string): string {
  const technical =
    cause instanceof TypeError || // fetch: 'Network request failed'
    (cause instanceof Error && typeof (cause as { code?: unknown }).code === 'string');
  if (!technical && cause instanceof Error && cause.message) {
    return cause.message;
  }
  return friendlyError(cause, fallback);
}
