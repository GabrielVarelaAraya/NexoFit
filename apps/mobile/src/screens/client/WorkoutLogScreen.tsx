import { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Button, Card, Input, LoadingView } from '../../components/ui';
import { fetchExerciseLibrary, saveWorkout, type WorkoutSetInput } from '../../hooks/useWorkout';
import { holdLoading } from '../../utils/loading';
import { toLocalDateStr } from '../../utils/date';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import type { ExerciseLibraryItem } from '../../types/screens';

type Props = NativeStackScreenProps<MainStackParamList, 'WorkoutLog'>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface SetDraft {
  key: number;
  reps: string;
  weight: string;
}

interface ExerciseDraft {
  key: number;
  libraryId: string | null;
  name: string;
  sets: SetDraft[];
}

// Aceptar coma decimal (teclado es-ES): "40,5" → 40.5
function parseNumber(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isNaN(n) || n < 0 ? null : n;
}

export function WorkoutLogScreen({ route, navigation }: Props) {
  const { user, membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const insets = useSafeAreaInsets();

  const [date, setDate] = useState(toLocalDateStr());
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  // Contador local para keys estables de ejercicios y series (solo estado).
  const nextKey = useRef(1);

  const openPicker = async () => {
    setPickerVisible(true);
    if (library.length > 0 || libraryLoading) return;
    const startedAt = Date.now();
    setLibraryLoading(true);
    const result = await fetchExerciseLibrary(orgId);
    // Transición suave: el spinner del selector se ve al menos MIN_LOADING_MS.
    await holdLoading(startedAt);
    setLibrary(result.data);
    setLibraryError(result.error ?? null);
    setLibraryLoading(false);
  };

  const addExercise = (libraryId: string | null, name: string) => {
    const key = nextKey.current++;
    setExercises((prev) => [
      ...prev,
      {
        key,
        libraryId,
        name,
        sets: [{ key: nextKey.current++, reps: '', weight: '' }],
      },
    ]);
    setPickerVisible(false);
    setSearch('');
  };

  const addCustomExercise = () => {
    const name = search.trim();
    if (name.length < 2) return;
    addExercise(null, name);
  };

  const removeExercise = (exKey: number) => {
    setExercises((prev) => prev.filter((ex) => ex.key !== exKey));
  };

  const addSet = (exKey: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.key === exKey
          ? {
              ...ex,
              sets: [...ex.sets, { key: nextKey.current++, reps: '', weight: '' }],
            }
          : ex
      )
    );
  };

  const removeSet = (exKey: number, setKey: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.key === exKey ? { ...ex, sets: ex.sets.filter((s) => s.key !== setKey) } : ex
      )
    );
  };

  const updateSet = (exKey: number, setKey: number, field: 'reps' | 'weight', value: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.key === exKey
          ? {
              ...ex,
              sets: ex.sets.map((s) => (s.key === setKey ? { ...s, [field]: value } : s)),
            }
          : ex
      )
    );
  };

  const handleSave = async () => {
    if (!DATE_REGEX.test(date) || Number.isNaN(Date.parse(date))) {
      Alert.alert('Error', 'Fecha no válida. Usa el formato AAAA-MM-DD');
      return;
    }
    if (!user?.id || !orgId) {
      Alert.alert('Error', 'No hay una organización asociada a tu perfil.');
      return;
    }

    // Limpiar: series sin datos y ejercicios sin series válidas.
    const validExercises = exercises
      .map((ex) => ({
        exerciseLibraryId: ex.libraryId,
        customName: ex.libraryId ? null : ex.name,
        sets: ex.sets
          .map((s): WorkoutSetInput => ({
            reps: parseNumber(s.reps),
            weightKg: parseNumber(s.weight),
          }))
          .filter((s): s is WorkoutSetInput => s.reps != null || s.weightKg != null),
      }))
      .filter((ex) => ex.sets.length > 0);

    if (validExercises.length === 0) {
      Alert.alert(
        'Faltan datos',
        'Añade al menos un ejercicio con una serie que tenga repeticiones o peso.'
      );
      return;
    }

    setSaving(true);
    const result = await saveWorkout({
      organizationId: orgId,
      profileId: user.id,
      sessionId: route.params?.sessionId ?? null,
      workoutProgramId: route.params?.programId ?? null,
      startedAt: new Date(date + 'T12:00:00').toISOString(),
      notes,
      exercises: validExercises,
    });
    setSaving(false);

    if (result.success) {
      Alert.alert('Entrenamiento guardado', 'Tu registro ya aparece en Progreso.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Error', result.error ?? 'No se pudo guardar el entrenamiento.');
    }
  };

  const searchLower = search.trim().toLowerCase();
  const filteredLibrary = searchLower
    ? library.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.category.toLowerCase().includes(searchLower) ||
          (item.primary_muscle ?? '').toLowerCase().includes(searchLower)
      )
    : library;

  return (
    <View style={styles.container}>
      <Header
        title="Registrar entrenamiento"
        subtitle="Ejercicios, series y cargas"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Detalles */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Detalles</Text>
          <Input
            label="Fecha (AAAA-MM-DD)"
            value={date}
            onChangeText={setDate}
            placeholder="AAAA-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            autoCapitalize="none"
          />
          <Input
            label="Notas (opcional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Sensación, objetivos, comentarios…"
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />
        </Card>

        {/* Ejercicios */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ejercicios</Text>
            <TouchableOpacity style={styles.addChip} onPress={openPicker}>
              <Text style={styles.addChipText}>+ Añadir</Text>
            </TouchableOpacity>
          </View>

          {exercises.length === 0 ? (
            <Text style={styles.emptyHint}>
              Toca «+ Añadir» para elegir un ejercicio de la biblioteca o crear uno personalizado.
            </Text>
          ) : (
            exercises.map((ex, exIndex) => (
              <View key={ex.key} style={styles.exerciseBlock}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>
                    {exIndex + 1}. {ex.name}
                    {ex.libraryId ? '' : '  ·  personalizado'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeExercise(ex.key)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeExercise}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.setRow}>
                  <Text style={styles.setHeader}>#</Text>
                  <Text style={[styles.setHeader, styles.setInput]}>Reps</Text>
                  <Text style={[styles.setHeader, styles.setInput]}>Peso (kg)</Text>
                  <View style={styles.setRemoveSpace} />
                </View>

                {ex.sets.map((set, setIndex) => (
                  <View key={set.key} style={styles.setRow}>
                    <Text style={styles.setNumber}>{setIndex + 1}</Text>
                    <TextInput
                      style={[styles.setInput, styles.setTextInput]}
                      value={set.reps}
                      onChangeText={(v) => updateSet(ex.key, set.key, 'reps', v)}
                      placeholder="10"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.setInput, styles.setTextInput]}
                      value={set.weight}
                      onChangeText={(v) => updateSet(ex.key, set.key, 'weight', v)}
                      placeholder="40"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      onPress={() => removeSet(ex.key, set.key)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeSet}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSetButton} onPress={() => addSet(ex.key)}>
                  <Text style={styles.addSetText}>+ Añadir serie</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        <Button title="Guardar entrenamiento" fullWidth loading={saving} onPress={handleSave} />
      </ScrollView>

      {/* Selector de ejercicios */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Añadir ejercicio</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por nombre, músculo o categoría…"
              autoCapitalize="none"
              autoFocus
            />

            {libraryLoading ? (
              <LoadingView label="Cargando biblioteca…" style={styles.modalLoading} />
            ) : (
              <FlatList
                data={filteredLibrary}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.libraryList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.libraryItem}
                    onPress={() => addExercise(item.id, item.name)}
                  >
                    <Text style={styles.libraryName}>{item.name}</Text>
                    <Text style={styles.libraryMeta}>
                      {item.primary_muscle
                        ? `${item.category} · ${item.primary_muscle}`
                        : item.category}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyHint}>
                    {libraryError
                      ? `No se pudo cargar la biblioteca: ${libraryError}`
                      : searchLower
                        ? 'Sin resultados. Puedes añadirlo como personalizado.'
                        : 'Este gimnasio aún no tiene ejercicios en su biblioteca.'}
                  </Text>
                }
              />
            )}

            <Button
              title={
                search.trim().length >= 2
                  ? `Añadir como «${search.trim()}»`
                  : 'Añadir nombre personalizado'
              }
              variant="ghost"
              fullWidth
              disabled={search.trim().length < 2}
              onPress={addCustomExercise}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16 },
  sectionCard: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  emptyHint: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  addChip: {
    backgroundColor: colors.turquesa,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addChipText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.crema,
  },
  exerciseBlock: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    flex: 1,
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  removeExercise: { fontSize: 16, color: '#EF4444' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setHeader: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: '#9CA3AF',
    width: 24,
    textAlign: 'center',
  },
  setNumber: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
    width: 24,
    textAlign: 'center',
  },
  setInput: { flex: 1 },
  setTextInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: '#111827',
  },
  setRemoveSpace: { width: 16 },
  removeSet: { fontSize: 14, color: '#9CA3AF' },
  addSetButton: { alignSelf: 'flex-start' },
  addSetText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.turquesa,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  modalClose: { fontSize: 20, color: colors.textSecondary },
  modalLoading: { height: 220 },
  libraryList: { maxHeight: 340 },
  libraryItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 2,
  },
  libraryName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  libraryMeta: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#9CA3AF',
  },
});
