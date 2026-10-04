// Bus de eventos mínimo para reservas: avisa a los hooks (useSchedule) cuando
// book_session / cancel_booking cambian datos, para que los cupos se
// recalculen al instante (19 → 20 tras cancelar) sin depender de que la
// pantalla vuelva a tener foco.
type Listener = () => void;

const listeners = new Set<Listener>();

/** Suscribe a cambios de reservas; devuelve la función de baja. */
export function onBookingsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notifica que hubo un cambio de reservas/lista de espera. */
export function emitBookingsChanged(): void {
  listeners.forEach((listener) => listener());
}
