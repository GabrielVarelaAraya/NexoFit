import { useEffect, useRef } from 'react';
import { getSupabase } from '@nexofit/core';
import { createDebouncer } from '../utils/debounce';

/**
 * Llama a `onChange` cuando cambia una cita relevante para la persona:
 * las suyas como miembro (`profile_id`) o las que atiende como profesional
 * (`professional_id`). Escucha la tabla `appointments`, publicada por la
 * migración 000008; Realtime aplica RLS. Sin Realtime no hace nada y las
 * pantallas siguen actualizándose al enfocarse o al deslizar para refrescar.
 */
export function useRealtimeAppointments(
  column: 'profile_id' | 'professional_id',
  value: string | undefined,
  onChange: () => void
): void {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    if (!value) return;

    const supabase = getSupabase();
    // Varios eventos seguidos (reserva + notificación, etc.) → un solo refresh.
    const debouncer = createDebouncer(() => latest.current(), 400);

    const channel = supabase
      .channel(`appointments:${column}:${value}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `${column}=eq.${value}` },
        () => debouncer.trigger()
      )
      .subscribe();

    return () => {
      debouncer.cancel();
      void supabase.removeChannel(channel);
    };
  }, [column, value]);
}
