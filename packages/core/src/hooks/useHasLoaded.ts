import { useEffect, useRef, useState } from 'react';

/** Marca «todavía no terminó ninguna carga para esta clave». */
const NOT_LOADED = Symbol('not-loaded');

/**
 * Paso puro del hook: una carga termina cuando `loading` pasa de true a false;
 * en ese momento se recuerda para qué clave se completó.
 */
export function nextLoadedKey<K>(
  previousLoading: boolean,
  loading: boolean,
  loadedKey: K | typeof NOT_LOADED,
  key: K | undefined
): K | undefined | typeof NOT_LOADED {
  return previousLoading && !loading ? key : loadedKey;
}

/**
 * ¿Ya terminó la primera carga (de esta clave)? Sirve para mostrar el
 * skeleton solo en la carga inicial y no en los refrescos posteriores:
 *
 *   const hasLoaded = useHasLoaded(loading);
 *   const showSkeleton = loading && !hasLoaded;
 *
 * Sin esto, al volver a una pestaña ya cargada el skeleton tapaba por un
 * instante datos que ya estaban en pantalla (contenido → skeleton → contenido).
 *
 * `key` reinicia la regla cuando cambia el conjunto de datos (p. ej. el día
 * elegido en una agenda): ahí sí corresponde volver a mostrar el skeleton, para
 * no enseñar los datos del día anterior mientras llegan los nuevos.
 */
export function useHasLoaded<K = undefined>(loading: boolean, key?: K): boolean {
  const [loadedKey, setLoadedKey] = useState<K | undefined | typeof NOT_LOADED>(
    loading ? NOT_LOADED : key
  );
  const previousLoading = useRef(loading);

  useEffect(() => {
    // Se captura ANTES: React ejecuta el actualizador más tarde, cuando
    // `previousLoading.current` ya fue sobrescrito y la carga nunca contaría
    // como terminada.
    const wasLoading = previousLoading.current;
    previousLoading.current = loading;
    setLoadedKey((current) => nextLoadedKey(wasLoading, loading, current, key));
  }, [loading, key]);

  return Object.is(loadedKey, key);
}

/** Skeleton solo en la carga inicial; los refrescos conservan el contenido. */
export function shouldShowSkeleton(loading: boolean, hasLoaded: boolean): boolean {
  return loading && !hasLoaded;
}
