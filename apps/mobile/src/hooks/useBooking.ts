import { useState, useEffect, useCallback } from 'react';
import { getSupabase, type SessionPublic, type BookingPublic } from '@nexofit/core';

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
    setLoading(true);
    setError(null);

    const start = date ?? new Date().toISOString().split('T')[0];
    const end = new Date(new Date(start).getTime() + 86400000).toISOString().split('T')[0];

    const { data, error: fetchErr } = await supabase
      .from('sessions')
      .select(
        `
        id,
        organization_id,
        class_type_id,
        venue_id,
        space_id,
        coach_id,
        start_at,
        end_at,
        capacity_override,
        status,
        notes,
        created_at,
        updated_at,
        class_types ( name, emoji ),
        venues ( name ),
        spaces ( name ),
        profiles:coach_id ( full_name )
      `
      )
      .eq('organization_id', organizationId)
      .gte('start_at', `${start}T00:00:00Z`)
      .lt('start_at', `${end}T00:00:00Z`)
      .in('status', ['scheduled', 'in_progress'])
      .order('start_at');

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setSessions((data as SessionPublic[]) ?? []);
    }

    setLoading(false);
  }, [organizationId, date]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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
    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await supabase
      .from('bookings')
      .select(
        `
        id,
        session_id,
        profile_id,
        status,
        position,
        booked_at,
        confirmed_at,
        cancelled_at,
        sessions (
          id,
          start_at,
          end_at,
          class_types ( name, emoji ),
          venues ( name ),
          spaces ( name )
        )
      `
      )
      .eq('profile_id', profileId)
      .in('status', ['confirmed', 'waitlist'])
      .order('booked_at', { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setBookings((data as BookingPublic[]) ?? []);
    }

    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, refresh: fetchBookings };
}

export async function bookSession(
  sessionId: string,
  profileId: string
): Promise<{ success: boolean; error?: string; position?: number }> {
  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('book_session', {
    p_session_id: sessionId,
    p_profile_id: profileId,
  });

  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; error?: string; position?: number };
  return result;
}

export async function cancelBooking(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('cancel_booking', {
    p_booking_id: bookingId,
  });

  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; error?: string };
  return result;
}
