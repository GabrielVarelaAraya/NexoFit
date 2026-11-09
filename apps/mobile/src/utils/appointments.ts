import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@nexofit/core';
import { parseClockTime } from './professional';

type Client = SupabaseClient<Database>;

export interface AvailabilityBlock {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface BusyRange {
  start: Date;
  end: Date;
}

export interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
}

export interface ProfessionalOffer {
  services: ServiceOption[];
  blocks: AvailabilityBlock[];
}

export interface DirectoryProfessional {
  professionalId: string;
  fullName: string | null;
  specialization: string;
  bio: string | null;
}

export interface BookingOutcome {
  success: boolean;
  error?: string;
  appointmentId?: string;
}

export interface CancelOutcome {
  success: boolean;
  error?: string;
}

/** Días hacia adelante (incluido hoy) en los que se puede reservar. */
export const BOOKING_HORIZON_DAYS = 14;

const BOOKING_FALLBACK = 'No se pudo reservar la cita. Inténtalo de nuevo.';
const CANCEL_FALLBACK = 'No se pudo cancelar la cita. Inténtalo de nuevo.';

// ------------------------------------------------------------
// Hora del gimnasio
//
// La disponibilidad se guarda como hora de pared de America/Costa_Rica
// (UTC-6, sin horario de verano) y la base de datos la interpreta así.
// Todo el cálculo de huecos y su formato usa ese desfase fijo, para que
// el resultado no dependa de la zona horaria del dispositivo.
// ------------------------------------------------------------

const GYM_OFFSET_MS = 6 * 60 * 60_000;
const MINUTE_MS = 60_000;

const pad = (value: number) => String(value).padStart(2, '0');

export const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function parseDateStr(dateStr: string): [number, number, number] {
  const [year, month, day] = dateStr.split('-').map(Number);
  return [year, month - 1, day];
}

/** 'YYYY-MM-DD' del día calendario del gimnasio en el instante indicado. */
export function gymDateStr(now: Date = new Date()): string {
  return new Date(now.getTime() - GYM_OFFSET_MS).toISOString().slice(0, 10);
}

/** Suma días a una fecha 'YYYY-MM-DD'. */
export function addDaysStr(dateStr: string, days: number): string {
  const [year, month, day] = parseDateStr(dateStr);
  return new Date(Date.UTC(year, month, day + days)).toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo, igual que SQL) de una fecha del gimnasio. */
export function gymDayOfWeek(dateStr: string): number {
  const [year, month, day] = parseDateStr(dateStr);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

/** Instante en que empieza (00:00 hora del gimnasio) la fecha indicada. */
export function gymDayStart(dateStr: string): Date {
  const [year, month, day] = parseDateStr(dateStr);
  return new Date(Date.UTC(year, month, day) + GYM_OFFSET_MS);
}

const toGym = (date: Date) => new Date(date.getTime() - GYM_OFFSET_MS);

/** 'HH:mm' en hora del gimnasio. */
export function formatGymTime(date: Date): string {
  const gym = toGym(date);
  return `${pad(gym.getUTCHours())}:${pad(gym.getUTCMinutes())}`;
}

/** 'lun 9 nov' en hora del gimnasio. */
export function formatGymDate(date: Date): string {
  const gym = toGym(date);
  return `${WEEKDAYS_SHORT[gym.getUTCDay()]} ${gym.getUTCDate()} ${MONTHS_SHORT[gym.getUTCMonth()]}`;
}

/** Partes para dibujar un día en el selector de fechas. */
export function gymDateParts(dateStr: string): { weekday: string; day: number; month: string } {
  const [year, month, day] = parseDateStr(dateStr);
  const date = new Date(Date.UTC(year, month, day));
  return {
    weekday: WEEKDAYS_SHORT[date.getUTCDay()],
    day,
    month: MONTHS_SHORT[month],
  };
}

const clockMinutes = (value: string): number | null => parseClockTime(value.slice(0, 5));

/**
 * Huecos disponibles para una fecha del gimnasio ('YYYY-MM-DD'), derivados de
 * los bloques semanales de disponibilidad y la duración del servicio.
 *
 * - Solo los bloques del mismo día de la semana (0 = domingo, igual que SQL).
 * - El servicio se encadena dentro de cada bloque: hueco completo solo si
 *   termina a la hora o antes del fin del bloque.
 * - Se descartan los huecos que ya empezaron y los que se solapan con una
 *   cita ocupada (`busy`).
 */
export function gymSlotsForDate(
  blocks: AvailabilityBlock[],
  durationMinutes: number,
  dateStr: string,
  now: Date = new Date(),
  busy: BusyRange[] = []
): TimeSlot[] {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];
  const weekday = gymDayOfWeek(dateStr);
  const dayStart = gymDayStart(dateStr).getTime();
  const slots: TimeSlot[] = [];

  for (const block of blocks) {
    if (block.day_of_week !== weekday) continue;
    const blockStart = clockMinutes(block.start_time);
    const blockEnd = clockMinutes(block.end_time);
    if (blockStart === null || blockEnd === null) continue;

    for (
      let minutes = blockStart;
      minutes + durationMinutes <= blockEnd;
      minutes += durationMinutes
    ) {
      const startMs = dayStart + minutes * MINUTE_MS;
      if (startMs <= now.getTime()) continue;
      const endMs = startMs + durationMinutes * MINUTE_MS;
      const taken = busy.some(
        (range) => startMs < range.end.getTime() && endMs > range.start.getTime()
      );
      if (taken) continue;
      slots.push({ start: new Date(startMs), end: new Date(endMs) });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ------------------------------------------------------------
// Estado de una cita
// ------------------------------------------------------------

export type AppointmentTone = 'upcoming' | 'done' | 'cancelled' | 'warning';

export function appointmentBadge(
  status: string,
  endsAt: string,
  now: Date = new Date()
): { label: string; tone: AppointmentTone } {
  if (status === 'cancelled') return { label: 'Cancelada', tone: 'cancelled' };
  if (status === 'attended') return { label: 'Atendida', tone: 'done' };
  if (status === 'no_show') return { label: 'No asististe', tone: 'warning' };
  if (new Date(endsAt).getTime() < now.getTime()) return { label: 'Finalizada', tone: 'done' };
  return { label: 'Confirmada', tone: 'upcoming' };
}

/**
 * Separa citas en próximas (confirmadas que aún no terminan, la más cercana
 * primero) y anteriores (pasadas o canceladas, la más reciente primero).
 */
export function splitAppointments<T extends { status: string; starts_at: string; ends_at: string }>(
  items: readonly T[],
  now: Date = new Date()
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const item of items) {
    const isUpcoming =
      item.status === 'confirmed' && new Date(item.ends_at).getTime() >= now.getTime();
    (isUpcoming ? upcoming : past).push(item);
  }
  const startOf = (item: T) => new Date(item.starts_at).getTime();
  upcoming.sort((a, b) => startOf(a) - startOf(b));
  past.sort((a, b) => startOf(b) - startOf(a));
  return { upcoming, past };
}

/** El miembro solo puede cancelar citas confirmadas que aún no empiezan. */
export function canCancelAppointment(
  status: string,
  startsAt: string,
  now: Date = new Date()
): boolean {
  return status === 'confirmed' && new Date(startsAt).getTime() > now.getTime();
}

// ------------------------------------------------------------
// Resultados de RPC
// ------------------------------------------------------------

/**
 * Traduce la respuesta JSON de `book_appointment` a un resultado de app.
 * Los mensajes del RPC son copy de negocio en español y pasan tal cual.
 */
export function bookingResult(data: unknown): BookingOutcome {
  const result = data as { status?: string; message?: string; appointment_id?: string } | null;
  if (result?.status === 'confirmed') {
    return { success: true, appointmentId: result.appointment_id };
  }
  return { success: false, error: result?.message ?? BOOKING_FALLBACK };
}

/** Traduce la respuesta JSON de `cancel_appointment`. */
export function cancelResult(data: unknown): CancelOutcome {
  const result = data as { status?: string; message?: string } | null;
  if (result?.status === 'cancelled' || result?.status === 'already_cancelled') {
    return { success: true };
  }
  return { success: false, error: result?.message ?? CANCEL_FALLBACK };
}

// ------------------------------------------------------------
// Acceso a datos
// ------------------------------------------------------------

/**
 * Reserva una cita vía RPC (disponibilidad y conflictos se validan en la
 * base de datos). El detalle técnico solo va a consola.
 */
export async function bookAppointment(
  client: Client,
  params: { professionalId: string; serviceId: string; startsAt: string }
): Promise<BookingOutcome> {
  const { data, error } = await client.rpc('book_appointment', {
    p_professional_id: params.professionalId,
    p_service_id: params.serviceId,
    p_starts_at: params.startsAt,
  });

  if (error) {
    console.warn('book appointment failed', error.message);
    return { success: false, error: BOOKING_FALLBACK };
  }

  return bookingResult(data);
}

/** Cancela una cita propia vía RPC. */
export async function cancelAppointment(
  client: Client,
  appointmentId: string
): Promise<CancelOutcome> {
  const { data, error } = await client.rpc('cancel_appointment', {
    p_appointment_id: appointmentId,
  });

  if (error) {
    console.warn('cancel appointment failed', error.message);
    return { success: false, error: CANCEL_FALLBACK };
  }

  return cancelResult(data);
}

/** Profesionales de los gimnasios de la persona usuaria (con nombre). */
export async function fetchProfessionalDirectory(client: Client): Promise<DirectoryProfessional[]> {
  const { data, error } = await client.rpc('list_org_professionals');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    professionalId: row.professional_id,
    fullName: row.full_name,
    specialization: row.specialization,
    bio: row.bio,
  }));
}

/** Servicios y bloques de disponibilidad de un profesional. */
export async function fetchProfessionalOffer(
  client: Client,
  professionalId: string
): Promise<ProfessionalOffer> {
  const [services, availability] = await Promise.all([
    client
      .from('services')
      .select('id, name, description, duration_minutes')
      .eq('professional_id', professionalId)
      .order('name'),
    client
      .from('availability')
      .select('day_of_week, start_time, end_time')
      .eq('professional_id', professionalId),
  ]);
  if (services.error) throw services.error;
  if (availability.error) throw availability.error;
  return { services: services.data ?? [], blocks: availability.data ?? [] };
}

/** Rangos ocupados de un profesional (sin datos personales). */
export async function fetchBusySlots(
  client: Client,
  professionalId: string,
  from: Date,
  to: Date
): Promise<BusyRange[]> {
  const { data, error } = await client.rpc('get_busy_slots', {
    p_professional_id: professionalId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    start: new Date(row.busy_start),
    end: new Date(row.busy_end),
  }));
}
