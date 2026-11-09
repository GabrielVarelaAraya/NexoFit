/**
 * Nombre corto para saludar: el primer nombre del perfil o, si no hay nombre,
 * la parte local del correo. Nunca devuelve una cadena vacía.
 */
export function greetingName(fullName?: string | null, email?: string | null): string {
  const first = fullName?.trim().split(/\s+/)[0];
  if (first) return first;
  const local = email?.split('@')[0]?.trim();
  return local || 'de nuevo';
}

export function greeting(fullName?: string | null, email?: string | null): string {
  return `Hola, ${greetingName(fullName, email)}`;
}
