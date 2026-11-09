import { describe, expect, it } from 'vitest';
import {
  addDaysStr,
  appointmentBadge,
  bookingResult,
  canCancelAppointment,
  cancelResult,
  formatGymDate,
  formatGymTime,
  gymDateParts,
  gymDateStr,
  gymDayOfWeek,
  gymSlotsForDate,
  splitAppointments,
  bookingStepNumber,
  missingStepHint,
  specialtyLabel,
  type AvailabilityBlock,
} from './appointments';

describe('booking flow helpers', () => {
  it('numbers steps with and without the professional step', () => {
    expect(bookingStepNumber('professional', true)).toBe(1);
    expect(bookingStepNumber('time', true)).toBe(4);
    expect(bookingStepNumber('service', false)).toBe(1);
    expect(bookingStepNumber('time', false)).toBe(3);
  });

  it('says what is missing, in order', () => {
    const base = { needsProfessional: false, hasService: true, hasSlot: true };
    expect(missingStepHint({ ...base, needsProfessional: true })).toMatch(/profesional/);
    expect(missingStepHint({ ...base, hasService: false })).toMatch(/servicio/);
    expect(missingStepHint({ ...base, hasSlot: false })).toMatch(/día y la hora/);
    expect(missingStepHint(base)).toBe('');
  });

  it('replaces empty or placeholder specialties', () => {
    expect(specialtyLabel('Nutrición')).toBe('Nutrición');
    expect(specialtyLabel('Por definir')).toBe('Profesional del gimnasio');
    expect(specialtyLabel(null)).toBe('Profesional del gimnasio');
  });
});

describe('splitAppointments', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const item = (id: string, status: string, startsAt: string, endsAt: string) => ({
    id,
    status,
    starts_at: startsAt,
    ends_at: endsAt,
  });

  const soon = item('soon', 'confirmed', '2026-11-11T15:00:00Z', '2026-11-11T16:00:00Z');
  const later = item('later', 'confirmed', '2026-11-20T15:00:00Z', '2026-11-20T16:00:00Z');
  const cancelledFuture = item('cf', 'cancelled', '2026-11-12T15:00:00Z', '2026-11-12T16:00:00Z');
  const done = item('done', 'confirmed', '2026-11-01T15:00:00Z', '2026-11-01T16:00:00Z');
  const older = item('older', 'attended', '2026-10-01T15:00:00Z', '2026-10-01T16:00:00Z');

  it('puts confirmed future appointments in upcoming, nearest first', () => {
    const { upcoming } = splitAppointments([later, done, soon, cancelledFuture], now);
    expect(upcoming.map((a) => a.id)).toEqual(['soon', 'later']);
  });

  it('puts past and cancelled appointments in past, most recent first', () => {
    const { past } = splitAppointments([older, cancelledFuture, soon, done], now);
    expect(past.map((a) => a.id)).toEqual(['cf', 'done', 'older']);
  });

  it('keeps an appointment in progress as upcoming', () => {
    const ongoing = item('now', 'confirmed', '2026-11-09T23:30:00Z', '2026-11-10T00:30:00Z');
    expect(splitAppointments([ongoing], now).upcoming).toHaveLength(1);
  });
});

// 9 de noviembre de 2026 es lunes (dow 1). 00:00 en Costa Rica = 06:00 UTC.
const MONDAY = '2026-11-09';
const LONG_BEFORE = new Date('2026-11-01T00:00:00Z');

const block = (day: number, start: string, end: string): AvailabilityBlock => ({
  day_of_week: day,
  start_time: start,
  end_time: end,
});

const starts = (slots: { start: Date }[]) => slots.map((slot) => slot.start.toISOString());

describe('gym calendar helpers', () => {
  it('uses the gym calendar day, not the UTC day', () => {
    // 03:00Z = 21:00 del 8 en Costa Rica.
    expect(gymDateStr(new Date('2026-11-09T03:00:00Z'))).toBe('2026-11-08');
    expect(gymDateStr(new Date('2026-11-09T06:00:00Z'))).toBe('2026-11-09');
  });

  it('adds days across month boundaries', () => {
    expect(addDaysStr('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysStr('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('computes the weekday like SQL (0 = Sunday)', () => {
    expect(gymDayOfWeek(MONDAY)).toBe(1);
    expect(gymDayOfWeek('2026-11-08')).toBe(0);
  });

  it('formats times and dates in gym time', () => {
    const start = new Date('2026-11-09T15:00:00Z');
    expect(formatGymTime(start)).toBe('09:00');
    expect(formatGymDate(start)).toBe('lun 9 nov');
    expect(formatGymTime(new Date('2026-11-09T03:30:00Z'))).toBe('21:30');
    expect(formatGymDate(new Date('2026-11-09T03:30:00Z'))).toBe('dom 8 nov');
  });

  it('splits a date for the day picker', () => {
    expect(gymDateParts(MONDAY)).toEqual({ weekday: 'lun', day: 9, month: 'nov' });
  });
});

describe('gymSlotsForDate', () => {
  it('only builds slots on the weekday of each block', () => {
    const blocks = [block(1, '08:00:00', '10:00:00')];
    expect(gymSlotsForDate(blocks, 60, MONDAY, LONG_BEFORE)).toHaveLength(2);
    expect(gymSlotsForDate(blocks, 60, '2026-11-10', LONG_BEFORE)).toHaveLength(0);
  });

  it('builds slot instants from gym wall-clock time', () => {
    const slots = gymSlotsForDate([block(1, '08:00:00', '10:00:00')], 60, MONDAY, LONG_BEFORE);
    expect(starts(slots)).toEqual(['2026-11-09T14:00:00.000Z', '2026-11-09T15:00:00.000Z']);
    expect(slots[0].end.toISOString()).toBe('2026-11-09T15:00:00.000Z');
  });

  it('chains the service duration inside each block', () => {
    const blocks = [block(1, '08:00:00', '10:00:00')];
    expect(gymSlotsForDate(blocks, 60, MONDAY, LONG_BEFORE)).toHaveLength(2);
    expect(gymSlotsForDate(blocks, 90, MONDAY, LONG_BEFORE)).toHaveLength(1);
  });

  it('drops a trailing slot that would end after the block', () => {
    const slots = gymSlotsForDate([block(1, '08:00:00', '09:30:00')], 60, MONDAY, LONG_BEFORE);
    expect(starts(slots)).toEqual(['2026-11-09T14:00:00.000Z']);
  });

  it('skips slots that already started', () => {
    const now = new Date('2026-11-09T14:30:00Z'); // 08:30 en el gimnasio
    const slots = gymSlotsForDate([block(1, '08:00:00', '10:00:00')], 60, MONDAY, now);
    expect(starts(slots)).toEqual(['2026-11-09T15:00:00.000Z']);
  });

  it('merges and sorts multiple blocks of the same day', () => {
    const slots = gymSlotsForDate(
      [block(1, '14:00:00', '15:00:00'), block(1, '08:00:00', '09:00:00')],
      60,
      MONDAY,
      LONG_BEFORE
    );
    expect(starts(slots)).toEqual(['2026-11-09T14:00:00.000Z', '2026-11-09T20:00:00.000Z']);
  });

  it('removes slots that overlap a busy range, but keeps adjacent ones', () => {
    const blocks = [block(1, '08:00:00', '10:00:00')];
    const overlapping = [
      { start: new Date('2026-11-09T15:00:00Z'), end: new Date('2026-11-09T15:45:00Z') },
    ];
    expect(starts(gymSlotsForDate(blocks, 60, MONDAY, LONG_BEFORE, overlapping))).toEqual([
      '2026-11-09T14:00:00.000Z',
    ]);
    const adjacent = [
      { start: new Date('2026-11-09T14:00:00Z'), end: new Date('2026-11-09T15:00:00Z') },
    ];
    expect(starts(gymSlotsForDate(blocks, 60, MONDAY, LONG_BEFORE, adjacent))).toEqual([
      '2026-11-09T15:00:00.000Z',
    ]);
  });

  it('ignores invalid durations and malformed times', () => {
    const blocks = [block(1, '08:00:00', '10:00:00'), block(1, 'bad', '11:00:00')];
    expect(gymSlotsForDate(blocks, 0, MONDAY, LONG_BEFORE)).toHaveLength(0);
    expect(gymSlotsForDate(blocks, Number.NaN, MONDAY, LONG_BEFORE)).toHaveLength(0);
    expect(gymSlotsForDate(blocks, 60, MONDAY, LONG_BEFORE)).toHaveLength(2);
  });
});

describe('appointmentBadge', () => {
  const now = new Date('2026-11-09T12:00:00Z');

  it('labels each state', () => {
    expect(appointmentBadge('cancelled', '2026-11-10T12:00:00Z', now)).toEqual({
      label: 'Cancelada',
      tone: 'cancelled',
    });
    expect(appointmentBadge('attended', '2026-11-08T12:00:00Z', now).label).toBe('Atendida');
    expect(appointmentBadge('no_show', '2026-11-08T12:00:00Z', now).label).toBe('No asististe');
    expect(appointmentBadge('confirmed', '2026-11-08T12:00:00Z', now).label).toBe('Finalizada');
    expect(appointmentBadge('confirmed', '2026-11-10T12:00:00Z', now)).toEqual({
      label: 'Confirmada',
      tone: 'upcoming',
    });
  });
});

describe('canCancelAppointment', () => {
  const now = new Date('2026-11-09T12:00:00Z');

  it('allows only confirmed appointments that have not started', () => {
    expect(canCancelAppointment('confirmed', '2026-11-09T13:00:00Z', now)).toBe(true);
    expect(canCancelAppointment('confirmed', '2026-11-09T11:00:00Z', now)).toBe(false);
    expect(canCancelAppointment('cancelled', '2026-11-09T13:00:00Z', now)).toBe(false);
    expect(canCancelAppointment('attended', '2026-11-09T13:00:00Z', now)).toBe(false);
  });
});

describe('bookingResult', () => {
  it('reports success with the new appointment id', () => {
    expect(
      bookingResult({ status: 'confirmed', message: 'Cita reservada', appointment_id: 'a-1' })
    ).toEqual({ success: true, appointmentId: 'a-1' });
  });

  it('passes the business message through for conflicts', () => {
    expect(
      bookingResult({ status: 'slot_taken', message: 'Ese horario ya está ocupado.' })
    ).toEqual({ success: false, error: 'Ese horario ya está ocupado.' });
    expect(
      bookingResult({ status: 'member_conflict', message: 'Ya tienes una cita en ese horario.' })
    ).toEqual({ success: false, error: 'Ya tienes una cita en ese horario.' });
  });

  it('falls back when the response carries no usable message', () => {
    expect(bookingResult(null).success).toBe(false);
    expect(bookingResult({ status: 'error' }).error).toContain('No se pudo reservar');
    expect(bookingResult({}).error).toContain('No se pudo reservar');
  });
});

describe('cancelResult', () => {
  it('treats cancelled and already_cancelled as success', () => {
    expect(cancelResult({ status: 'cancelled', message: 'Cita cancelada' })).toEqual({
      success: true,
    });
    expect(cancelResult({ status: 'already_cancelled' }).success).toBe(true);
  });

  it('passes business errors through and falls back otherwise', () => {
    expect(
      cancelResult({ status: 'error', message: 'Ya no es posible cancelar esta cita.' })
    ).toEqual({
      success: false,
      error: 'Ya no es posible cancelar esta cita.',
    });
    expect(cancelResult(null).error).toContain('No se pudo cancelar');
  });
});
