import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@nexofit/core';
import { useUnreadNotifications } from '../contexts/NotificationsContext';
import { holdLoading } from '../utils/loading';
import {
  markAllReadLocally,
  NOTIFICATIONS_LIMIT,
  sortNotificationsDesc,
  type AppNotification,
} from '../utils/notifications';

interface UseNotificationsResult {
  notifications: AppNotification[];
  loading: boolean;
  error: string | null;
  markingRead: boolean;
  refresh: () => Promise<void>;
  /** Marca todas las no leídas como leídas. `ok: false` si RLS no permitió. */
  markAllRead: () => Promise<{ ok: boolean }>;
}

export function useNotifications(profileId: string): UseNotificationsResult {
  const { refreshUnread } = useUnreadNotifications();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('id, title, body, created_at, read')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(NOTIFICATIONS_LIMIT);

    await holdLoading(startedAt);
    setNotifications(fetchError ? [] : sortNotificationsDesc((data ?? []) as AppNotification[]));
    setError(fetchError ? 'No se pudieron cargar las notificaciones.' : null);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markAllRead = useCallback(async (): Promise<{ ok: boolean }> => {
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    if (unreadIds.length === 0) return { ok: true };
    if (markingRead) return { ok: false };

    setMarkingRead(true);
    const supabase = getSupabase();
    // RLS (notification_update) permite actualizar solo las propias.
    // .select('id') confirma cuántas filas se modificaron de verdad.
    const { data, error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
      .select('id');
    setMarkingRead(false);

    if (updateError) return { ok: false };

    if (!data || data.length === 0) {
      // RLS silenciosa: recargamos para no mostrar un estado falso.
      await refresh();
      return { ok: false };
    }

    setNotifications(markAllReadLocally);
    await refreshUnread();
    return { ok: true };
  }, [markingRead, notifications, refresh, refreshUnread]);

  return { notifications, loading, error, markingRead, refresh, markAllRead };
}
