import { describe, expect, it } from 'vitest';
import { daysLeftLabel, planStatus } from './membershipPlan';

const now = new Date('2026-11-08T12:00:00Z');

describe('planStatus', () => {
  it('rounds partial days up and warns within a week', () => {
    expect(planStatus('2026-11-09T08:00:00Z', now)).toEqual({
      daysLeft: 1,
      expired: false,
      expiringSoon: true,
    });
    expect(planStatus('2026-11-15T12:00:00Z', now).expiringSoon).toBe(true);
  });

  it('does not warn when there is plenty of time', () => {
    expect(planStatus('2026-12-08T12:00:00Z', now)).toMatchObject({
      daysLeft: 30,
      expiringSoon: false,
    });
  });

  it('marks past dates as expired', () => {
    expect(planStatus('2026-11-01T00:00:00Z', now)).toEqual({
      daysLeft: 0,
      expired: true,
      expiringSoon: false,
    });
  });
});

describe('daysLeftLabel', () => {
  it('uses natural wording', () => {
    expect(daysLeftLabel(0)).toBe('Vencido');
    expect(daysLeftLabel(1)).toBe('Vence mañana');
    expect(daysLeftLabel(5)).toBe('Vence en 5 días');
  });
});
