import { describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
import { registerWithEmail } from './registerWithEmail';
import type { RegistrationClient } from './registerWithEmail';

const user: User = {
  id: 'new-user',
  aud: 'authenticated',
  app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'Jose' },
  created_at: '2026-10-09T00:00:00Z',
  identities: [
    {
      id: 'email-identity',
      identity_id: 'email-identity',
      user_id: 'new-user',
      provider: 'email',
    },
  ],
};

const input = {
  email: 'jose@nexofit.test',
  password: 'test-password',
  fullName: 'Jose',
  emailRedirectTo: 'nexofit://auth/verify',
};

function createClientMock() {
  const rpc = vi.fn<RegistrationClient['rpc']>().mockResolvedValue({ data: false, error: null });
  const signUp = vi
    .fn<RegistrationClient['auth']['signUp']>()
    .mockResolvedValue({ data: { user, session: null }, error: null });
  return { rpc, auth: { signUp } };
}

describe('email registration', () => {
  it('rejects an existing address before registering or sending confirmation email', async () => {
    const client = createClientMock();
    client.rpc.mockResolvedValue({ data: true, error: null });

    const result = await registerWithEmail(client, input);

    expect(result).toEqual({
      error: 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.',
      code: 'email_exists',
      needsConfirmation: false,
    });
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('checks and registers the same trimmed, lowercase address', async () => {
    const client = createClientMock();

    const result = await registerWithEmail(client, {
      ...input,
      email: '  JOSE@NEXOFIT.TEST  ',
      fullName: ' Jose ',
    });

    expect(client.rpc).toHaveBeenCalledWith('email_exists', { p_email: input.email });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: { data: { full_name: 'Jose' }, emailRedirectTo: input.emailRedirectTo },
    });
    expect(result).toEqual({ needsConfirmation: true });
  });

  it('stops registration when the email check fails', async () => {
    const client = createClientMock();
    client.rpc.mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } });

    const result = await registerWithEmail(client, input);

    expect(result.error).toBe('No pudimos comprobar el correo. Inténtalo de nuevo.');
    expect(result.needsConfirmation).toBe(false);
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('does not treat a missing check result as an available email', async () => {
    const client = createClientMock();
    client.rpc.mockResolvedValue({ data: null, error: null });

    const result = await registerWithEmail(client, input);

    expect(result.error).toBeDefined();
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it.each(['user_already_exists', 'email_exists'])(
    'handles a duplicate returned by Auth after the precheck: %s',
    async (code) => {
      const client = createClientMock();
      client.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthApiError('User already registered', 422, code),
      });

      const result = await registerWithEmail(client, input);

      expect(result.code).toBe('email_exists');
      expect(result.error).toContain('Este correo ya está registrado.');
      expect(result.needsConfirmation).toBe(false);
    }
  );

  it('rejects the obfuscated success response for an already registered user', async () => {
    const client = createClientMock();
    client.auth.signUp.mockResolvedValue({
      data: { user: { ...user, identities: [] }, session: null },
      error: null,
    });

    const result = await registerWithEmail(client, input);

    expect(result.code).toBe('email_exists');
    expect(result.needsConfirmation).toBe(false);
  });

  it('preserves immediate login when email confirmation is disabled', async () => {
    const client = createClientMock();
    const session: Session = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      user,
    };
    client.auth.signUp.mockResolvedValue({ data: { user, session }, error: null });

    expect(await registerWithEmail(client, input)).toEqual({ needsConfirmation: false });
  });

  it('preserves other signup errors without calling them duplicate emails', async () => {
    const client = createClientMock();
    client.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Unable to send confirmation email', 500, 'unexpected_failure'),
    });

    expect(await registerWithEmail(client, input)).toEqual({
      error: 'Unable to send confirmation email',
      code: 'unexpected_failure',
      needsConfirmation: false,
    });
  });

  it('does not open confirmation when signup returned no user', async () => {
    const client = createClientMock();
    client.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const result = await registerWithEmail(client, input);

    expect(result.error).toBeDefined();
    expect(result.needsConfirmation).toBe(false);
  });
});
