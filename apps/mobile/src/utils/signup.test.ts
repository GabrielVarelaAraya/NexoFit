import { describe, expect, it } from 'vitest';
import { USAGE_OPTIONS, intentForUsage, signupPasswordChecks } from './signup';

describe('intentForUsage', () => {
  it('only the gym owner gets the gym-owner flow', () => {
    expect(intentForUsage('gym_owner')).toBe('gym_owner');
    expect(intentForUsage('member')).toBe('client');
    expect(intentForUsage('professional')).toBe('client');
  });

  it('offers the three usages, member first', () => {
    expect(USAGE_OPTIONS.map((option) => option.id)).toEqual([
      'member',
      'professional',
      'gym_owner',
    ]);
  });
});

describe('signupPasswordChecks', () => {
  it('fails under 8 characters', () => {
    expect(signupPasswordChecks('1234567')).toEqual([
      { label: 'Al menos 8 caracteres', ok: false },
    ]);
  });

  it('passes with 8 or more characters', () => {
    expect(signupPasswordChecks('12345678').every((check) => check.ok)).toBe(true);
  });
});
