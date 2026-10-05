import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card, Button, LoadingView } from '../../components/ui';
import { useBodyMetrics, type MeasurementWithValues } from '../../hooks/useProgress';
import { useWorkouts } from '../../hooks/useWorkout';
import { toLocalDateStr } from '../../utils/date';
import type { NavigationProp, WorkoutLogItem } from '../../types/screens';

const METRIC_DEFINITIONS = [
  { name: 'Peso', unit: 'kg', placeholder: '70.0' },
  { name: 'Grasa corporal', unit: '%', placeholder: '20.0' },
  { name: 'Masa muscular', unit: 'kg', placeholder: '30.0' },
  { name: 'Cintura', unit: 'cm', placeholder: '80' },
  { name: 'Cadera', unit: 'cm', placeholder: '95' },
  { name: 'Pecho', unit: 'cm', placeholder: '100' },
  { name: 'Brazo', unit: 'cm', placeholder: '32' },
  { name: 'Muslo', unit: 'cm', placeholder: '55' },
  { name: 'Pantorrilla', unit: 'cm', placeholder: '38' },
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toMetricList(measurement?: MeasurementWithValues) {
  if (!measurement) return [];
  return measurement.measurement_values.map((m) => ({
    name: m.metric_name,
    value: Number(m.value_numeric),
    unit: m.unit ?? '',
  }));
}

export function ProgressScreen({ navigation }: { navigation: NavigationProp }) {
  const { user, membership } = useAuth();
  const {
    measurements,
    loading,
    error,
    refresh,
    addMeasurement,
    deleteMeasurement,
    getLatestMetrics,
  } = useBodyMetrics(user?.id ?? '', membership?.organization_id);
  const {
    logs,
    records,
    loading: workoutsLoading,
    error: workoutsError,
    refresh: refreshWorkouts,
  } = useWorkouts(user?.id ?? '');
  const [modalVisible, setModalVisible] = useState(false);
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr());
  const [saving, setSaving] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshWorkouts();
    }, [refresh, refreshWorkouts])
  );

  const latestMetrics = getLatestMetrics();
  const previousMetrics = toMetricList(measurements[1]);
  // Transición inicial: sin datos aún, mostrar el spinner a pantalla completa
  // en lugar de una pantalla vacía.
  const initialLoading =
    (loading && measurements.length === 0 && !error) ||
    (workoutsLoading && logs.length === 0 && records.length === 0 && !workoutsError);

  const findLatest = (name: string) => latestMetrics.find((m) => m.name === name)?.value;

  const findTrend = (name: string) => {
    const current = latestMetrics.find((m) => m.name === name)?.value;
    const previous = previousMetrics.find((m) => m.name === name)?.value;
    if (current == null || previous == null) return null;
    const delta = current - previous;
    if (delta === 0) return '0';
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
  };

  const handleAddMeasurement = async () => {
    if (!DATE_REGEX.test(selectedDate) || Number.isNaN(Date.parse(selectedDate))) {
      Alert.alert('Error', 'Fecha no válida. Usa el formato AAAA-MM-DD');
      return;
    }

    const metrics = Object.entries(metricInputs)
      .map(([name, value]) => ({
        name,
        // Aceptar coma decimal (teclado es-ES): "70,5" -> 70.5
        value: parseFloat(value.replace(',', '.')),
        unit: METRIC_DEFINITIONS.find((m) => m.name === name)?.unit ?? '',
      }))
      .filter((m) => !Number.isNaN(m.value));

    if (metrics.length === 0) {
      Alert.alert('Error', 'Ingresa al menos una medida');
      return;
    }

    setSaving(true);
    const result = await addMeasurement({
      measured_at: new Date(selectedDate + 'T12:00:00').toISOString(),
      metrics,
      source: 'manual',
    });
    setSaving(false);

    if (result.success) {
      setModalVisible(false);
      setMetricInputs({});
      setSelectedDate(toLocalDateStr());
    } else {
      Alert.alert('Error', result.error ?? 'No se pudo guardar');
    }
  };

  const handleDeleteMeasurement = (id: string) => {
    Alert.alert('Eliminar', '¿Estás seguro de eliminar esta medición?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteMeasurement(id);
          if (!result.success) {
            Alert.alert('Error', result.error ?? 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const openModal = () => {
    setMetricInputs({});
    setSelectedDate(toLocalDateStr());
    setModalVisible(true);
  };

  const closeModal = () => {
    Keyboard.dismiss();
    setModalVisible(false);
  };

  if (!user?.id) {
    return (
      <View style={styles.container}>
        <Header title="Progreso" subtitle="Inicia sesión para ver tu progreso" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Inicia sesión</Text>
          <Text style={styles.emptyText}>Para ver tu progreso y registrar medidas.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Progreso" subtitle="Tu evolución" />
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" variant="ghost" onPress={() => refresh()} />
        </View>
      )}
      {initialLoading ? (
        <LoadingView label="Cargando tu progreso…" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Latest values */}
          <View style={styles.statsGrid}>
            <StatCard
              title="Peso"
              value={findLatest('Peso') != null ? String(findLatest('Peso')) : '—'}
              subtitle="kg"
              color={colors.turquesa}
            />
            <StatCard
              title="Grasa corporal"
              value={
                findLatest('Grasa corporal') != null ? String(findLatest('Grasa corporal')) : '—'
              }
              subtitle="%"
              color={colors.mentaActiva}
            />
            <StatCard
              title="Cintura"
              value={findLatest('Cintura') != null ? String(findLatest('Cintura')) : '—'}
              subtitle="cm"
              color={colors.azulNexo}
            />
            <StatCard
              title="Registros"
              value={String(measurements.length)}
              subtitle="Medidas totales"
              color={colors.turquesa}
            />
          </View>

          {/* Body Metrics */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Medidas corporales</Text>
              <TouchableOpacity style={styles.addChip} onPress={openModal}>
                <Text style={styles.addChipText}>+ Añadir</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Última actualización:{' '}
              {measurements[0]?.measured_at
                ? new Date(measurements[0].measured_at).toLocaleDateString('es-ES')
                : 'Sin datos'}
            </Text>

            {loading ? (
              <ActivityIndicator style={styles.loading} color={colors.turquesa} />
            ) : latestMetrics.length > 0 ? (
              <View style={styles.metricsGrid}>
                {latestMetrics.map((metric) => (
                  <MetricItem
                    key={metric.name}
                    label={metric.name}
                    value={metric.value}
                    unit={metric.unit}
                    trend={findTrend(metric.name)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.noMetrics}>
                <Text style={styles.noMetricsText}>No hay medidas registradas</Text>
                <Text style={styles.noMetricsSubtext}>
                  Presiona "+ Añadir" para registrar tu primera medición
                </Text>
              </View>
            )}

            <Button
              title="Añadir medidas"
              variant="ghost"
              fullWidth
              style={styles.addButton}
              onPress={openModal}
            />
          </Card>

          {/* Personal Records */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Récords personales</Text>
            {workoutsLoading ? (
              <ActivityIndicator style={styles.loading} color={colors.turquesa} />
            ) : records.length > 0 ? (
              <View style={styles.recordsList}>
                {records.map((record) => (
                  <View key={record.id} style={styles.recordRow}>
                    <Text style={styles.recordName}>
                      {record.exercise_library?.name ?? 'Ejercicio'}
                    </Text>
                    <Text style={styles.recordValue}>
                      {Number(record.value_numeric)} {record.unit}
                    </Text>
                    <Text style={styles.recordDate}>
                      {new Date(record.achieved_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noHistory}>
                Sin récords aún — registra entrenamientos con peso y aquí aparecerá tu mejor marca.
              </Text>
            )}
            {workoutsError && <Text style={styles.workoutsError}>{workoutsError}</Text>}
          </Card>

          {/* Workout History */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mis entrenamientos</Text>
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => navigation.navigate('WorkoutLog', {})}
              >
                <Text style={styles.addChipText}>+ Entrenamiento</Text>
              </TouchableOpacity>
            </View>
            {workoutsLoading ? (
              <ActivityIndicator style={styles.loading} color={colors.turquesa} />
            ) : logs.length > 0 ? (
              <View style={styles.historyList}>
                {logs.map((log) => (
                  <WorkoutLogRow
                    key={log.id}
                    log={log}
                    expanded={expandedLogId === log.id}
                    onToggle={() => setExpandedLogId((prev) => (prev === log.id ? null : log.id))}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.noMetrics}>
                <Text style={styles.noMetricsText}>Sin entrenamientos registrados</Text>
                <Text style={styles.noMetricsSubtext}>
                  Toca «+ Entrenamiento» para registrar tu primera sesión.
                </Text>
              </View>
            )}
          </Card>

          {/* Measurements History */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Historial de medidas</Text>
            {measurements.length > 0 ? (
              <View style={styles.historyList}>
                {measurements.slice(0, 10).map((m) => (
                  <HistoryItem key={m.id} measurement={m} onDelete={handleDeleteMeasurement} />
                ))}
              </View>
            ) : (
              <Text style={styles.noHistory}>No hay historial de medidas</Text>
            )}
          </Card>
        </ScrollView>
      )}

      {/* Add Measurement Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar medidas</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Fecha (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.modalDateInput}
              value={selectedDate}
              onChangeText={setSelectedDate}
              placeholder="AAAA-MM-DD"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              placeholderTextColor={colors.textSecondary}
            />

            <ScrollView
              contentContainerStyle={styles.modalMetricsContainer}
              showsVerticalScrollIndicator={false}
            >
              {METRIC_DEFINITIONS.map((def) => (
                <View key={def.name} style={styles.modalMetricRow}>
                  <Text style={styles.modalMetricLabel}>
                    {def.name} ({def.unit})
                  </Text>
                  <TextInput
                    style={styles.modalMetricInput}
                    placeholder={def.placeholder}
                    value={metricInputs[def.name] ?? ''}
                    onChangeText={(value) =>
                      setMetricInputs((prev) => ({ ...prev, [def.name]: value }))
                    }
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button title="Cancelar" variant="ghost" onPress={closeModal} />
              <Button
                title={saving ? 'Guardando...' : 'Guardar'}
                loading={saving}
                onPress={handleAddMeasurement}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Fila del historial: resumen del entrenamiento; al tocarla muestra ejercicios y series. */
function WorkoutLogRow({
  log,
  expanded,
  onToggle,
}: {
  log: WorkoutLogItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const exercises = [...(log.workout_exercises ?? [])].sort(
    (a, b) => a.order_index - b.order_index
  );
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.exercise_sets?.length ?? 0), 0);
  const date = new Date(log.started_at);

  return (
    <TouchableOpacity style={styles.workoutItem} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.workoutItemHeader}>
        <View style={styles.workoutItemInfo}>
          <Text style={styles.workoutItemDate}>
            {date.toLocaleDateString('es-ES', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </Text>
          <Text style={styles.workoutItemMeta}>
            {exercises.length} ejercicio{exercises.length === 1 ? '' : 's'} · {totalSets} serie
            {totalSets === 1 ? '' : 's'}
          </Text>
        </View>
        <Text style={styles.workoutItemChevron}>{expanded ? '▾' : '▸'}</Text>
      </View>

      {log.notes ? <Text style={styles.workoutItemNotes}>{log.notes}</Text> : null}

      {expanded && (
        <View style={styles.workoutDetail}>
          {exercises.map((ex) => {
            const sets = [...(ex.exercise_sets ?? [])].sort((a, b) => a.set_number - b.set_number);
            return (
              <View key={ex.id} style={styles.workoutExercise}>
                <Text style={styles.workoutExerciseName}>
                  {ex.exercise_library?.name ?? ex.custom_name ?? 'Ejercicio'}
                </Text>
                <Text style={styles.workoutExerciseSets}>
                  {sets
                    .map((s) => {
                      const parts: string[] = [];
                      if (s.reps != null) parts.push(`${s.reps} reps`);
                      if (s.weight_kg != null) parts.push(`${Number(s.weight_kg)} kg`);
                      return parts.join(' · ') || '—';
                    })
                    .join('   |   ')}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

function MetricItem({
  label,
  value,
  trend,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
  trend: string | null;
}) {
  const trendColor =
    trend == null || trend === '0'
      ? colors.textSecondary
      : trend.startsWith('-')
        ? '#EF4444'
        : colors.mentaActiva;
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value} {unit}
      </Text>
      <Text style={[styles.metricTrend, { color: trendColor }]}>
        {trend != null ? `${trend} vs anterior` : 'Sin comparativa'}
      </Text>
    </View>
  );
}

function HistoryItem({
  measurement,
  onDelete,
}: {
  measurement: MeasurementWithValues;
  onDelete: (id: string) => void;
}) {
  const date = new Date(measurement.measured_at);
  return (
    <TouchableOpacity style={styles.historyItem} onPress={() => onDelete(measurement.id)}>
      <View style={styles.historyDate}>
        <Text style={styles.historyDay}>{date.getDate()}</Text>
        <Text style={styles.historyMonth}>
          {date.toLocaleDateString('es-ES', { month: 'short' })}
        </Text>
      </View>
      <View style={styles.historyMetrics}>
        {measurement.measurement_values.slice(0, 3).map((mv) => (
          <Text key={mv.id} style={styles.historyMetric}>
            {mv.metric_name}: {Number(mv.value_numeric)}
            {mv.unit ?? ''}
          </Text>
        ))}
      </View>
      <Text style={styles.historyDelete}>Tocar para eliminar</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  errorBox: {
    margin: 16,
    marginBottom: 0,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  errorText: { fontFamily: fonts.uiRegular, fontSize: 13, color: '#EF4444' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontFamily: fonts.brand,
    fontSize: 28,
    color: colors.azulNexo,
    marginBottom: 4,
  },
  statTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
    marginBottom: 2,
  },
  statSubtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  sectionCard: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  sectionSubtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  metricLabel: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  metricValue: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 18,
    color: colors.azulNexo,
  },
  metricTrend: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
  },
  loading: { marginVertical: 24 },
  addButton: { marginTop: 8 },
  noMetrics: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  noMetricsText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  noMetricsSubtext: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  historyList: { gap: 12 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  historyDate: {
    alignItems: 'center',
    backgroundColor: colors.turquesa + '15',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  historyDay: {
    fontFamily: fonts.brand,
    fontSize: 24,
    color: colors.turquesa,
  },
  historyMonth: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: colors.turquesa,
    textTransform: 'uppercase',
  },
  historyMetrics: {
    flex: 1,
    gap: 4,
  },
  historyMetric: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.azulNexo,
  },
  historyDelete: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: '#EF4444',
  },
  noHistory: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: 24,
  },
  // Récords personales
  recordsList: { gap: 8 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  recordName: {
    flex: 1,
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
  },
  recordValue: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.turquesa,
  },
  recordDate: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: '#9CA3AF',
    width: 52,
    textAlign: 'right',
  },
  workoutsError: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#EF4444',
  },
  // Historial de entrenamientos
  workoutItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
    gap: 6,
  },
  workoutItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  workoutItemInfo: { flex: 1, gap: 2 },
  workoutItemDate: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  workoutItemMeta: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  workoutItemChevron: { fontSize: 14, color: '#9CA3AF' },
  workoutItemNotes: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  workoutDetail: {
    gap: 8,
    marginTop: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
  },
  workoutExercise: { gap: 2 },
  workoutExerciseName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
  },
  workoutExerciseSets: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  // Modal styles
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
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  modalClose: { fontSize: 24, color: colors.textSecondary },
  modalLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
    marginBottom: 8,
  },
  modalDateInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.azulNexo + '20',
    color: colors.azulNexo,
    marginBottom: 8,
  },
  modalMetricsContainer: { gap: 12, marginVertical: 8 },
  modalMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalMetricLabel: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.azulNexo,
    width: 120,
  },
  modalMetricInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.azulNexo + '20',
    color: colors.azulNexo,
    width: '60%',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 20,
    color: colors.azulNexo,
  },
  emptyText: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
