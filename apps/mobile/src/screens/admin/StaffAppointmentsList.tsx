import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, getSupabase, shouldShowSkeleton, useHasLoaded } from '@nexofit/core';
import { Badge, Button, Card, CardListSkeleton, EmptyState, withFadeIn } from '../../components/ui';
import { useRealtimeAppointments } from '../../hooks/useRealtimeAppointments';
import { confirmAction, notify } from '../../utils/alerts';
import { caughtError } from '../../utils/errors';
import { endOfLocalDay, startOfLocalDay } from '../../utils/date';
import {
  appointmentBadge,
  fetchProfessionalDirectory,
  formatGymTime,
  type AppointmentTone,
} from '../../utils/appointments';
import {
  fetchOrgAppointments,
  updateProfessionalAppointment,
  type Appointment,
} from '../../utils/professional';

const TONE_COLORS: Record<AppointmentTone, string> = {
  upcoming: colors.turquesa,
  done: colors.textMuted,
  cancelled: colors.danger,
  warning: colors.warning,
};

/**
 * Citas 1-a-1 del día para el staff (pestaña «Citas» de Agenda). Solo el admin
 * las puede ver y cancelar (RLS); el coach recibe una explicación.
 */
export function StaffAppointmentsList({
  organizationId,
  date,
  isAdmin,
}: {
  organizationId: string;
  date: string;
  isAdmin: boolean;
}) {
  const [items, setItems] = useState<Appointment[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const hasLoaded = useHasLoaded(loading, date);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!isAdmin) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const client = getSupabase();
        const [appointments, directory] = await Promise.all([
          fetchOrgAppointments(client, organizationId, startOfLocalDay(date), endOfLocalDay(date)),
          fetchProfessionalDirectory(client).catch(() => []),
        ]);
        setItems(appointments);
        setNames(
          new Map(directory.map((item) => [item.professionalId, item.fullName ?? 'Profesional']))
        );
      } catch (cause) {
        if (!silent) setError(caughtError(cause, 'No se pudieron cargar las citas.'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [organizationId, date, isAdmin]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeAppointments('organization_id', isAdmin ? organizationId : undefined, () => {
    void load(true);
  });

  const cancel = (appointment: Appointment) =>
    confirmAction({
      title: 'Cancelar cita',
      message: `${appointment.patient?.full_name ?? 'El cliente'} recibirá un aviso de la cancelación.`,
      confirmLabel: 'Cancelar cita',
      cancelLabel: 'Volver',
      onConfirm: async () => {
        setPendingId(appointment.id);
        try {
          await updateProfessionalAppointment(
            getSupabase(),
            organizationId,
            appointment.professional_id,
            appointment,
            'cancelled'
          );
          await load(true);
        } catch (cause) {
          notify(caughtError(cause, 'Inténtalo de nuevo.'), 'No se pudo cancelar');
        } finally {
          setPendingId(null);
        }
      },
    });

  if (!isAdmin) {
    return (
      <EmptyState
        icon="lock-closed-outline"
        title="Solo para administradores"
        message="Las citas 1-a-1 las gestionan el administrador y cada profesional."
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={
        shouldShowSkeleton(loading, hasLoaded) ? (
          <CardListSkeleton label="Cargando citas" count={3} flush />
        ) : error ? null : (
          <EmptyState
            icon="calendar-clear-outline"
            title="Sin citas este día"
            message="Las citas que reserven los miembros con tus profesionales aparecerán aquí."
          />
        )
      }
      renderItem={withFadeIn(({ item }: { item: Appointment; index: number }) => {
        const badge = appointmentBadge(item.status, item.ends_at);
        const start = new Date(item.starts_at);
        const end = new Date(item.ends_at);
        const cancellable = item.status === 'confirmed' && start.getTime() > Date.now();
        return (
          <Card style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.time}>
                {formatGymTime(start)} – {formatGymTime(end)}
              </Text>
              <Badge label={badge.label} color={TONE_COLORS[badge.tone]} />
            </View>
            <Text style={styles.title}>{item.services?.name ?? 'Cita'}</Text>
            <Text style={styles.meta}>
              Cliente: {item.patient?.full_name ?? 'Sin nombre'}
              {item.patient?.phone ? ` · Tel. ${item.patient.phone}` : ''}
            </Text>
            <Text style={styles.meta}>
              Profesional: {names.get(item.professional_id) ?? 'Profesional'}
            </Text>
            {cancellable && (
              <Button
                title="Cancelar cita"
                variant="ghost"
                loading={pendingId === item.id}
                disabled={pendingId !== null}
                onPress={() => cancel(item)}
              />
            )}
          </Card>
        );
      })}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },
  card: { gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.azulNexo },
  title: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.azulNexo },
  meta: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textSecondary },
  error: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textError, marginBottom: 8 },
});
