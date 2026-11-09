import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, getSupabase, shouldShowSkeleton, useHasLoaded } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import {
  Header,
  Card,
  Button,
  CardListSkeleton,
  withFadeIn,
  EmptyState,
  SegmentedControl,
} from '../../components/ui';
import { holdLoading } from '../../utils/loading';
import { friendlyError } from '../../utils/errors';
import { confirmAction, notify } from '../../utils/alerts';
import { useRealtimeAppointments } from '../../hooks/useRealtimeAppointments';
import type { NavigationProp } from '../../types/screens';
import {
  appointmentBadge,
  cancelAppointment,
  canCancelAppointment,
  fetchProfessionalDirectory,
  formatGymDate,
  formatGymTime,
  splitAppointments,
  type AppointmentTone,
} from '../../utils/appointments';

interface Appointment {
  id: string;
  service_name: string;
  professional_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

const TONE_COLORS: Record<AppointmentTone, string> = {
  upcoming: colors.turquesa,
  done: colors.textMuted,
  cancelled: colors.danger,
  warning: colors.warning,
};

export function AppointmentsScreen({ navigation }: { navigation: NavigationProp }) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useHasLoaded(loading);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  // Próximas: confirmadas por venir (la más cercana arriba). Anteriores: pasadas
  // o canceladas (la más reciente arriba), para no mezclar canceladas con activas.
  const { upcoming, past } = useMemo(() => splitAppointments(appointments), [appointments]);
  const visibleAppointments = tab === 'upcoming' ? upcoming : past;

  // `silent`: refresco en vivo, sin spinner ni parpadeo de la lista.
  const fetchAppointments = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const startedAt = Date.now();
      if (!user?.id) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError(null);

      try {
        const supabase = getSupabase();
        const [appointmentsResult, directory] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, starts_at, ends_at, status, professional_id, services ( name )')
            .eq('profile_id', user.id)
            .order('starts_at', { ascending: false }),
          // Los nombres vienen de un RPC: RLS no deja leer el perfil de otros miembros.
          fetchProfessionalDirectory(supabase).catch(() => []),
        ]);

        if (appointmentsResult.error) {
          // Un refresco en vivo que falla conserva la lista que ya se ve.
          if (!silent) {
            setError(friendlyError(appointmentsResult.error, 'No se pudieron cargar tus citas.'));
            setAppointments([]);
          }
        } else {
          const names = new Map(directory.map((item) => [item.professionalId, item.fullName]));
          setAppointments(
            (appointmentsResult.data ?? []).map((a) => ({
              id: a.id,
              starts_at: a.starts_at,
              ends_at: a.ends_at,
              status: a.status,
              service_name: a.services?.name ?? 'Servicio',
              professional_name: names.get(a.professional_id) ?? 'Profesional',
            }))
          );
        }
      } finally {
        if (!silent) {
          // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
          await holdLoading(startedAt);
          setLoading(false);
        }
      }
    },
    [user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      void fetchAppointments();
    }, [fetchAppointments])
  );

  useRealtimeAppointments('profile_id', user?.id, () => {
    void fetchAppointments({ silent: true });
  });

  const handleCancel = (id: string) => {
    confirmAction({
      title: 'Cancelar cita',
      message: '¿Seguro que quieres cancelar esta cita?',
      confirmLabel: 'Sí, cancelar',
      cancelLabel: 'No',
      onConfirm: async () => {
        setCancellingId(id);
        const outcome = await cancelAppointment(getSupabase(), id);
        setCancellingId(null);

        if (!outcome.success) {
          notify(outcome.error ?? 'No se pudo cancelar la cita.', 'Error');
        }
        // Recarga siempre: la cita pudo cambiar de estado mientras tanto.
        void fetchAppointments();
      },
    });
  };

  const goBook = () => navigation.navigate('BookAppointment');

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const badge = appointmentBadge(item.status, item.ends_at);
    const start = new Date(item.starts_at);
    const end = new Date(item.ends_at);
    const cancellable = canCancelAppointment(item.status, item.starts_at);

    return (
      <Card
        title={item.service_name}
        subtitle={`${formatGymDate(start)} · ${formatGymTime(start)} – ${formatGymTime(end)}`}
        badge={badge.label}
        badgeColor={TONE_COLORS[badge.tone]}
      >
        <Text style={styles.professional}>Profesional: {item.professional_name}</Text>
        {cancellable && (
          <Button
            title="Cancelar cita"
            variant="danger"
            fullWidth
            disabled={cancellingId === item.id}
            loading={cancellingId === item.id}
            onPress={() => handleCancel(item.id)}
          />
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Citas"
        subtitle="Tus citas 1-a-1"
        rightAction={{ label: 'Reservar', onPress: goBook }}
      />
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" variant="ghost" onPress={() => void fetchAppointments()} />
        </View>
      )}
      {appointments.length > 0 && (
        <SegmentedControl
          style={styles.segment}
          value={tab}
          onChange={setTab}
          segments={[
            { value: 'upcoming', label: `Próximas (${upcoming.length})` },
            { value: 'past', label: `Anteriores (${past.length})` },
          ]}
        />
      )}
      <FlatList
        data={visibleAppointments}
        keyExtractor={(a) => a.id}
        renderItem={withFadeIn(renderAppointment)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void fetchAppointments()} />
        }
        ListEmptyComponent={
          shouldShowSkeleton(loading, hasLoaded) ? (
            <CardListSkeleton label="Cargando tus citas" count={3} withButton flush />
          ) : error ? null : appointments.length > 0 ? (
            tab === 'upcoming' ? (
              <EmptyState
                title="No tienes citas próximas"
                actionLabel="Reservar una cita"
                onAction={goBook}
              />
            ) : (
              <EmptyState title="Aún no tienes citas anteriores" />
            )
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Sin citas"
              message="Reserva una sesión 1-a-1 con un profesional de tu gimnasio y aparecerá aquí."
              actionLabel="Reservar una cita"
              onAction={goBook}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  list: { padding: 16, gap: 12, paddingBottom: 24 },
  segment: { marginHorizontal: 16, marginTop: 12 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  professional: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    gap: 8,
  },
  errorText: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textError },
});
