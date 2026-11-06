import { beforeEach, describe, expect, it } from 'vitest';
import { getSignupIntent, setSignupIntent } from './signupIntent';

describe('signup intent', () => {
  beforeEach(() => {
    setSignupIntent('client');
  });

  it('defaults to the client flow', () => {
    expect(getSignupIntent()).toBe('client');
  });

  it('remembers the gym-owner flow', () => {
    setSignupIntent('gym_owner');
    expect(getSignupIntent()).toBe('gym_owner');
  });

  it('can switch back to the client flow', () => {
    setSignupIntent('gym_owner');
    setSignupIntent('client');
    expect(getSignupIntent()).toBe('client');
  });
});
