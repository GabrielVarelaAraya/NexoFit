// Agrupa ráfagas de eventos (p. ej. una reserva + su promoción de lista de
// espera) en una sola llamada, para no refrescar las pantallas en exceso.
export interface Debouncer {
  trigger: () => void;
  cancel: () => void;
}

export function createDebouncer(fn: () => void, waitMs = 400): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    trigger() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, waitMs);
    },
    cancel,
  };
}
