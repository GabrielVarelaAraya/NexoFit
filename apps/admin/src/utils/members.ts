import type { RoleType } from '@nexofit/core';

export type RoleFilter = 'all' | RoleType;

export const ROLE_FILTERS: readonly { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'member', label: 'Miembros' },
  { value: 'coach', label: 'Entrenadores' },
  { value: 'professional', label: 'Profesionales' },
  { value: 'admin', label: 'Administradores' },
];

export function parseRoleFilter(value: string | undefined): RoleFilter {
  return ROLE_FILTERS.some((option) => option.value === value) ? (value as RoleFilter) : 'all';
}

interface MemberLike {
  fullName: string;
  phone: string | null;
  role: RoleType;
}

/** Normaliza para buscar sin tildes ni mayúsculas («Gabriél» ≈ «gabriel»). */
function normalize(text: string): string {
  // Rango U+0300–U+036F: marcas diacríticas que NFD separa de la letra.
  const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

/** Filtra por rol y por texto en nombre o teléfono. */
export function filterMembers<T extends MemberLike>(
  members: readonly T[],
  query: string,
  role: RoleFilter
): T[] {
  const q = normalize(query.trim());
  const digits = query.replace(/\D/g, '');
  return members.filter((member) => {
    if (role !== 'all' && member.role !== role) return false;
    if (!q) return true;
    if (normalize(member.fullName).includes(q)) return true;
    return digits.length > 0 && (member.phone ?? '').replace(/\D/g, '').includes(digits);
  });
}

/** Conteo por rol para mostrar en los chips («Miembros (12)»). */
export function countByRole(members: readonly MemberLike[]): Record<RoleFilter, number> {
  const counts: Record<RoleFilter, number> = {
    all: members.length,
    member: 0,
    coach: 0,
    professional: 0,
    admin: 0,
  };
  for (const member of members) counts[member.role] += 1;
  return counts;
}
