import { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { getSupabase } from '@nexofit/core';
import { Button, Card } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useProfessional } from '../../hooks/useProfessional';
import {
  APPOINTMENT_STATUS,
  updateProfessionalAppointment,
  type Appointment,
} from '../../utils/professional';
import { ProfessionalLayout, professionalStyles as styles } from './ProfessionalLayout';

export function ProfessionalAgendaScreen() {
  const { membership } = useAuth();
  const { workspace, loading, error, refresh } = useProfessional();
  const [history, setHistory] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const now = Date.now();
  const appointments =
    workspace?.appointments.filter((appointment) => {
      const upcoming =
        appointment.status === 'confirmed' && new Date(appointment.ends_at).getTime() >= now;
      return history ? !upcoming : upcoming;
    }) ?? [];
  if (history) appointments.reverse();

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
      Alert.alert(
        'No se pudo actualizar',
        cause instanceof Error ? cause.message : 'Inténtalo de nuevo.'
      );
    } finally {
      setPending(null);
    }
  };
  const cancel = (appointment: Appointment) =>
    Alert.alert('Cancelar cita', 'El paciente verá esta cita como cancelada.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar cita',
        style: 'destructive',
        onPress: () => void update(appointment, 'cancelled'),
      },
    ]);

  return (
    <ProfessionalLayout title="Mi agenda" loading={loading} error={error} refresh={refresh}>
      <Text style={styles.text}>{membership?.organization_name} · Tus citas asignadas</Text>
      <View style={styles.row}>
        {[false, true].map((value) => (
          <TouchableOpacity
            key={String(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: history === value }}
            style={[styles.chip, history === value && styles.chipActive]}
            onPress={() => setHistory(value)}
          >
            <Text style={styles.chipText}>{value ? 'Historial' : 'Próximas'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!appointments.length && (
        <Card>
          <Text style={styles.text}>
            {history
              ? 'Todavía no hay citas en tu historial.'
              : 'No tienes citas próximas asignadas.'}
          </Text>
        </Card>
      )}
      {appointments.map((appointment) => (
        <Card key={appointment.id} style={styles.card}>
          <Text style={styles.title}>{appointment.patient?.full_name || 'Paciente'}</Text>
          <Text style={styles.text}>
            {appointment.services?.name || 'Consulta'} · {APPOINTMENT_STATUS[appointment.status]}
          </Text>
          <Text style={styles.text}>
            {new Date(appointment.starts_at).toLocaleDateString('es-CR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <Text style={styles.text}>
            {new Date(appointment.starts_at).toLocaleTimeString('es-CR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' – '}
            {new Date(appointment.ends_at).toLocaleTimeString('es-CR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
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
    </ProfessionalLayout>
  );
}
