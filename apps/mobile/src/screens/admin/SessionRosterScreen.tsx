import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fonts,
  formatTime,
  formatWeekdayDate,
  getSupabase,
  shouldShowSkeleton,
  useHasLoaded,
} from '@nexofit/core';
import { Badge, EmptyState, Header, RowListSkeleton, withFadeIn } from '../../components/ui';
import type { MainStackParamList } from '../../navigation/types';
import { caughtError } from '../../utils/errors';
import { notify } from '../../utils/alerts';
import {
  canTakeAttendance,
  fetchRoster,
  rosterSummary,
  setBookingAttendance,
  sortRoster,
  type RosterEntry,
} from '../../utils/roster';

type Props = NativeStackScreenProps<MainStackParamList, 'SessionRoster'>;

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Reservó', color: colors.turquesa },
  attended: { label: 'Asistió', color: colors.success },
  no_show: { label: 'No vino', color: colors.warning },
  cancelled: { label: 'Canceló', color: colors.danger },
};

/** Detalle de una clase para el staff: quién reservó y pasar lista. */
export function SessionRosterScreen({ route, navigation }: Props) {
  const { sessionId, title, startsAt, endsAt, capacity } = route.params;
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useHasLoaded(loading);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(sortRoster(await fetchRoster(getSupabase(), sessionId)));
    } catch (cause) {
      setError(caughtError(cause, 'No se pudo cargar la lista de la clase.'));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const mark = async (entry: RosterEntry, status: 'confirmed' | 'attended' | 'no_show') => {
    if (pendingId) return;
    setPendingId(entry.bookingId);
    try {
      await setBookingAttendance(getSupabase(), entry.bookingId, status);
      // Actualización local: no hace falta recargar toda la lista.
      setEntries((current) =>
        sortRoster(
          current.map((item) => (item.bookingId === entry.bookingId ? { ...item, status } : item))
        )
      );
    } catch (cause) {
      notify(caughtError(cause, 'Inténtalo de nuevo.'), 'No se pudo actualizar');
    } finally {
      setPendingId(null);
    }
  };

  const summary = rosterSummary(entries);
  const attendanceOpen = canTakeAttendance(startsAt);

  const renderEntry = ({ item }: { item: RosterEntry }) => {
    const badge = STATUS_BADGE[item.status] ?? { label: item.status, color: colors.textMuted };
    const busy = pendingId === item.bookingId;
    const cancelled = item.status === 'cancelled';
    return (
      <View style={[styles.row, cancelled && styles.rowMuted]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.fullName ?? '?').trim().charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.fullName ?? 'Sin nombre'}</Text>
          <Badge label={badge.label} color={badge.color} />
        </View>
        {attendanceOpen && !cancelled && (
          <View style={styles.actions}>
            {item.status === 'confirmed' ? (
              <>
                <AttendanceButton
                  icon="checkmark"
                  label={`Marcar asistencia de ${item.fullName ?? 'miembro'}`}
                  tone="success"
                  disabled={busy}
                  onPress={() => void mark(item, 'attended')}
                />
                <AttendanceButton
                  icon="close"
                  label={`Marcar que ${item.fullName ?? 'el miembro'} no vino`}
                  tone="warning"
                  disabled={busy}
                  onPress={() => void mark(item, 'no_show')}
                />
              </>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Deshacer marca de ${item.fullName ?? 'miembro'}`}
                disabled={busy}
                onPress={() => void mark(item, 'confirmed')}
                hitSlop={8}
              >
                <Text style={styles.undo}>Deshacer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={title}
        subtitle={`${formatWeekdayDate(startsAt)} · ${formatTime(startsAt)} – ${formatTime(endsAt)}`}
        leftAction={{ label: 'Agenda', onPress: () => navigation.goBack() }}
      />
      <View style={styles.summary}>
        <SummaryItem label="Reservas" value={`${summary.active}/${capacity}`} />
        <SummaryItem label="Asistieron" value={String(summary.attended)} />
        <SummaryItem label="Por marcar" value={String(summary.pending)} />
        <SummaryItem label="No vinieron" value={String(summary.noShow)} />
      </View>
      {!attendanceOpen && entries.length > 0 && (
        <Text style={styles.note}>
          Podrás pasar lista 15 minutos antes de que empiece la clase.
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={entries}
        keyExtractor={(item) => item.bookingId}
        renderItem={withFadeIn(renderEntry)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          shouldShowSkeleton(loading, hasLoaded) ? (
            <RowListSkeleton label="Cargando la lista" count={4} flush />
          ) : error ? null : (
            <EmptyState
              icon="people-outline"
              title="Nadie ha reservado todavía"
              message="Las reservas de los miembros aparecerán aquí."
            />
          )
        }
      />
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function AttendanceButton({
  icon,
  label,
  tone,
  disabled,
  onPress,
}: {
  icon: 'checkmark' | 'close';
  label: string;
  tone: 'success' | 'warning';
  disabled: boolean;
  onPress: () => void;
}) {
  const color = tone === 'success' ? colors.textSuccess : colors.textWarning;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.attendanceButton, { borderColor: color }, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  summary: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  summaryLabel: { fontFamily: fonts.uiRegular, fontSize: 11, color: colors.textSecondary },
  note: {
    marginHorizontal: 16,
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  error: {
    marginHorizontal: 16,
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textError,
  },
  list: { padding: 16, gap: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMuted: { opacity: 0.6 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.turquesa + '20',
  },
  avatarText: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.textAccent },
  info: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.azulNexo },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attendanceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.4 },
  undo: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.textAccent },
});
