import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { getSupabase } from '@nexofit/core';
import { useAuth } from './AuthContext';

interface NotificationsContextValue {
  /** Notificaciones sin leer del usuario actual (badge de la tab Perfil). */
  unread: number;
  /** Vuelve a contar las no leídas (tras marcarlas o al volver a la app). */
  refreshUnread: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unread: 0,
  refreshUnread: async () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user?.id) {
      setUnread(0);
      return;
    }

    const supabase = getSupabase();
    // Count exacto sin traer filas: el badge solo necesita el número.
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', user.id)
      .eq('read', false);

    setUnread(count ?? 0);
  }, [user?.id]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  // Al volver a la app se sincroniza el badge sin abrir el perfil.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnread();
    });
    return () => subscription.remove();
  }, [refreshUnread]);

  // Cambios en vivo: el badge se actualiza en cuanto llega una notificación
  // (Realtime habilitado por la migración 000006; sin ella, no-op).
  useEffect(() => {
    if (!user?.id) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${user.id}`,
        },
        () => {
          void refreshUnread();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refreshUnread]);

  return (
    <NotificationsContext.Provider value={{ unread, refreshUnread }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useUnreadNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
