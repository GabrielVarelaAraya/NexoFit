import { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { getSupabase } from '@nexofit/core';
import { Button, Card, Input } from '../../components/ui';
import { useProfessional } from '../../hooks/useProfessional';
import {
  addProfessionalAvailability,
  deleteProfessionalAvailability,
  WEEKDAYS,
  type Availability,
} from '../../utils/professional';
import { ProfessionalLayout, professionalStyles as styles } from './ProfessionalLayout';

export function ProfessionalAvailabilityScreen() {
  const { workspace, loading, error, refresh } = useProfessional();
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('09:00');
  const [pending, setPending] = useState(false);
  const add = async () => {
    if (!workspace || pending) return;
    setPending(true);
    try {
      await addProfessionalAvailability(
        getSupabase(),
        workspace.professional.id,
        day,
        start.trim(),
        end.trim(),
        workspace.availability
      );
      await refresh();
    } catch (cause) {
      Alert.alert(
        'No se pudo guardar',
        cause instanceof Error ? cause.message : 'Inténtalo de nuevo.'
      );
    } finally {
      setPending(false);
    }
  };
  const remove = async (block: Availability) => {
    if (!workspace || pending) return;
    setPending(true);
    try {
      await deleteProfessionalAvailability(getSupabase(), workspace.professional.id, block.id);
      await refresh();
    } catch (cause) {
      Alert.alert(
        'No se pudo eliminar',
        cause instanceof Error ? cause.message : 'Inténtalo de nuevo.'
      );
    } finally {
      setPending(false);
    }
  };
  const confirmRemove = (block: Availability) =>
    Alert.alert('Eliminar horario', 'Este cambio no cancela las citas que ya tienes asignadas.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void remove(block) },
    ]);
  return (
    <ProfessionalLayout title="Mi disponibilidad" loading={loading} error={error} refresh={refresh}>
      <Text style={styles.text}>Define los horarios semanales en los que puedes atender.</Text>
      <Card style={styles.form}>
        <Text style={styles.title}>Nuevo horario</Text>
        <View style={styles.row}>
          {WEEKDAYS.map((name, index) => (
            <TouchableOpacity
              key={name}
              style={[styles.chip, day === index && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: day === index }}
              disabled={pending}
              onPress={() => setDay(index)}
            >
              <Text style={styles.chipText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input
          label="Hora inicial"
          hint="Formato de 24 horas: HH:mm"
          value={start}
          onChangeText={setStart}
          autoCapitalize="none"
          maxLength={5}
          editable={!pending}
        />
        <Input
          label="Hora final"
          value={end}
          onChangeText={setEnd}
          autoCapitalize="none"
          maxLength={5}
          editable={!pending}
        />
        <Button
          title="Agregar horario"
          loading={pending}
          disabled={pending}
          onPress={() => void add()}
        />
      </Card>
      <Text style={styles.title}>Horarios guardados</Text>
      {!workspace?.availability.length && (
        <Text style={styles.text}>Todavía no has registrado disponibilidad.</Text>
      )}
      {workspace?.availability.map((block) => (
        <Card key={block.id} style={styles.card}>
          <Text style={styles.title}>{WEEKDAYS[block.day_of_week]}</Text>
          <Text style={styles.text}>
            {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
          </Text>
          <Button
            title="Eliminar horario"
            variant="ghost"
            disabled={pending}
            onPress={() => confirmRemove(block)}
          />
        </Card>
      ))}
    </ProfessionalLayout>
  );
}
