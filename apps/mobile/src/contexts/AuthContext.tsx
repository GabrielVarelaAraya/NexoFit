import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@nexofit/core';
import type { RoleType } from '@nexofit/core';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  membership: { organization_id: string; role: RoleType; organization_name?: string } | null;
  refreshMembership: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<{
    organization_id: string;
    role: RoleType;
    organization_name?: string;
  } | null>(null);

  // Handle deep links for email verification and password reset
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      // Parse the deep link: nexofit://auth/verify?token=xxx&type=signup
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname === '/auth/verify' || parsedUrl.pathname === '/auth/reset-password') {
        const token = parsedUrl.searchParams.get('token');
        const type = parsedUrl.searchParams.get('type') as 'signup' | 'recovery' | null;
        const email = parsedUrl.searchParams.get('email');

        if (token && type && email) {
          const { error } = await supabase.auth.verifyOtp({
            email,
            token,
            type,
          });
          if (!error) {
            // Navigation will happen automatically via onAuthStateChange
          }
        }
      }
    };

    // Listen for incoming links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle initial URL if app was launched from a link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Consulta reutilizable de la membresía. Ordena por created_at desc para
  // que el gimnasio recién creado/unido sea el activo por defecto.
  const fetchMembership = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('memberships')
        .select('organization_id, role, organizations ( name )')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    [supabase]
  );

  useEffect(() => {
    if (!session?.user) {
      setMembership(null);
      return;
    }

    let cancelled = false;

    // maybeSingle: un usuario sin membresía no debe dejar la membresía
    // del usuario anterior ni provocar errores PGRST116 en consola.
    fetchMembership(session.user.id).then((data) => {
      if (cancelled) return;
      if (data) {
        setMembership({
          organization_id: data.organization_id,
          role: data.role,
          organization_name: data.organizations?.name ?? undefined,
        });
      } else {
        setMembership(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user, fetchMembership]);

  // Se llama tras unirse o crear un gimnasio para que todas las pantallas
  // reflejen la nueva membresía sin reiniciar la app.
  const refreshMembership = useCallback(async () => {
    if (!session?.user) {
      setMembership(null);
      return;
    }
    const data = await fetchMembership(session.user.id);
    if (data) {
      setMembership({
        organization_id: data.organization_id,
        role: data.role,
        organization_name: data.organizations?.name ?? undefined,
      });
    } else {
      setMembership(null);
    }
  }, [session?.user, fetchMembership]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    // Use magic link instead of OTP - single email with deep link
    const redirectTo = `${DEEPLINK_SCHEME}://auth/verify`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectTo,
      },
    });
    return { error: error?.message };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    // Use magic link for password reset too
    const redirectTo = `${DEEPLINK_SCHEME}://auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error: error?.message };
  };

  const verifyOtp = async (email: string, token: string, type: 'signup' | 'recovery') => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    return { error: error?.message };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        membership,
        refreshMembership,
        signIn,
        signUp,
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
