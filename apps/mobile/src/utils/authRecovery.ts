import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';

export type EmailVerificationType = 'signup' | 'recovery';
export type RecoveryAuthClient = Pick<
  SupabaseClient['auth'],
  'verifyOtp' | 'resetPasswordForEmail' | 'updateUser' | 'setSession' | 'exchangeCodeForSession'
>;

export interface AuthSessionState {
  session: Session | null;
  passwordRecovery: boolean;
}
export type AuthSessionAction =
  | {
      type: 'authChanged';
      event: AuthChangeEvent;
      session: Session | null;
      recoveryUserId?: string | null;
    }
  | { type: 'recoveryFinished' };

export const initialAuthSessionState: AuthSessionState = { session: null, passwordRecovery: false };

export function authSessionReducer(
  state: AuthSessionState,
  action: AuthSessionAction
): AuthSessionState {
  if (action.type === 'recoveryFinished') return { ...state, passwordRecovery: false };
  return {
    session: action.session,
    passwordRecovery:
      Boolean(action.session) &&
      (action.event === 'PASSWORD_RECOVERY' ||
        (Boolean(action.recoveryUserId) && action.recoveryUserId === action.session?.user.id) ||
        (state.passwordRecovery && state.session?.user.id === action.session?.user.id)),
  };
}

// La recuperación tiene prioridad sobre las pestañas y la consulta del rol.
export function getAuthDestination(
  state: AuthSessionState,
  loading: boolean,
  membershipLoading: boolean
): 'Loading' | 'NewPassword' | 'Main' | 'Auth' {
  if (loading) return 'Loading';
  if (state.session && state.passwordRecovery) return 'NewPassword';
  if (membershipLoading) return 'Loading';
  return state.session ? 'Main' : 'Auth';
}

export function authErrorMessage(
  error: { code?: string; message: string } | null
): string | undefined {
  if (!error) return undefined;
  switch (error.code) {
    case 'otp_expired':
      return 'El código o enlace ya no es válido o ha caducado. Solicita otro correo y usa el más reciente.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Se alcanzó el límite de solicitudes. Espera un momento e inténtalo de nuevo.';
    case 'same_password':
      return 'La nueva contraseña debe ser diferente de la anterior.';
    case 'weak_password':
      return 'La contraseña no cumple los requisitos de seguridad. Usa una contraseña más segura.';
    case 'session_not_found':
    case 'refresh_token_not_found':
      return 'Tu sesión de recuperación ha caducado. Solicita un código nuevo.';
    default:
      return error.message;
  }
}

export async function requestPasswordRecovery(auth: RecoveryAuthClient, email: string) {
  const { error } = await auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: 'nexofit://auth/reset-password',
  });
  return { error: authErrorMessage(error) };
}

export async function verifyEmailCode(
  auth: RecoveryAuthClient,
  email: string,
  token: string,
  type: EmailVerificationType
) {
  const code = token.trim();
  if (!/^\d{6,10}$/.test(code)) {
    return { error: 'Ingresa el código completo que aparece en tu correo.' };
  }
  const { data, error } = await auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code,
    type: type === 'signup' ? 'email' : 'recovery',
  });
  return {
    error:
      authErrorMessage(error) ??
      (!data.session
        ? 'No se pudo crear la sesión. Solicita otro código e inténtalo de nuevo.'
        : undefined),
  };
}

export async function updateRecoveryPassword(
  auth: RecoveryAuthClient,
  state: AuthSessionState,
  password: string
) {
  if (!state.session || !state.passwordRecovery) {
    return { error: 'Verifica primero el código de recuperación enviado a tu correo.' };
  }
  if (password.length < 8 || !/[A-Z]/.test(password)) {
    return { error: 'La contraseña debe tener al menos 8 caracteres y una mayúscula.' };
  }
  const { error } = await auth.updateUser({ password });
  return { error: authErrorMessage(error) };
}

export type AuthLink =
  | { kind: 'session'; type: EmailVerificationType; accessToken: string; refreshToken: string }
  | { kind: 'code'; type: EmailVerificationType; code: string }
  | { kind: 'otp'; type: EmailVerificationType; email: string; token: string }
  | { kind: 'tokenHash'; type: EmailVerificationType; tokenHash: string }
  | { kind: 'error'; error: string };

export function parseAuthLink(url: string): AuthLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'nexofit:') return null;
  const path = parsed.hostname === 'auth' ? '/auth' + parsed.pathname : parsed.pathname;
  if (path !== '/auth/verify' && path !== '/auth/reset-password') return null;
  if (parsed.hostname && parsed.hostname !== 'auth') return null;
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  const param = (name: string) => parsed.searchParams.get(name) ?? fragment.get(name);
  const errorCode = param('error_code');
  if (param('error') || errorCode) {
    return {
      kind: 'error',
      error: authErrorMessage({
        code: errorCode ?? undefined,
        message: 'No se pudo verificar el enlace. Solicita un correo nuevo e inténtalo de nuevo.',
      })!,
    };
  }
  const rawType = param('type');
  if (rawType && !['signup', 'email', 'recovery'].includes(rawType)) {
    return { kind: 'error', error: 'El enlace de verificación no es válido.' };
  }
  const type = rawType === 'recovery' || path === '/auth/reset-password' ? 'recovery' : 'signup';
  const accessToken = param('access_token');
  const refreshToken = param('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', type, accessToken, refreshToken };
  const code = param('code');
  if (code) return { kind: 'code', type, code };
  const tokenHash = param('token_hash');
  if (tokenHash) return { kind: 'tokenHash', type, tokenHash };
  const token = param('token');
  const email = param('email');
  if (token && email) return { kind: 'otp', type, token, email };
  return { kind: 'error', error: 'El enlace está incompleto. Solicita un correo nuevo.' };
}

export async function authenticateAuthLink(
  auth: RecoveryAuthClient,
  link: Exclude<AuthLink, { kind: 'error' }>
) {
  switch (link.kind) {
    case 'session':
      return auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    case 'code':
      return auth.exchangeCodeForSession(link.code);
    case 'tokenHash':
      return auth.verifyOtp({
        token_hash: link.tokenHash,
        type: link.type === 'signup' ? 'email' : 'recovery',
      });
    case 'otp':
      return auth.verifyOtp({
        email: link.email.trim().toLowerCase(),
        token: link.token,
        type: link.type === 'signup' ? 'email' : 'recovery',
      });
  }
}
