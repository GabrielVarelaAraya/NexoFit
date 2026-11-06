import { afterEach, describe, expect, it, vi } from 'vitest';
import { caughtError, friendlyError } from './errors';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('friendlyError', () => {
  it('hides technical Postgres messages behind the friendly fallback', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error(
      'duplicate key value violates unique constraint "bookings_profile_id_session_id_key"'
    );

    expect(friendlyError(error, 'No se pudo guardar la reserva.')).toBe(
      'No se pudo guardar la reserva.'
    );
  });

  it('maps network failures to a connectivity message', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(friendlyError(new Error('Network request failed'), 'No se pudo guardar.')).toBe(
      'Sin conexión. Revisa tu red e inténtalo de nuevo.'
    );
    expect(friendlyError(new Error('Failed to fetch'), 'No se pudo guardar.')).toBe(
      'Sin conexión. Revisa tu red e inténtalo de nuevo.'
    );
  });

  it('always logs the raw detail for debugging', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = 'permission denied for table bookings';

    friendlyError(new Error(raw), 'No se pudo guardar.');

    expect(warn).toHaveBeenCalledWith('[nexofit]', raw);
  });

  it('extracts the raw message from PostgrestError-like objects', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const postgrestError = {
      message: 'new row violates row-level security policy for table "payments"',
      code: '42501',
      details: null,
      hint: null,
    };

    expect(friendlyError(postgrestError, 'No se pudieron cargar los pagos.')).toBe(
      'No se pudieron cargar los pagos.'
    );
    expect(warn).toHaveBeenCalledWith('[nexofit]', postgrestError.message);
  });

  it('does not throw for unknown values', () => {
    expect(friendlyError(undefined, 'Algo salió mal.')).toBe('Algo salió mal.');
    expect(friendlyError(null, 'Algo salió mal.')).toBe('Algo salió mal.');
    expect(friendlyError({ code: '42P01' }, 'Algo salió mal.')).toBe('Algo salió mal.');
    expect(friendlyError('algo raro', 'Algo salió mal.')).toBe('Algo salió mal.');
  });
});

describe('caughtError', () => {
  it('passes our own business errors through untouched', () => {
    expect(caughtError(new Error('Ingresa tu especialidad.'), 'Inténtalo de nuevo.')).toBe(
      'Ingresa tu especialidad.'
    );
  });

  it('hides technical Postgres errors behind the fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const postgrestError = Object.assign(new Error('permission denied for table memberships'), {
      code: '42501',
    });

    expect(caughtError(postgrestError, 'No se pudo guardar.')).toBe('No se pudo guardar.');
    expect(warn).toHaveBeenCalledWith('[nexofit]', postgrestError.message);
  });

  it('maps network failures to the connectivity message', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(caughtError(new TypeError('Network request failed'), 'No se pudo guardar.')).toBe(
      'Sin conexión. Revisa tu red e inténtalo de nuevo.'
    );
  });

  it('falls back for non-Error values', () => {
    expect(caughtError('algo raro', 'No se pudo guardar.')).toBe('No se pudo guardar.');
    expect(caughtError(null, 'No se pudo guardar.')).toBe('No se pudo guardar.');
  });
});
