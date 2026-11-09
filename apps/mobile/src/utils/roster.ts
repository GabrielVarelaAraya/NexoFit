import type { getSupabase } from '@nexofit/core';

type Client = ReturnType<typeof getSupabase>;

export type RosterStatus = 'confirmed' | 'attended' | 'no_show' | 'cancelled';

export interface RosterEntry {
  bookingId: string;
  status: RosterStatus | string;
  fullName: string | null;
  phone: string | null;
}

/** Desde cuándo se puede pasar lista: 15 minutos antes del inicio. */
export const CHECK_IN_LEAD_MS = 15 * 60_000;

export function canTakeAttendance(startsAt: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(startsAt).getTime() - CHECK_IN_LEAD_MS;
}

/** Conteos para el encabezado del detalle de clase. */
export function rosterSummary(entries: readonly RosterEntry[]) {
  const count = (status: string) => entries.filter((entry) => entry.status === status).length;
  const attended = count('attended');
  const noShow = count('no_show');
  const confirmed = count('confirmed');
  return {
    // Ocupan cupo: confirmadas + ya marcadas (asistió o no vino).
    active: confirmed + attended + noShow,
    attended,
    noShow,
    pending: confirmed,
    cancelled: count('cancelled'),
  };
}

/**
 * Orden de la lista: primero quienes faltan por marcar, luego asistió / no vino
 * y al final las canceladas; dentro de cada grupo, por nombre.
 */
export function sortRoster(entries: readonly RosterEntry[]): RosterEntry[] {
  const rank: Record<string, number> = { confirmed: 0, attended: 1, no_show: 2, cancelled: 3 };
  return [...entries].sort(
    (a, b) =>
      (rank[a.status] ?? 4) - (rank[b.status] ?? 4) ||
      (a.fullName ?? '').localeCompare(b.fullName ?? '', 'es')
  );
}

/** Reservas de una clase con nombre y teléfono (RLS: solo admin/coach del gimnasio). */
export async function fetchRoster(client: Client, sessionId: string): Promise<RosterEntry[]> {
  const { data, error } = await client
    .from('bookings')
    .select('id, status, profiles ( full_name, phone )')
    .eq('session_id', sessionId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profile = row.profiles as { full_name: string | null; phone: string | null } | null;
    return {
      bookingId: row.id,
      status: row.status,
      fullName: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
    };
  });
}

/**
 * Marca asistencia cambiando el estado de la reserva. Se puede corregir
 * (volver a «confirmada»), por eso no se usa la tabla attendance, que no
 * admite borrar.
 */
export async function setBookingAttendance(
  client: Client,
  bookingId: string,
  status: 'confirmed' | 'attended' | 'no_show'
): Promise<void> {
  const { data, error } = await client
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select('id');
  if (error) throw error;
  // Con RLS, un UPDATE denegado no falla: solo afecta 0 filas.
  if (!data || data.length === 0) throw new Error('Sin permiso para actualizar la reserva.');
}
