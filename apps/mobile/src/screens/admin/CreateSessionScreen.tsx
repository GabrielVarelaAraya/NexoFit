import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Button, Card, Input } from '../../components/ui';
import {
  fetchClassTypes,
  fetchSpaces,
  type ClassTypeOption,
  type SpaceOption,
} from '../../hooks/useAdmin';
import { holdLoading } from '../../utils/loading';
import { toLocalDateStr } from '../../utils/date';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateSession'>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// 00:00 – 23:59, con ceros a la izquierda.
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function CreateSessionScreen({ route, navigation }: Props) {
  const { membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const insets = useSafeAreaInsets();

  const [classTypes, setClassTypes] = useState<ClassTypeOption[]>([]);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [selectedClassTypeId, setSelectedClassTypeId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [date, setDate] = useState(route.params?.defaultDate ?? toLocalDateStr());
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  // Evita pisar la selección del usuario cuando el efecto vuelve a correr.
  const autoSelected = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const startedAt = Date.now();
      setOptionsLoading(true);
      const [typesResult, spacesResult] = await Promise.all([
        fetchClassTypes(orgId),
        fetchSpaces(orgId),
      ]);
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      if (cancelled) return;

      setClassTypes(typesResult.data);
      setSpaces(spacesResult.data);
      setOptionsError(typesResult.error ?? spacesResult.error ?? null);

      if (!autoSelected.current) {
        autoSelected.current = true;
        setSelectedClassTypeId((prev) => prev ?? typesResult.data[0]?.id ?? null);
        setSelectedSpaceId((prev) => prev ?? spacesResult.data[0]?.id ?? null);
      }
      setOptionsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const handleCreate = async () => {
    const classTypeId = selectedClassTypeId;
    const spaceId = selectedSpaceId;

    if (!classTypeId) {
      Alert.alert('Faltan datos', 'Selecciona un tipo de clase.');
      return;
    }
    if (!spaceId) {
      Alert.alert('Faltan datos', 'Selecciona un espacio.');
      return;
    }
    if (!DATE_REGEX.test(date) || Number.isNaN(Date.parse(date))) {
      Alert.alert('Error', 'Fecha no válida. Usa el formato AAAA-MM-DD');
      return;
    }
    if (!TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) {
      Alert.alert('Error', 'Horas no válidas. Usa el formato HH:MM (24 h).');
      return;
    }

    const startsAt = new Date(`${date}T${startTime}:00`);
    const endsAt = new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      Alert.alert('Error', 'No se pudo leer la fecha y hora.');
      return;
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      Alert.alert('Error', 'La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    let capacityOverride: number | null = null;
    if (capacity.trim()) {
      const parsed = Number(capacity.replace(',', '.'));
      if (!Number.isInteger(parsed) || parsed <= 0) {
        Alert.alert('Error', 'El cupo debe ser un número entero positivo.');
        return;
      }
      capacityOverride = parsed;
    }

    // Stage 5 · Detección de conflictos: una clase no puede solapar otra en
    // el mismo espacio. (Las clases creadas aquí no llevan coach asignado,
    // así que no existe conflicto de entrenador que verificar.)
    const supabase = getSupabase();
    const { data: overlaps, error: overlapErr } = await supabase
      .from('sessions')
      .select('id')
      .eq('space_id', spaceId)
      .lt('starts_at', startsAt.toISOString())
      .gt('ends_at', endsAt.toISOString());

    if (overlapErr) {
      Alert.alert('Error', `No se pudo verificar la disponibilidad: ${overlapErr.message}`);
      return;
    }
    if (overlaps && overlaps.length > 0) {
      Alert.alert(
        'Espacio ocupado',
        'Ya hay otra clase en ese espacio que se cruza con el horario elegido.'
      );
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('sessions').insert({
      class_type_id: classTypeId,
      space_id: spaceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity_override: capacityOverride,
    });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Clase creada', 'La nueva clase ya aparece en la agenda.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  if (!orgId) {
    return (
      <View style={styles.container}>
        <Header
          title="Nueva clase"
          leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
        />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin organización</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Nueva clase"
        subtitle="Tipo, espacio y horario"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {optionsLoading ? (
          <Card style={styles.sectionCard}>
            <ActivityIndicator style={styles.loading} color={colors.turquesa} />
            <Text style={styles.optionsHint}>Cargando opciones…</Text>
          </Card>
        ) : (
          <>
            {/* Tipo de clase */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Tipo de clase</Text>
              {classTypes.length === 0 ? (
                <>
                  <Text style={styles.optionsHint}>
                    Tu gimnasio aún no tiene tipos de clase. Crea uno para poder programar clases.
                  </Text>
                  <Button
                    title="Crear tipo de clase"
                    variant="secondary"
                    onPress={() => navigation.navigate('GymContent')}
                  />
                </>
              ) : (
                <View style={styles.chips}>
                  {classTypes.map((ct) => (
                    <TouchableOpacity
                      key={ct.id}
                      style={[
                        styles.chip,
                        { borderColor: ct.color },
                        selectedClassTypeId === ct.id && styles.chipActive,
                      ]}
                      onPress={() => setSelectedClassTypeId(ct.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedClassTypeId === ct.id && styles.chipTextActive,
                        ]}
                      >
                        {ct.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {optionsError && <Text style={styles.optionsError}>{optionsError}</Text>}
            </Card>

            {/* Espacio */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Espacio</Text>
              {spaces.length === 0 ? (
                <>
                  <Text style={styles.optionsHint}>
                    Tu gimnasio aún no tiene espacios. Crea una sede con sus espacios para programar
                    clases.
                  </Text>
                  <Button
                    title="Crear sede o espacio"
                    variant="secondary"
                    onPress={() => navigation.navigate('GymContent')}
                  />
                </>
              ) : (
                <View style={styles.chips}>
                  {spaces.map((sp) => (
                    <TouchableOpacity
                      key={sp.id}
                      style={[styles.chip, selectedSpaceId === sp.id && styles.chipActive]}
                      onPress={() => setSelectedSpaceId(sp.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedSpaceId === sp.id && styles.chipTextActive,
                        ]}
                      >
                        {sp.venueName ? `${sp.venueName} · ${sp.name}` : sp.name} (cap.{' '}
                        {sp.capacity})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            {/* Horario */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Horario</Text>
              <Input
                label="Fecha (AAAA-MM-DD)"
                value={date}
                onChangeText={setDate}
                placeholder="AAAA-MM-DD"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoCapitalize="none"
              />
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Input
                    label="Inicio (HH:MM)"
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="07:00"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.timeField}>
                  <Input
                    label="Fin (HH:MM)"
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="08:00"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Input
                label="Cupo (opcional)"
                value={capacity}
                onChangeText={setCapacity}
                placeholder="Vacío = capacidad del espacio"
                keyboardType="number-pad"
              />
            </Card>

            <Button title="Crear clase" fullWidth loading={saving} onPress={handleCreate} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16 },
  sectionCard: { gap: 12 },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.azulNexo, borderColor: colors.azulNexo },
  chipText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
  },
  chipTextActive: { color: colors.crema },
  optionsHint: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  optionsError: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#EF4444',
  },
  loading: { marginTop: 8 },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
});
