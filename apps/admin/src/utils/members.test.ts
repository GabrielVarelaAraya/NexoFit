import { describe, expect, it } from 'vitest';
import { countByRole, filterMembers, parseRoleFilter } from './members';

const members = [
  { fullName: 'Gabriel Varela', phone: '8888-1234', role: 'member' as const },
  { fullName: 'Sofía Lizano', phone: null, role: 'coach' as const },
  { fullName: 'Gym', phone: null, role: 'admin' as const },
];

describe('filterMembers', () => {
  it('matches names without accents or case', () => {
    expect(filterMembers(members, 'sofia', 'all').map((m) => m.fullName)).toEqual(['Sofía Lizano']);
  });

  it('matches phone digits regardless of formatting', () => {
    expect(filterMembers(members, '88881234', 'all')).toHaveLength(1);
  });

  it('filters by role and combines with the query', () => {
    expect(filterMembers(members, '', 'admin').map((m) => m.fullName)).toEqual(['Gym']);
    expect(filterMembers(members, 'gabriel', 'coach')).toHaveLength(0);
  });
});

describe('parseRoleFilter', () => {
  it('accepts known roles and falls back to all', () => {
    expect(parseRoleFilter('coach')).toBe('coach');
    expect(parseRoleFilter('hacker')).toBe('all');
    expect(parseRoleFilter(undefined)).toBe('all');
  });
});

describe('countByRole', () => {
  it('counts each role and the total', () => {
    expect(countByRole(members)).toEqual({
      all: 3,
      member: 1,
      coach: 1,
      professional: 0,
      admin: 1,
    });
  });
});
