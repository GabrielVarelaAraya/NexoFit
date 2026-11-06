/**
 * Convierte un error técnico (Supabase/Postgres/red) en un mensaje apto para
 * la persona usuaria. El detalle crudo SIEMPRE se registra en consola para
 * depuración; nunca llega a la pantalla.
 *
 * `fallback` debe ser copy en español, sin jerga técnica, y específico del
 * momento (ej. 'No se pudieron cargar los pagos.').
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
