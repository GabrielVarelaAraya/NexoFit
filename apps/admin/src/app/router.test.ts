import { describe, expect, it } from 'vitest';
import { buildPath, documentTitle, parseLocation } from './router';

describe('parseLocation', () => {
  it('maps known paths to views', () => {
    expect(parseLocation('/').view).toBe('dashboard');
    expect(parseLocation('/agenda').view).toBe('agenda');
    expect(parseLocation('/miembros/').view).toBe('members');
    expect(parseLocation('/pagos').view).toBe('payments');
  });

  it('falls back to the dashboard for unknown paths', () => {
    expect(parseLocation('/no-existe').view).toBe('dashboard');
  });

  it('reads query params', () => {
    expect(parseLocation('/miembros', '?m=abc&rol=coach')).toEqual({
      view: 'members',
      params: { m: 'abc', rol: 'coach' },
    });
  });
});

describe('buildPath', () => {
  it('builds paths and drops empty params', () => {
    expect(buildPath('dashboard')).toBe('/');
    expect(buildPath('members', { m: 'abc', q: '' })).toBe('/miembros?m=abc');
  });

  it('round-trips with parseLocation', () => {
    const path = buildPath('payments', { metodo: 'cash' });
    const [pathname, search] = path.split('?');
    expect(parseLocation(pathname, `?${search}`)).toEqual({
      view: 'payments',
      params: { metodo: 'cash' },
    });
  });
});

describe('documentTitle', () => {
  it('names the section', () => {
    expect(documentTitle('members')).toBe('Miembros · NexoFit Admin');
  });
});
