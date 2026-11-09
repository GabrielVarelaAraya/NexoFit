import { describe, expect, it } from 'vitest';
import { getRoleAccess, getRoleTab } from './roleAccess';
import {
  appointmentActionError,
  availabilityError,
  parseClockTime,
  professionalSetup,
  serviceError,
} from './professional';

describe('professionalSetup', () => {
  const ready = {
    professional: { specialization: 'Nutrición' },
    services: [{}],
    availability: [{}],
  };

  it('is complete with specialty, a service and availability', () => {
    expect(professionalSetup(ready).every((item) => item.done)).toBe(true);
  });

  it('flags a missing or placeholder specialty', () => {
    const blank = professionalSetup({ ...ready, professional: { specialization: '  ' } });
    const placeholder = professionalSetup({
      ...ready,
      professional: { specialization: 'Por definir' },
    });
    expect(blank[0]).toMatchObject({ step: 'profile', done: false, tab: 'PerfilProfesional' });
    expect(placeholder[0].done).toBe(false);
  });

  it('flags missing services and availability', () => {
    const items = professionalSetup({ ...ready, services: [], availability: [] });
    expect(items.filter((item) => !item.done).map((item) => item.tab)).toEqual([
      'Servicios',
      'Disponibilidad',
    ]);
  });
});

describe('professional access and scheduling', () => {
  it.each([
    ['admin', 'staff', 'AdminTabs'],
    ['coach', 'staff', 'AdminTabs'],
    ['professional', 'professional', 'ProfessionalTabs'],
    ['member', 'member', 'ClientTabs'],
    [undefined, 'member', 'ClientTabs'],
  ] as const)('routes role %s to its workspace', (role, access, tab) => {
    expect(getRoleAccess(role)).toBe(access);
    expect(getRoleTab(role)).toBe(tab);
  });
  it.each(['24:00', '08:60', '8:00', '08:0', 'letters'])('rejects invalid time %s', (value) => {
    expect(parseClockTime(value)).toBeNull();
  });
  it('rejects inverted hours and invalid weekdays', () => {
    expect(availabilityError(7, '08:00', '09:00', [])).toBeTruthy();
    expect(availabilityError(1, '09:00', '08:00', [])).toBeTruthy();
    expect(availabilityError(1, '08:00', '08:00', [])).toBeTruthy();
  });
  const blocks = [{ day_of_week: 1, start_time: '08:00:00', end_time: '10:00:00' }];
  it.each([
    ['07:00', '09:00'],
    ['09:00', '11:00'],
    ['08:00', '10:00'],
    ['07:00', '11:00'],
  ])('rejects an overlapping block %s-%s', (start, end) => {
    expect(availabilityError(1, start, end, blocks)).toContain('superpone');
  });
  it('allows adjacent hours and identical hours on a different day', () => {
    expect(availabilityError(1, '10:00', '11:00', blocks)).toBeUndefined();
    expect(availabilityError(1, '07:00', '08:00', blocks)).toBeUndefined();
    expect(availabilityError(2, '08:00', '10:00', blocks)).toBeUndefined();
  });
  const appointment = {
    status: 'confirmed' as const,
    starts_at: '2026-10-09T14:00:00Z',
    ends_at: '2026-10-09T15:00:00Z',
  };
  it('does not mark a future appointment attended or absent', () => {
    const now = Date.parse('2026-10-09T13:00:00Z');
    expect(appointmentActionError(appointment, 'attended', now)).toBeTruthy();
    expect(appointmentActionError(appointment, 'no_show', now)).toBeTruthy();
    expect(appointmentActionError(appointment, 'cancelled', now)).toBeUndefined();
  });
  it('allows attendance at the start and absence only after the end', () => {
    expect(
      appointmentActionError(appointment, 'attended', Date.parse(appointment.starts_at))
    ).toBeUndefined();
    expect(
      appointmentActionError(appointment, 'no_show', Date.parse(appointment.starts_at))
    ).toBeTruthy();
    expect(
      appointmentActionError(appointment, 'no_show', Date.parse(appointment.ends_at))
    ).toBeUndefined();
  });
  it('prevents overwriting a cancelled appointment', () => {
    expect(
      appointmentActionError({ ...appointment, status: 'cancelled' }, 'attended')
    ).toBeTruthy();
  });
  it('requires a meaningful service name and a whole duration', () => {
    expect(serviceError('', 45)).toContain('nombre');
    expect(serviceError('  a  ', 45)).toContain('nombre');
    expect(serviceError('Nutrición', 0)).toContain('duración');
    expect(serviceError('Nutrición', 30.5)).toContain('duración');
    expect(serviceError('Nutrición', 1441)).toContain('duración');
    expect(serviceError(' Nutrición ', 45)).toBeUndefined();
  });
});
