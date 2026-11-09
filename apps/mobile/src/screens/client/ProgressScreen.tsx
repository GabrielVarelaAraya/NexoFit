import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  TextInput,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  colors,
  fonts,
  formatDate,
  formatDayMonth,
  formatMonthShort,
  formatWeekdayDate,
  shouldShowSkeleton,
  textStyles,
  useHasLoaded,
} from '@nexofit/core';
import { Sparkline } from '../../components/ui';
import { METRIC_DIRECTION, formatDelta, metricSeries, seriesTrend } from '../../utils/progress';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card, Button, FadeIn, Skeleton, SkeletonScreen } from '../../components/ui';
import { useBodyMetrics, type MeasurementWithValues } from '../../hooks/useProgress';
import { deleteWorkout, useWorkouts } from '../../hooks/useWorkout';
import { copyExercisesFromLog } from '../../utils/workoutCopy';
import { toLocalDateStr } from '../../utils/date';
import { confirmAction, notify } from '../../utils/alerts';
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

// Dirección en la que un cambio cuenta como mejora. Bajar peso, grasa o
// cintura es avanzar; subir masa muscular también. Sin esta guía, el rojo/verde
// invertía el mensaje (p. ej. «Peso −4.0 vs anterior» en rojo justo cuando
// bajar es el objetivo). Las métricas ambiguas (Cadera, Pecho…) van en neutro.
const LOWER_IS_BETTER = new Set(['Peso', 'Grasa corporal', 'Cintura']);
const HIGHER_IS_BETTER = new Set(['Masa muscular']);

function trendColorFor(label: string, trend: string | null): string {
  if (trend == null || trend === '0') return colors.textSecondary;
  const isDown = trend.startsWith('-');
  if (LOWER_IS_BETTER.has(label)) return isDown ? colors.textSuccess : colors.textError;
  if (HIGHER_IS_BETTER.has(label)) return isDown ? colors.textError : colors.textSuccess;
  return colors.textSecondary;
}

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
  // Skeleton solo mientras NO haya habido una primera carga. Antes se decidía
  // por «no hay datos» y, al volver a la pestaña, los bloques internos
  // (medidas, récords, entrenamientos) parpadeaban sobre datos ya cargados.
  const bodyLoaded = useHasLoaded(loading);
  const workoutsLoaded = useHasLoaded(workoutsLoading);
  const initialLoading =
    (shouldShowSkeleton(loading, bodyLoaded) && !error) ||
    (shouldShowSkeleton(workoutsLoading, workoutsLoaded) && !workoutsError);

  const findTrend = (name: string) => {
    const current = latestMetrics.find((m) => m.name === name)?.value;
    const previous = previousMetrics.find((m) => m.name === name)?.value;
    if (current == null || previous == null) return null;
    const delta = current - previous;
    if (delta === 0) return '0';
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
  };

  const handleCopyWorkout = (log: WorkoutLogItem) => {
    const copyFrom = copyExercisesFromLog(log);
    if (copyFrom.length === 0) {
      notify('Este entrenamiento no tiene series para copiar.', 'No se pudo copiar');
      return;
    }
    navigation.navigate('WorkoutLog', { copyFrom });
  };

  const handleDeleteWorkout = (log: WorkoutLogItem) => {
    confirmAction({
      title: 'Eliminar entrenamiento',
      message: `Se borrará el entrenamiento del ${formatWeekdayDate(new Date(log.started_at))} con sus ejercicios y series. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        const result = await deleteWorkout(log.id);
        if (!result.success) {
          notify(result.error ?? 'No se pudo eliminar el entrenamiento.', 'Error');
          return;
        }
        setExpandedLogId(null);
        await refreshWorkouts();
        notify('Entrenamiento eliminado.', 'Listo');
      },
    });
  };

  const handleAddMeasurement = async () => {
    if (!DATE_REGEX.test(selectedDate) || Number.isNaN(Date.parse(selectedDate))) {
      notify('Fecha no válida. Usa el formato AAAA-MM-DD', 'Error');
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
      notify('Ingresa al menos una medida', 'Error');
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
      notify(result.error ?? 'No se pudo guardar', 'Error');
    }
  };

  const handleDeleteMeasurement = (id: string) => {
    confirmAction({
      title: 'Eliminar medición',
      message: 'Se borrarán todas las medidas de ese día. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        const result = await deleteMeasurement(id);
        if (!result.success) {
          notify(result.error ?? 'No se pudo eliminar', 'Error');
        }
      },
    });
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
        <ProgressSkeleton />
      ) : (
        <FadeIn style={styles.fill}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Evolución: tendencia de las medidas clave (antes 4 tarjetas que
              repetían los valores de «Medidas corporales»). */}
            {measurements.length > 0 && (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Evolución</Text>
                <Text style={styles.sectionSubtitle}>
                  {measurements.length === 1
                    ? 'Registra otra medición para ver tu tendencia.'
                    : `Últimas ${Math.min(measurements.length, 8)} mediciones`}
                </Text>
                {TREND_METRICS.map((name) => (
                  <TrendRow
                    key={name}
                    name={name}
                    unit={METRIC_DEFINITIONS.find((m) => m.name === name)?.unit ?? ''}
                    series={metricSeries(measurements, name)}
                  />
                ))}
              </Card>
            )}

            {/* Body Metrics */}
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Medidas corporales</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.addChip}
                  onPress={openModal}
                  accessibilityLabel="Añadir medida"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.addChipText}>+ Añadir</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>
                Última actualización:{' '}
                {measurements[0]?.measured_at
                  ? formatDate(measurements[0].measured_at)
                  : 'Sin datos'}
              </Text>

              {shouldShowSkeleton(loading, bodyLoaded) ? (
                <MetricsGridSkeleton />
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
            </Card>

            {/* Personal Records */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Récords personales</Text>
              {shouldShowSkeleton(workoutsLoading, workoutsLoaded) ? (
                <RowsSkeleton rows={2} />
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
                      <Text style={styles.recordDate}>{formatDayMonth(record.achieved_at)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noHistory}>
                  Sin récords aún — registra entrenamientos con peso y aquí aparecerá tu mejor
                  marca.
                </Text>
              )}
              {workoutsError && <Text style={styles.workoutsError}>{workoutsError}</Text>}
            </Card>

            {/* Workout History */}
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Mis entrenamientos</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.addChip}
                  onPress={() => navigation.navigate('WorkoutLog', {})}
                  accessibilityLabel="Registrar entrenamiento"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.addChipText}>+ Entrenamiento</Text>
                </TouchableOpacity>
              </View>
              {shouldShowSkeleton(workoutsLoading, workoutsLoaded) ? (
                <RowsSkeleton rows={2} />
              ) : logs.length > 0 ? (
                <View style={styles.historyList}>
                  {logs.map((log) => (
                    <WorkoutLogRow
                      key={log.id}
                      log={log}
                      expanded={expandedLogId === log.id}
                      onToggle={() => setExpandedLogId((prev) => (prev === log.id ? null : log.id))}
                      onCopy={() => handleCopyWorkout(log)}
                      onDelete={() => handleDeleteWorkout(log)}
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
        </FadeIn>
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
              <TouchableOpacity
                accessibilityRole="button"
                onPress={closeModal}
                accessibilityLabel="Cerrar"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Todo el contenido (incluidas las acciones) vive dentro del
                scroll: con el teclado abierto el botón Guardar sigue
                alcanzable, sin KeyboardAvoidingView. */}
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalLabel}>Fecha (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.modalDateInput}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="AAAA-MM-DD"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                placeholderTextColor={colors.textPlaceholder}
                autoCorrect={false}
              />

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
                    placeholderTextColor={colors.textPlaceholder}
                  />
                </View>
              ))}

              <View style={styles.modalActions}>
                <Button title="Cancelar" variant="ghost" onPress={closeModal} />
                <Button
                  title={saving ? 'Guardando...' : 'Guardar'}
                  loading={saving}
                  onPress={handleAddMeasurement}
                />
              </View>
            </ScrollView>
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
  onCopy,
  onDelete,
}: {
  log: WorkoutLogItem;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const exercises = [...(log.workout_exercises ?? [])].sort(
    (a, b) => a.order_index - b.order_index
  );
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.exercise_sets?.length ?? 0), 0);
  const date = new Date(log.started_at);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={styles.workoutItem}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityLabel="Expandir o colapsar entrenamiento"
    >
      <View style={styles.workoutItemHeader}>
        <View style={styles.workoutItemInfo}>
          <Text style={styles.workoutItemDate}>{formatWeekdayDate(date)}</Text>
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
          <View style={styles.workoutActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Copiar este entrenamiento"
              style={styles.workoutAction}
              onPress={onCopy}
              hitSlop={8}
            >
              <Ionicons name="copy-outline" size={16} color={colors.textAccent} />
              <Text style={styles.workoutActionText}>Copiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Eliminar este entrenamiento"
              style={styles.workoutAction}
              onPress={onDelete}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color={colors.textError} />
              <Text style={[styles.workoutActionText, styles.workoutActionDanger]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Cuadrícula 2×3 de medidas mientras cargan (dentro de «Medidas corporales»). */
function MetricsGridSkeleton() {
  return (
    <View style={skeletonStyles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={skeletonStyles.metric}>
          <Skeleton width="40%" height={11} />
          <Skeleton width="60%" height={20} />
          <Skeleton width="50%" height={11} />
        </View>
      ))}
    </View>
  );
}

/** Filas simples de listas (récords, entrenamientos) mientras cargan. */
function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <View style={skeletonStyles.rows}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={skeletonStyles.row}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="20%" height={14} />
        </View>
      ))}
    </View>
  );
}

/** Misma forma que Progreso: Evolución, Medidas, Récords y Entrenamientos. */
function ProgressSkeleton() {
  return (
    <SkeletonScreen label="Cargando tu progreso" style={styles.content}>
      <Card style={styles.sectionCard}>
        <Skeleton width="35%" height={16} />
        <Skeleton width="50%" height={12} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={skeletonStyles.trend}>
            <View style={skeletonStyles.trendText}>
              <Skeleton width="30%" height={11} />
              <Skeleton width="45%" height={22} />
              <Skeleton width="60%" height={12} />
            </View>
            <Skeleton width={72} height={36} radius={6} />
          </View>
        ))}
      </Card>
      <Card style={styles.sectionCard}>
        <Skeleton width="50%" height={16} />
        <MetricsGridSkeleton />
      </Card>
      <Card style={styles.sectionCard}>
        <Skeleton width="40%" height={16} />
        <RowsSkeleton rows={2} />
      </Card>
    </SkeletonScreen>
  );
}

const skeletonStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  metric: {
    width: '47%',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  rows: { gap: 12, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  trendText: { flex: 1, gap: 6 },
});

const TREND_METRICS = ['Peso', 'Grasa corporal', 'Masa muscular'] as const;

const TONE_COLORS = {
  good: colors.textSuccess,
  bad: colors.textError,
  neutral: colors.textSecondary,
} as const;

function TrendRow({ name, unit, series }: { name: string; unit: string; series: number[] }) {
  if (series.length === 0) return null;
  const current = series[series.length - 1];
  const trend = seriesTrend(series, METRIC_DIRECTION[name] ?? 'neutral');
  const toneColor = trend ? TONE_COLORS[trend.tone] : colors.textSecondary;

  return (
    <View style={styles.trendRow}>
      <View style={styles.trendInfo}>
        <Text style={styles.trendLabel}>{name}</Text>
        <Text style={styles.trendValue}>
          {current} <Text style={styles.trendUnit}>{unit}</Text>
        </Text>
        <Text style={[styles.trendDelta, { color: toneColor }]}>
          {trend ? `${formatDelta(trend.delta)} ${unit} en el periodo` : 'Sin comparativa'}
        </Text>
      </View>
      <Sparkline
        values={series}
        color={trend?.tone === 'bad' ? colors.textError : colors.textAccent}
        accessibilityLabel={`${name}: ${series.join(', ')} ${unit}`}
      />
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
  const trendColor = trendColorFor(label, trend);
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
  const dateLabel = formatDate(date);
  // La fila es informativa; borrar es una acción explícita (ícono de papelera),
  // no un toque en cualquier parte de la fila.
  return (
    <View style={styles.historyItem}>
      <View style={styles.historyDate}>
        <Text style={styles.historyDay}>{date.getDate()}</Text>
        <Text style={styles.historyMonth}>{formatMonthShort(date)}</Text>
      </View>
      <View style={styles.historyMetrics}>
        {measurement.measurement_values.slice(0, 3).map((mv) => (
          <Text key={mv.id} style={styles.historyMetric}>
            {mv.metric_name}: {Number(mv.value_numeric)}
            {mv.unit ?? ''}
          </Text>
        ))}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Eliminar medición del ${dateLabel}`}
        style={styles.historyDelete}
        onPress={() => onDelete(measurement.id)}
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  fill: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  errorBox: {
    margin: 16,
    marginBottom: 0,
    padding: 12,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    gap: 8,
  },
  errorText: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textError },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  trendInfo: { flex: 1, gap: 2 },
  trendLabel: { ...textStyles.caption, color: colors.textSecondary },
  trendValue: { fontFamily: fonts.brand, fontSize: 22, lineHeight: 28, color: colors.azulNexo },
  trendUnit: { ...textStyles.body, color: colors.textSecondary },
  trendDelta: { ...textStyles.label },
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
    backgroundColor: colors.textAccent,
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  metricLabel: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
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
    borderBottomColor: colors.surfaceSubtle,
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
    color: colors.textAccent,
  },
  historyMonth: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: colors.textAccent,
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
  // Ícono neutro (no rojo en cada fila); el aviso destructivo vive en la confirmación.
  historyDelete: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.surfaceMuted,
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
    color: colors.textAccent,
  },
  recordDate: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: colors.textSecondary,
    width: 52,
    textAlign: 'right',
  },
  workoutsError: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textError,
  },
  // Historial de entrenamientos
  workoutItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
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
  workoutItemChevron: { fontSize: 14, color: colors.textSecondary },
  workoutItemNotes: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  workoutDetail: {
    gap: 8,
    marginTop: 4,
    backgroundColor: colors.surfaceMuted,
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
  workoutActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  workoutAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  workoutActionText: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.textAccent },
  workoutActionDanger: { color: colors.textError },
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
  modalScrollContent: { gap: 12, paddingBottom: 4 },
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
