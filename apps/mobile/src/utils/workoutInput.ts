// Lectura de los campos numéricos del registro de entrenamiento.

/** Peso: acepta coma decimal (teclado es-ES: «40,5» → 40.5). null si está vacío o es inválido. */
export function parseWeight(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isNaN(n) || n < 0 ? null : n;
}

/**
 * Repeticiones: la columna es un entero, así que «8,5» se redondea a 9 en vez
 * de hacer fallar el guardado con «invalid input syntax for type integer».
 */
export function parseReps(raw: string): number | null {
  const n = parseWeight(raw);
  return n == null ? null : Math.round(n);
}
