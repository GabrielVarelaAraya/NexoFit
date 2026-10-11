import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@nexofit/core';

type Client = SupabaseClient<Database>;
export type Professional = Database['public']['Tables']['professionals']['Row'];
export type Availability = Database['public']['Tables']['availability']['Row'];
export type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  patient: { full_name: string | null; phone: string | null } | null;
  services: { name: string; duration_minutes: number } | null;
};
export interface ProfessionalWorkspace {
  professional: Professional;
  appointments: Appointment[];
  availability: Availability[];
}
export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const APPOINTMENT_STATUS = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  attended: 'Atendida',
  no_show: 'No asistió',
};

export function parseClockTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function availabilityError(
  day: number,
  start: string,
  end: string,
  existing: Pick<Availability, 'day_of_week' | 'start_time' | 'end_time'>[]
): string | undefined {
  if (!Number.isInteger(day) || day < 0 || day > 6) return 'Selecciona un día válido.';
  const from = parseClockTime(start);
  const to = parseClockTime(end);
  if (from === null || to === null) return 'Usa horas en formato HH:mm, por ejemplo 08:30.';
  if (to <= from) return 'La hora final debe ser posterior a la inicial.';
  if (
    existing.some(
      (block) =>
        block.day_of_week === day &&
        from < (parseClockTime(block.end_time.slice(0, 5)) ?? 0) &&
        to > (parseClockTime(block.start_time.slice(0, 5)) ?? 0)
    )
  ) {
    return 'Este horario se superpone con otro bloque del mismo día.';
  }
  return undefined;
}

export function appointmentActionError(
  appointment: Pick<Appointment, 'status' | 'starts_at' | 'ends_at'>,
  status: 'cancelled' | 'attended' | 'no_show',
  now = Date.now()
): string | undefined {
  if (appointment.status !== 'confirmed') return 'Esta cita ya fue actualizada. Recarga la agenda.';
  if (status === 'attended' && now < new Date(appointment.starts_at).getTime()) {
    return 'Solo puedes marcar una cita atendida después de su hora de inicio.';
  }
  if (status === 'no_show' && now < new Date(appointment.ends_at).getTime()) {
    return 'Espera a que termine la cita para registrar una ausencia.';
  }
  return undefined;
}

export async function fetchProfessionalWorkspace(
  client: Client,
  membershipId: string,
  organizationId: string,
  includeSchedule = true
): Promise<ProfessionalWorkspace> {
  const { data: professional, error } = await client
    .from('professionals')
    .select('*')
    .eq('membership_id', membershipId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!professional)
    throw new Error(
      'No encontramos tu ficha profesional. Contacta al administrador del gimnasio para completar tu acceso.'
    );
  if (!includeSchedule) return { professional, appointments: [], availability: [] };
  const [appointments, availability] = await Promise.all([
    client
      .from('appointments')
      .select(
        '*, patient:profiles!appointments_profile_id_fkey(full_name, phone), services(name, duration_minutes)'
      )
      .eq('organization_id', organizationId)
      .eq('professional_id', professional.id)
      .order('starts_at'),
    client
      .from('availability')
      .select('*')
      .eq('professional_id', professional.id)
      .order('day_of_week')
      .order('start_time'),
  ]);
  if (appointments.error) throw appointments.error;
  if (availability.error) throw availability.error;
  return {
    professional,
    appointments: appointments.data as Appointment[],
    availability: availability.data,
  };
}

export async function updateProfessionalAppointment(
  client: Client,
  organizationId: string,
  professionalId: string,
  appointment: Appointment,
  status: 'cancelled' | 'attended' | 'no_show'
) {
  const validation = appointmentActionError(appointment, status);
  if (validation) throw new Error(validation);
  const { data, error } = await client
    .from('appointments')
    .update({ status, cancelled_at: status === 'cancelled' ? new Date().toISOString() : null })
    .eq('id', appointment.id)
    .eq('organization_id', organizationId)
    .eq('professional_id', professionalId)
    .eq('status', 'confirmed')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error('La cita cambió o ya no tienes permiso para actualizarla. Recarga la agenda.');
}

export async function addProfessionalAvailability(
  client: Client,
  professionalId: string,
  day: number,
  start: string,
  end: string,
  existing: Availability[]
) {
  const validation = availabilityError(day, start, end, existing);
  if (validation) throw new Error(validation);
  const { error } = await client.from('availability').insert({
    professional_id: professionalId,
    day_of_week: day,
    start_time: start,
    end_time: end,
  });
  if (error) throw error;
}

export async function deleteProfessionalAvailability(
  client: Client,
  professionalId: string,
  id: string
) {
  const { data, error } = await client
    .from('availability')
    .delete()
    .eq('id', id)
    .eq('professional_id', professionalId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No se pudo eliminar el horario. Recarga la disponibilidad.');
}

export async function saveProfessionalProfile(
  client: Client,
  membershipId: string,
  professionalId: string,
  specialization: string,
  bio: string
) {
  if (!specialization.trim()) throw new Error('Ingresa tu especialidad.');
  const { data, error } = await client
    .from('professionals')
    .update({ specialization: specialization.trim(), bio: bio.trim() || null })
    .eq('id', professionalId)
    .eq('membership_id', membershipId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No tienes permiso para actualizar esta ficha.');
}
