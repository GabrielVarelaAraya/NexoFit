import type { RoleType } from '@nexofit/core';

export function getRoleAccess(role?: RoleType) {
  if (role === 'professional') return 'professional';
  if (role === 'admin' || role === 'coach') return 'staff';
  return 'member';
}

export function getRoleTab(role?: RoleType) {
  const access = getRoleAccess(role);
  return access === 'professional'
    ? 'ProfessionalTabs'
    : access === 'staff'
      ? 'AdminTabs'
      : 'ClientTabs';
}
