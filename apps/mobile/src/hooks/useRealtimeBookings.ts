import { useEffect } from 'react';
import { getSupabase } from '@nexofit/core';
import { useAuth } from '../contexts/AuthContext';
import { emitBookingsChanged } from '../utils/bookingEvents';
import { createDebouncer } from '../utils/debounce';

/**
 * Mantiene los cupos y las reservas en vivo: escucha cambios de `bookings`
 * (publicados por la migración 000006) y avisa al bus que ya usan
 * `useSchedule` y `useBookings`. Realtime aplica RLS: solo llegan filas de
 * la organización del usuario. Si Realtime no está habilitado, no hace nada.
 */
export function useRealtimeBookings(): void {
  const { membership } = useAuth();
  const organizationId = membership?.organization_id ?? '';

  useEffect(() => {
    if (!organizationId) return;

    const supabase = getSupabase();
    // Reservar + promoción de lista llegan como eventos seguidos: se
    // agrupan en un solo refresh para no recargar las pantallas de más.
    const debouncer = createDebouncer(() => emitBookingsChanged(), 400);

    const channel = supabase
      .channel(`bookings:${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        debouncer.trigger();
      })
      .subscribe();

    return () => {
      debouncer.cancel();
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);
}
