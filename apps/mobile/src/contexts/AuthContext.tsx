import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@nexofit/core';
import type { RoleType } from '@nexofit/core';
import { recoverySessionStore } from '../utils/authStorage';
import { registerWithEmail } from '../utils/registerWithEmail';
import type { RegistrationResult } from '../utils/registerWithEmail';
import {
  authenticateAuthLink,
  authErrorMessage,
  authSessionReducer,
  initialAuthSessionState,
  parseAuthLink,
  requestPasswordRecovery,
  updateRecoveryPassword,
  verifyEmailCode,
} from '../utils/authRecovery';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecovery: boolean;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  finishPasswordRecovery: () => Promise<void>;
  sessionError: string | null;
  retrySession: () => void;
  membershipError: string | null;
  cancelPasswordRecovery: () => Promise<{ error?: string }>;
  /** true mientras se resuelve la membresía (rol) del usuario con sesión. */
  membershipLoading: boolean;
  membership: {
    id: string;
    organization_id: string;
    role: RoleType;
    organization_name?: string;
  } | null;
  refreshMembership: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string; code?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<RegistrationResult>;
  resendVerificationEmail: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  verifyOtp: (
    email: string,
    token: string,
    type: 'signup' | 'recovery'
  ) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Deep link scheme configured in app.config.js
const DEEPLINK_SCHEME = 'nexofit';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [authState, dispatchAuth] = useReducer(authSessionReducer, initialAuthSessionState);
  const { session, passwordRecovery } = authState;
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const membershipRequest = useRef(0);
  const currentUserId = useRef(session?.user.id);
  currentUserId.current = session?.user.id;
  const [authLinkLoading, setAuthLinkLoading] = useState(false);
  // Usuario al que pertenece `membership` (null = sin membresía resuelta).
  // Evita el parpadeo de pestañas al iniciar sesión: el rol se resuelve por
  // id de usuario, no por un booleano con carreras de timing.
  const [membershipUserId, setMembershipUserId] = useState<string | null>(null);
  const [membership, setMembership] = useState<{
    id: string;
    organization_id: string;
    role: RoleType;
    organization_name?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    let eventVersion = 0;
    setLoading(true);
    setSessionError(null);
    const applyEvent = async (event: AuthChangeEvent, nextSession: Session | null) => {
      const version = ++eventVersion;
      try {
        // No Supabase calls inside the auth callback: it runs under the SDK lock.
        if (event === 'PASSWORD_RECOVERY' && nextSession) {
          await recoverySessionStore.setUserId(nextSession.user.id);
        } else if (!nextSession) {
          await recoverySessionStore.clear();
        }
        const recoveryUserId = nextSession ? await recoverySessionStore.getUserId() : null;
        if (!active || version !== eventVersion) return;
        dispatchAuth({ type: 'authChanged', event, session: nextSession, recoveryUserId });
        setSessionError(null);
      } catch {
        if (active && version === eventVersion) {
          setSessionError('No pudimos recuperar la sesión guardada. Inténtalo de nuevo.');
        }
      } finally {
        if (active && version === eventVersion) setLoading(false);
      }
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      receivedAuthEvent = true;
      return applyEvent(event, nextSession);
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || receivedAuthEvent) return;
        if (error) {
          setSessionError('No pudimos recuperar tu sesión. Inténtalo de nuevo.');
          setLoading(false);
        } else {
          void applyEvent('INITIAL_SESSION', data.session);
        }
      })
      .catch(() => {
        if (active) {
          setSessionError('No pudimos recuperar tu sesión. Inténtalo de nuevo.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, authAttempt]);

  useEffect(() => {
    let active = true;
    let processing = false;
    const handledLinks = new Set<string>();
    const handleDeepLink = async (url: string) => {
      const link = parseAuthLink(url);
      if (!active || !link || processing || handledLinks.has(url)) return;
      if (link.kind === 'error') {
        Alert.alert('No se pudo verificar', link.error);
        return;
      }
      processing = true;
      setAuthLinkLoading(true);
      try {
        const { data, error } = await authenticateAuthLink(supabase.auth, link);
        if (!active) return;
        if (error || !data.session) {
          Alert.alert(
            'No se pudo verificar',
            authErrorMessage(error) ?? 'Solicita un correo nuevo e inténtalo de nuevo.'
          );
        } else {
          if (link.type === 'recovery') await recoverySessionStore.setUserId(data.session.user.id);
          if (!active) return;
          handledLinks.add(url);
          // setSession emite SIGNED_IN incluso para el fragmento de recuperación.
          dispatchAuth({
            type: 'authChanged',
            event: link.type === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN',
            session: data.session,
          });
        }
      } catch {
        if (active)
          Alert.alert('Sin conexión', 'No pudimos verificar el enlace. Inténtalo de nuevo.');
      } finally {
        processing = false;
        if (active) setAuthLinkLoading(false);
      }
    };
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });
    Linking.getInitialURL()
      .then((url) => {
        if (url) void handleDeepLink(url);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, [supabase]);

  const refreshMembership = useCallback(async () => {
    const uid = currentUserId.current;
    const request = ++membershipRequest.current;
    if (!uid) {
      setMembership(null);
      setMembershipUserId(null);
      setMembershipError(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, organization_id, role, organizations ( name )')
        .eq('profile_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (request !== membershipRequest.current || uid !== currentUserId.current) return;
      setMembership(
        data
          ? {
              id: data.id,
              organization_id: data.organization_id,
              role: data.role,
              organization_name: data.organizations?.name ?? undefined,
            }
          : null
      );
      setMembershipError(null);
      setMembershipUserId(uid);
    } catch {
      if (request !== membershipRequest.current || uid !== currentUserId.current) return;
      setMembershipError('No pudimos comprobar tu rol en el gimnasio. Inténtalo de nuevo.');
      setMembershipUserId(uid);
    }
  }, [supabase]);

  useEffect(() => {
    setMembership(null);
    setMembershipUserId(null);
    void refreshMembership();
    return () => {
      membershipRequest.current += 1;
    };
  }, [session?.user.id, refreshMembership]);

  useEffect(() => {
    const onStateChange = (state: string) => {
      if (Platform.OS !== 'web') {
        if (state === 'active') void supabase.auth.startAutoRefresh();
        else void supabase.auth.stopAutoRefresh();
      }
      if (state === 'active') void refreshMembership();
    };
    onStateChange(AppState.currentState);
    const subscription = AppState.addEventListener('change', onStateChange);
    return () => {
      subscription.remove();
      if (Platform.OS !== 'web') void supabase.auth.stopAutoRefresh();
    };
  }, [supabase, refreshMembership]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message, code: error?.code };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    return registerWithEmail(supabase, {
      email,
      password,
      fullName,
      emailRedirectTo: DEEPLINK_SCHEME + '://auth/verify',
    });
  };

  const resendVerificationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${DEEPLINK_SCHEME}://auth/verify` },
    });
    return {
      error:
        error?.code === 'over_email_send_rate_limit'
          ? 'Se alcanzó el límite de envío de correos. Inténtalo más tarde.'
          : error?.message,
    };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('No se pudo cerrar sesión', error.message);
  };

  const resetPassword = async (email: string) => requestPasswordRecovery(supabase.auth, email);

  const verifyOtp = useCallback(
    (email: string, token: string, type: 'signup' | 'recovery') =>
      verifyEmailCode(supabase.auth, email, token, type),
    [supabase]
  );

  const updatePassword = async (password: string) =>
    updateRecoveryPassword(supabase.auth, authState, password);

  const finishPasswordRecovery = async () => {
    try {
      await recoverySessionStore.clear();
      dispatchAuth({ type: 'recoveryFinished' });
    } catch {
      Alert.alert(
        'No se pudo continuar',
        'No pudimos guardar el final de la recuperación. Inténtalo de nuevo.'
      );
    }
  };

  const cancelPasswordRecovery = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return { error: authErrorMessage(error) };
  };

  // La membresía (y con ella el rol) debe estar resuelta ANTES de montar el
  // stack principal: initialRouteName (AdminTabs vs ClientTabs) solo aplica
  // en el primer render del navegador.
  const membershipLoading = session ? membershipUserId !== session.user.id : false;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading: loading || authLinkLoading,
        passwordRecovery,
        sessionError,
        retrySession: () => setAuthAttempt((attempt) => attempt + 1),
        membershipError,
        updatePassword,
        finishPasswordRecovery,
        cancelPasswordRecovery,
        membershipLoading,
        membership,
        refreshMembership,
        signIn,
        signUp,
        resendVerificationEmail,
        signOut,
        resetPassword,
        verifyOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
