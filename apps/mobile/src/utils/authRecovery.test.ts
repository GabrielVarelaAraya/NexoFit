import { describe, expect, it, vi } from 'vitest';
import { AuthApiError, createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
import {
  authenticateAuthLink,
  authSessionReducer,
  getAuthDestination,
  initialAuthSessionState,
  parseAuthLink,
  requestPasswordRecovery,
  updateRecoveryPassword,
  verifyEmailCode,
} from './authRecovery';
import type { AuthSessionState, RecoveryAuthClient } from './authRecovery';

const user: User = {
  id: 'recovery-user',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-10-09T00:00:00Z',
};
const session: Session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user,
};
function createAuthMock() {
  return {
    verifyOtp: vi
      .fn<RecoveryAuthClient['verifyOtp']>()
      .mockResolvedValue({ data: { session, user }, error: null }),
    resetPasswordForEmail: vi
      .fn<RecoveryAuthClient['resetPasswordForEmail']>()
      .mockResolvedValue({ data: {}, error: null }),
    updateUser: vi
      .fn<RecoveryAuthClient['updateUser']>()
      .mockResolvedValue({ data: { user }, error: null }),
    setSession: vi
      .fn<RecoveryAuthClient['setSession']>()
      .mockResolvedValue({ data: { session, user }, error: null }),
    exchangeCodeForSession: vi
      .fn<RecoveryAuthClient['exchangeCodeForSession']>()
      .mockResolvedValue({
        data: { session, user },
        error: null,
      }),
  };
}

describe('password recovery', () => {
  it('normalizes the recovery address and requests the configured redirect', async () => {
    const auth = createAuthMock();
    await expect(requestPasswordRecovery(auth, ' JOSE@NEXOFIT.TEST ')).resolves.toEqual({
      error: undefined,
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('jose@nexofit.test', {
      redirectTo: 'nexofit://auth/reset-password',
    });
  });
  it('explains the email rate limit', async () => {
    const auth = createAuthMock();
    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: new AuthApiError('rate limit', 429, 'over_email_send_rate_limit'),
    });
    expect((await requestPasswordRecovery(auth, 'jose@nexofit.test')).error).toContain('límite');
  });
  it('verifies recovery codes using recovery rather than signup', async () => {
    const auth = createAuthMock();
    await expect(
      verifyEmailCode(auth, ' JOSE@NEXOFIT.TEST ', ' 123456 ', 'recovery')
    ).resolves.toEqual({ error: undefined });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'jose@nexofit.test',
      token: '123456',
      type: 'recovery',
    });
  });
  it('preserves email confirmation', async () => {
    const auth = createAuthMock();
    await verifyEmailCode(auth, 'jose@nexofit.test', '12345678', 'signup');
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'jose@nexofit.test',
      token: '12345678',
      type: 'email',
    });
  });
  it.each(['123', 'abc123', '12345678901'])(
    'does not submit incomplete or invalid code %s',
    async (token) => {
      const auth = createAuthMock();
      expect((await verifyEmailCode(auth, 'jose@nexofit.test', token, 'recovery')).error).toContain(
        'código completo'
      );
      expect(auth.verifyOtp).not.toHaveBeenCalled();
    }
  );
  it('explains expired codes without entering recovery', async () => {
    const auth = createAuthMock();
    auth.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('expired', 403, 'otp_expired'),
    });
    expect(
      (await verifyEmailCode(auth, 'jose@nexofit.test', '123456', 'recovery')).error
    ).toContain('caducado');
    expect(getAuthDestination(initialAuthSessionState, false, false)).toBe('Auth');
  });
  it('rejects verification without a session', async () => {
    const auth = createAuthMock();
    auth.verifyOtp.mockResolvedValue({ data: { session: null, user }, error: null });
    expect(
      (await verifyEmailCode(auth, 'jose@nexofit.test', '123456', 'recovery')).error
    ).toContain('sesión');
  });
  it.each([
    { session: null, passwordRecovery: false },
    { session, passwordRecovery: false },
  ])('does not update a password without verified recovery', async (state) => {
    const auth = createAuthMock();
    expect((await updateRecoveryPassword(auth, state, 'NuevaClave123')).error).toContain(
      'Verifica primero'
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it.each(['ShortA', 'sinmayuscula123'])('does not send a weak password %s', async (password) => {
    const auth = createAuthMock();
    expect(
      (await updateRecoveryPassword(auth, { session, passwordRecovery: true }, password)).error
    ).toContain('8 caracteres');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('updates the password only after recovery has been verified', async () => {
    const auth = createAuthMock();
    await expect(
      updateRecoveryPassword(auth, { session, passwordRecovery: true }, 'NuevaClave123')
    ).resolves.toEqual({ error: undefined });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'NuevaClave123' });
  });
  it('explains trying to reuse the previous password', async () => {
    const auth = createAuthMock();
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('same', 422, 'same_password'),
    });
    expect(
      (await updateRecoveryPassword(auth, { session, passwordRecovery: true }, 'NuevaClave123'))
        .error
    ).toContain('diferente');
  });
  it('keeps the recovery screen through session refresh and user updates until finished', () => {
    let state = authSessionReducer(initialAuthSessionState, {
      type: 'authChanged',
      event: 'PASSWORD_RECOVERY',
      session,
    });
    expect(getAuthDestination(state, false, true)).toBe('NewPassword');
    for (const event of ['USER_UPDATED', 'TOKEN_REFRESHED', 'SIGNED_IN'] as const) {
      state = authSessionReducer(state, { type: 'authChanged', event, session });
      expect(getAuthDestination(state, false, false)).toBe('NewPassword');
    }
    state = authSessionReducer(state, { type: 'recoveryFinished' });
    expect(getAuthDestination(state, false, true)).toBe('Loading');
    expect(getAuthDestination(state, false, false)).toBe('Main');
  });
  it('clears recovery on signout instead of exposing the main app', () => {
    const state = authSessionReducer(
      { session, passwordRecovery: true },
      {
        type: 'authChanged',
        event: 'SIGNED_OUT',
        session: null,
      }
    );
    expect(state.passwordRecovery).toBe(false);
    expect(getAuthDestination(state, false, false)).toBe('Auth');
  });
  it('waits while an incoming recovery link is being authenticated', () => {
    expect(getAuthDestination({ session, passwordRecovery: false }, true, false)).toBe('Loading');
  });
  it('handles the actual Supabase recovery event before allowing password update', async () => {
    let state: AuthSessionState = initialAuthSessionState;
    const fetchMock = vi.fn(
      async (url: string, _body: string) =>
        new Response(
          JSON.stringify(
            url.endsWith('/user')
              ? user
              : {
                  ...session,
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                }
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    const client = createClient('https://nexofit.test', 'public-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetchMock(String(input), String(init?.body ?? '')) },
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      state = authSessionReducer(state, { type: 'authChanged', event, session: nextSession });
    });
    try {
      await expect(
        verifyEmailCode(client.auth, 'jose@nexofit.test', '123456', 'recovery')
      ).resolves.toEqual({ error: undefined });
      expect(getAuthDestination(state, false, true)).toBe('NewPassword');
      const request = JSON.parse(fetchMock.mock.calls[0][1]) as { type: string };
      expect(request.type).toBe('recovery');
      await expect(updateRecoveryPassword(client.auth, state, 'NuevaClave123')).resolves.toEqual({
        error: undefined,
      });
      expect(getAuthDestination(state, false, false)).toBe('NewPassword');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      subscription.unsubscribe();
    }
  });
});

describe('auth links', () => {
  it.each([
    'garbage',
    'https://nexofit.test/auth/reset-password',
    'nexofit://other/reset-password',
    'exp://127.0.0.1:8081',
  ])('ignores unrelated or invalid URLs %s', (url) => {
    expect(parseAuthLink(url)).toBeNull();
  });
  it.each(['nexofit://auth/reset-password', 'nexofit:///auth/reset-password'])(
    'reads the session fragment at %s',
    (url) => {
      expect(
        parseAuthLink(url + '#access_token=access&refresh_token=refresh&type=recovery')
      ).toEqual({
        kind: 'session',
        type: 'recovery',
        accessToken: 'access',
        refreshToken: 'refresh',
      });
    }
  );
  it('reads a PKCE code', () => {
    expect(parseAuthLink('nexofit://auth/reset-password?code=auth-code')).toEqual({
      kind: 'code',
      type: 'recovery',
      code: 'auth-code',
    });
  });
  it('preserves confirmation links containing email and code', () => {
    expect(
      parseAuthLink('nexofit://auth/verify?type=signup&email=jose%40nexofit.test&token=123456')
    ).toEqual({
      kind: 'otp',
      type: 'signup',
      email: 'jose@nexofit.test',
      token: '123456',
    });
  });
  it('reads a recovery token hash', () => {
    expect(parseAuthLink('nexofit://auth/reset-password?token_hash=hash&type=recovery')).toEqual({
      kind: 'tokenHash',
      type: 'recovery',
      tokenHash: 'hash',
    });
  });
  it('reports expired links', () => {
    expect(
      parseAuthLink('nexofit://auth/reset-password#error=access_denied&error_code=otp_expired')
    ).toEqual({
      kind: 'error',
      error: expect.stringContaining('caducado'),
    });
  });
  it('rejects partial sessions and unsupported verification types', () => {
    expect(parseAuthLink('nexofit://auth/reset-password#access_token=access')?.kind).toBe('error');
    expect(parseAuthLink('nexofit://auth/reset-password?type=invite&token_hash=hash')?.kind).toBe(
      'error'
    );
  });
  it('authenticates implicit sessions', async () => {
    const auth = createAuthMock();
    await authenticateAuthLink(auth, {
      kind: 'session',
      type: 'recovery',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });
  });
  it('exchanges PKCE codes', async () => {
    const auth = createAuthMock();
    await authenticateAuthLink(auth, { kind: 'code', type: 'recovery', code: 'auth-code' });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code');
  });
  it('verifies recovery token hashes', async () => {
    const auth = createAuthMock();
    await authenticateAuthLink(auth, { kind: 'tokenHash', type: 'recovery', tokenHash: 'hash' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash', type: 'recovery' });
  });
});
