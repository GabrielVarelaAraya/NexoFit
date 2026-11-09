import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { Button, Card, SegmentedControl } from '../../components/ui';
import {
  formatGymDate,
  formatGymTime,
  groupByGymDay,
  splitAppointments,
} from '../../utils/appointments';
import { useAuth } from '../../contexts/AuthContext';
import { useProfessional } from '../../hooks/useProfessional';
import { useRealtimeAppointments } from '../../hooks/useRealtimeAppointments';
import { caughtError } from '../../utils/errors';
import { confirmAction, notify } from '../../utils/alerts';
import {
  APPOINTMENT_STATUS,
  professionalSetup,
  updateProfessionalAppointment,
  type Appointment,
} from '../../utils/professional';
import { ProfessionalLayout, professionalStyles as styles } from './ProfessionalLayout';

export function ProfessionalAgendaScreen() {
  const { membership } = useAuth();
  const { workspace, loading, error, refresh } = useProfessional();
  useRealtimeAppointments('professional_id', workspace?.professional.id, () => {
    void refresh(true);
  });
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const history = tab === 'past';
  const [pending, setPending] = useState<string | null>(null);
  const now = Date.now();
  // Misma regla que la vista del miembro: próximas = confirmadas por venir.
  const split = splitAppointments(workspace?.appointments ?? []);
  const appointments = history ? split.past : split.upcoming;
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();
  const setup = workspace ? professionalSetup(workspace) : [];
  const pendingSetup = setup.filter((item) => !item.done);

  const update = async (appointment: Appointment, status: 'cancelled' | 'attended' | 'no_show') => {
    if (!workspace || !membership || pending) return;
    setPending(appointment.id);
    try {
      await updateProfessionalAppointment(
        getSupabase(),
        membership.organization_id,
        workspace.professional.id,
        appointment,
        status
      );
      await refresh();
    } catch (cause) {
      notify(caughtError(cause, 'Inténtalo de nuevo.'), 'No se pudo actualizar');
    } finally {
      setPending(null);
    }
  };
  const cancel = (appointment: Appointment) =>
    confirmAction({
      title: 'Cancelar cita',
      message: 'El cliente recibirá un aviso y verá esta cita como cancelada.',
      confirmLabel: 'Cancelar cita',
      cancelLabel: 'Volver',
      onConfirm: () => void update(appointment, 'cancelled'),
    });

  return (
    <ProfessionalLayout title="Mi agenda" loading={loading} error={error} refresh={refresh}>
      <Text style={styles.text}>{membership?.organization_name} · Tus citas asignadas</Text>
      {pendingSetup.length > 0 && (
        <Card style={setupStyles.card}>
          <Text style={styles.title}>Completa tu perfil para recibir reservas</Text>
          <Text style={styles.text}>
            Los miembros solo pueden reservarte cuando tienes estos datos.
          </Text>
          {setup.map((item) => (
            <TouchableOpacity
              key={item.step}
              accessibilityRole="button"
              accessibilityState={{ disabled: item.done }}
              disabled={item.done}
              style={setupStyles.row}
              onPress={() => navigation.navigate(item.tab)}
            >
              <Ionicons
                name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={item.done ? colors.textSuccess : colors.textSecondary}
              />
              <Text style={[setupStyles.label, item.done && setupStyles.labelDone]}>
                {item.label}
              </Text>
              {!item.done && (
                <Ionicons name="chevron-forward" size={18} color={colors.textAccent} />
              )}
            </TouchableOpacity>
          ))}
        </Card>
      )}
      <SegmentedControl
        value={tab}
        onChange={setTab}
        segments={[
          { value: 'upcoming', label: `Próximas (${split.upcoming.length})` },
          { value: 'past', label: `Historial (${split.past.length})` },
        ]}
      />
      {!appointments.length && (
        <Card>
          <Text style={styles.text}>
            {history
              ? 'Todavía no hay citas en tu historial.'
              : 'No tienes citas próximas asignadas.'}
          </Text>
        </Card>
      )}
      {/* Agrupadas por día («Hoy», «Mañana», «jue 12 nov») con la hora al frente:
          es lo primero que busca el profesional. Hora del gimnasio, igual que el miembro. */}
      {groupByGymDay(appointments).map((group) => (
        <View key={group.key} style={dayStyles.group}>
          <Text style={dayStyles.label} accessibilityRole="header">
            {group.label}
          </Text>
          {group.items.map((appointment) => (
            <Card key={appointment.id} style={styles.card}>
              <View style={dayStyles.cardTop}>
                <Text style={dayStyles.time}>
                  {formatGymTime(new Date(appointment.starts_at))} –{' '}
                  {formatGymTime(new Date(appointment.ends_at))}
                </Text>
                <Text style={dayStyles.status}>{APPOINTMENT_STATUS[appointment.status]}</Text>
              </View>
              <Text style={styles.title}>{appointment.patient?.full_name || 'Cliente'}</Text>
              <Text style={styles.text}>{appointment.services?.name || 'Consulta'}</Text>
              {history && (
                <Text style={styles.text}>{formatGymDate(new Date(appointment.starts_at))}</Text>
              )}
              {appointment.patient?.phone && (
                <Text style={styles.text}>Teléfono: {appointment.patient.phone}</Text>
              )}
              {appointment.status === 'confirmed' && (
                <View style={styles.form}>
                  {now >= new Date(appointment.starts_at).getTime() && (
                    <Button
                      title="Marcar atendida"
                      disabled={pending !== null}
                      loading={pending === appointment.id}
                      onPress={() => void update(appointment, 'attended')}
                    />
                  )}
                  {now >= new Date(appointment.ends_at).getTime() && (
                    <Button
                      title="No asistió"
                      variant="ghost"
                      disabled={pending !== null}
                      onPress={() => void update(appointment, 'no_show')}
                    />
                  )}
                  {now < new Date(appointment.starts_at).getTime() && (
                    <Button
                      title="Cancelar cita"
                      variant="danger"
                      disabled={pending !== null}
                      loading={pending === appointment.id}
                      onPress={() => cancel(appointment)}
                    />
                  )}
                </View>
              )}
            </Card>
          ))}
        </View>
      ))}
    </ProfessionalLayout>
  );
}

const dayStyles = StyleSheet.create({
  group: { gap: 10 },
  label: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.azulNexo, marginTop: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.textAccent },
  status: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
});

const setupStyles = StyleSheet.create({
  card: { gap: 8, borderColor: colors.warning + '66', backgroundColor: colors.warningBg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  label: { flex: 1, fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.azulNexo },
  labelDone: {
    fontFamily: fonts.uiRegular,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
});
