import { useState, useEffect, useCallback } from 'react';
import { getSupabase, type SessionPublic, type BookingPublic } from '@nexofit/core';
import { toLocalDateStr, startOfLocalDay, endOfLocalDay } from '../utils/date';
import { holdLoading } from '../utils/loading';
import { onBookingsChanged, emitBookingsChanged } from '../utils/bookingEvents';

// Columnas reales de la tabla sessions (migración 000001):
// id, class_type_id, space_id, coach_id, starts_at, ends_at, capacity_override, created_at
// No existe organization_id ni venue_id: el ámbito de organización se filtra vía
// class_types.organization_id, y la sede se alcanza por spaces -> venues.
const SESSION_SELECT = `
  id,
  class_type_id,
  space_id,
  coach_id,
  starts_at,
  ends_at,
  capacity_override,
  created_at,
  class_types!inner ( name ),
  spaces ( name, capacity, venues ( name ) ),
  coaches ( memberships ( profiles ( full_name ) ) )
`;

interface UseScheduleResult {
  sessions: SessionPublic[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSchedule(organizationId: string, date?: string): UseScheduleResult {
  const [sessions, setSessions] = useState<SessionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabase();

  const fetchSessions = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      if (!organizationId) {
        setSessions([]);
        return;
      }

      // Día en zona horaria LOCAL: un filtro UTC (T00:00:00Z) mete las clases
      // de la tarde en el día siguiente para husos negativos (México, etc.).
      const start = date ?? toLocalDateStr();
      const dayStart = startOfLocalDay(start).toISOString();
      const dayEnd = endOfLocalDay(start).toISOString();

      const { data, error: fetchErr } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .eq('class_types.organization_id', organizationId)
        .gte('starts_at', dayStart)
        .lt('starts_at', dayEnd)
        .order('starts_at');

      if (fetchErr) {
        setError(fetchErr.message);
        setSessions([]);
        return;
      }

      const rows = data ?? [];

      // Cupos ocupados: get_session_capacity es SECURITY DEFINER y devuelve el
      // conteo global. Contar bookings desde la app es incorrecto para un
      // miembro normal: booking_select solo le deja ver SUS reservas.
      const counts: Record<string, number> = {};
      if (rows.length > 0) {
        const ids = rows.map((s) => s.id);
        const capacityResults = await Promise.all(
          ids.map((id) => supabase.rpc('get_session_capacity', { p_session_id: id }))
        );

        const missing: string[] = [];
        capacityResults.forEach((res, i) => {
          const payload = res.data as { current_bookings?: number } | null;
          if (!res.error && payload && typeof payload.current_bookings === 'number') {
            counts[ids[i]] = payload.current_bookings;
          } else {
            missing.push(ids[i]);
          }
        });

        // Fallback (solo si la RPC no está disponible): conteo propio vía bookings.
        if (missing.length > 0) {
          const { data: bookingRows } = await supabase
            .from('bookings')
            .select('session_id')
            .eq('status', 'confirmed')
            .in('session_id', missing);
          for (const row of bookingRows ?? []) {
            counts[row.session_id] = (counts[row.session_id] ?? 0) + 1;
          }
        }
      }

      setSessions(rows.map((s) => ({ ...s, booking_count: counts[s.id] ?? 0 })));
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId, date]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Cupos en vivo: al reservar/cancelar (aún con otra pantalla encima),
  // refrescar de inmediato para que los cupos libres vuelvan al instante.
  useEffect(() => {
    if (!organizationId) return;
    return onBookingsChanged(fetchSessions);
  }, [organizationId, fetchSessions]);

  return { sessions, loading, error, refresh: fetchSessions };
}

interface UseBookingsResult {
  bookings: BookingPublic[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBookings(profileId: string): UseBookingsResult {
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabase();

  const fetchBookings = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      if (!profileId) {
        setBookings([]);
        return;
      }

      // Reservas (enum real: confirmed | cancelled | attended | no_show)
      const { data, error: fetchErr } = await supabase
        .from('bookings')
        .select(
          `
        id,
        session_id,
        profile_id,
        status,
        created_at,
        cancelled_at,
        sessions (
          id,
          starts_at,
          ends_at,
          class_types ( name )
        )
      `
        )
        .eq('profile_id', profileId)
        .in('status', ['confirmed', 'attended'])
        .order('created_at', { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        setBookings([]);
        return;
      }

      // Lista de espera: vive en waitlist_positions, no en bookings.status
      const { data: waitlistRows, error: waitlistErr } = await supabase
        .from('waitlist_positions')
        .select(
          `
        id,
        session_id,
        position,
        created_at,
        sessions (
          id,
          starts_at,
          ends_at,
          class_types ( name )
        )
      `
        )
        .eq('profile_id', profileId)
        .order('position', { ascending: true });

      if (waitlistErr) {
        setError(waitlistErr.message);
        setBookings((data ?? []) as BookingPublic[]);
        return;
      }

      const confirmed = (data ?? []) as BookingPublic[];
      const waitlisted: BookingPublic[] = (waitlistRows ?? []).map((w) => ({
        id: w.id,
        session_id: w.session_id,
        profile_id: profileId,
        status: 'waitlist',
        created_at: w.created_at,
        cancelled_at: null,
        position: w.position,
        sessions: w.sessions,
      }));

      const merged = [...confirmed, ...waitlisted].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setBookings(merged);
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, refresh: fetchBookings };
}

interface BookSessionResult {
  success: boolean;
  error?: string;
  position?: number;
}

export async function bookSession(
  sessionId: string,
  profileId: string
): Promise<BookSessionResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('book_session', {
    p_session_id: sessionId,
    p_profile_id: profileId,
  });

  if (error) {
    // 23505 = UNIQUE(session_id, profile_id) en waitlist_positions:
    // el usuario ya estaba en la lista (tapped "Unirse" dos veces).
    if (error.code === '23505') {
      return { success: false, error: 'Ya estás en la lista de espera de esta clase.' };
    }
    return { success: false, error: error.message };
  }

  // book_session devuelve { status, message, ... }. 'position' puede venir como
  // record anidado ({ position: n }) porque se construye con un record de PL/pgSQL.
  const result = data as {
    status?: string;
    message?: string;
    position?: number | { position?: number };
    spots_remaining?: number;
  };

  const rawPosition = result?.position;
  const position =
    typeof rawPosition === 'object' && rawPosition !== null ? rawPosition.position : rawPosition;

  switch (result?.status) {
    case 'confirmed':
      // Avisar a useSchedule para que recalcule cupos al instante.
      emitBookingsChanged();
      return { success: true };
    case 'waitlisted':
      emitBookingsChanged();
      return { success: true, position };
    case 'already_waitlisted':
      // Ya estaba en la lista: no es un error, solo se le informa su posición.
      return { success: true, position };
    case 'already_booked':
      return { success: false, error: 'Ya tienes una reserva confirmada para esta clase.' };
    default:
      return { success: false, error: result?.message ?? 'No se pudo completar la reserva.' };
  }
}

export async function cancelBooking(
  bookingId: string,
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_profile_id: profileId,
  });

  if (error) return { success: false, error: error.message };

  const result = data as { status?: string; message?: string };
  if (result?.status === 'cancelled') {
    // La cancelación libera un cupo (y puede promover a alguien de lista):
    // refrescar los conteos en todas las pantallas.
    emitBookingsChanged();
    return { success: true };
  }

  return { success: false, error: 'No se pudo cancelar la reserva.' };
}

// cancel_booking solo opera sobre bookings; las entradas de lista de espera
// viven en waitlist_positions y se retiran con un delete directo
// (política waitlist_delete permite profile_id = auth.uid()).
export async function cancelWaitlistEntry(
  entryId: string,
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('waitlist_positions')
    .delete()
    .eq('id', entryId)
    .eq('profile_id', profileId);

  if (error) return { success: false, error: error.message };
  emitBookingsChanged();
  return { success: true };
}

interface UseRecommendationsResult {
  sessions: SessionPublic[];
  loading: boolean;
  refresh: () => Promise<void>;
}

// ============================================================
// Stage 5 · Recomendaciones: clases de tus tipos favoritos que aún no
// has reservado, según tu historial. Sin historial => sin sección
// (no inventamos recomendaciones).
// ============================================================
export function useRecommendations(
  organizationId: string,
  profileId: string
): UseRecommendationsResult {
  const [sessions, setSessions] = useState<SessionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  const fetchRecommendations = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    try {
      if (!organizationId || !profileId) {
        setSessions([]);
        return;
      }

      // 1) Historial: tipos de clase más reservados + todo lo que ya
      //    involucra al miembro en una sesión (para excluirlo).
      const [historyRes, waitlistRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('session_id, sessions ( class_type_id )')
          .eq('profile_id', profileId)
          .in('status', ['confirmed', 'attended']),
        supabase.from('waitlist_positions').select('session_id').eq('profile_id', profileId),
      ]);

      const history = (historyRes.data ?? []) as unknown as {
        session_id: string;
        sessions: { class_type_id: string } | null;
      }[];

      const frequency = new Map<string, number>();
      for (const row of history) {
        const typeId = row.sessions?.class_type_id;
        if (typeId) frequency.set(typeId, (frequency.get(typeId) ?? 0) + 1);
      }

      if (frequency.size === 0) {
        setSessions([]);
        return;
      }

      const topTypes = [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([typeId]) => typeId);

      const excluded = new Set<string>([
        ...history.map((row) => row.session_id),
        ...((waitlistRes.data ?? []) as { session_id: string }[]).map((row) => row.session_id),
      ]);

      // 2) Candidatas futuras (próximos 7 días) de esos tipos.
      const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: fetchErr } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .eq('class_types.organization_id', organizationId)
        .in('class_type_id', topTypes)
        .gte('starts_at', new Date().toISOString())
        .lt('starts_at', weekEnd)
        .order('starts_at', { ascending: true })
        .limit(12);

      if (fetchErr) {
        setSessions([]);
        return;
      }

      const candidates = (data ?? []).filter((s) => !excluded.has(s.id)).slice(0, 3);

      // 3) Cupos ocupados solo para las 3 elegidas (mismas razones que useSchedule).
      const counts: Record<string, number> = {};
      if (candidates.length > 0) {
        const capacityResults = await Promise.all(
          candidates.map((s) => supabase.rpc('get_session_capacity', { p_session_id: s.id }))
        );
        capacityResults.forEach((res, i) => {
          const payload = res.data as { current_bookings?: number } | null;
          if (!res.error && payload && typeof payload.current_bookings === 'number') {
            counts[candidates[i].id] = payload.current_bookings;
          }
        });
      }

      setSessions(candidates.map((s) => ({ ...s, booking_count: counts[s.id] ?? 0 })));
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [organizationId, profileId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return { sessions, loading, refresh: fetchRecommendations };
}
