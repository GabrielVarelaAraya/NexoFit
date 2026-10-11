import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { createRecoverySessionStore } from './recoverySessionStore';
import { authSessionReducer, getAuthDestination, initialAuthSessionState } from './authRecovery';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}
const session: Session = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'recovery-user',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-09',
  },
};
describe('recovery persistence', () => {
  it('returns to the new password screen when restarted during recovery', async () => {
    const storage = memoryStorage();
    await createRecoverySessionStore(storage, 'project-a').setUserId(session.user.id);
    const state = authSessionReducer(initialAuthSessionState, {
      type: 'authChanged',
      event: 'INITIAL_SESSION',
      session,
      recoveryUserId: await createRecoverySessionStore(storage, 'project-a').getUserId(),
    });
    expect(getAuthDestination(state, false, true)).toBe('NewPassword');
  });
  it('does not reopen recovery after it has been completed or cancelled', async () => {
    const storage = memoryStorage();
    const store = createRecoverySessionStore(storage, 'project-a');
    const pending = store.setUserId(session.user.id);
    const clearing = store.clear();
    await Promise.all([pending, clearing]);
    const state = authSessionReducer(initialAuthSessionState, {
      type: 'authChanged',
      event: 'INITIAL_SESSION',
      session,
      recoveryUserId: await createRecoverySessionStore(storage, 'project-a').getUserId(),
    });
    expect(getAuthDestination(state, false, false)).toBe('Main');
  });
  it('does not apply another user or project recovery marker', async () => {
    const storage = memoryStorage();
    await createRecoverySessionStore(storage, 'project-a').setUserId('different-user');
    const state = authSessionReducer(initialAuthSessionState, {
      type: 'authChanged',
      event: 'INITIAL_SESSION',
      session,
      recoveryUserId: 'different-user',
    });
    expect(getAuthDestination(state, false, false)).toBe('Main');
    expect(await createRecoverySessionStore(storage, 'project-b').getUserId()).toBeNull();
  });
  it('clears recovery when a different account signs in', () => {
    const state = authSessionReducer(
      { session, passwordRecovery: true },
      {
        type: 'authChanged',
        event: 'SIGNED_IN',
        session: { ...session, user: { ...session.user, id: 'other-user' } },
      }
    );
    expect(getAuthDestination(state, false, false)).toBe('Main');
  });
});
