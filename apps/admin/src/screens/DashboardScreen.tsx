import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { Card, EmptyState, ErrorText, LoadingView, StatCard } from '../components/ui';
import { useDashboard, type ActivityItem, type UpcomingClass } from '../hooks/useAdminData';
import { formatMoney } from '../utils/format';

// Dashboard con las mismas métricas reales que la app móvil.
export function DashboardScreen({ organizationId }: { organizationId: string }) {
  const { stats, activity, upcoming, loading, error, refresh } = useDashboard(organizationId);

  if (loading && stats === null) {
    return <LoadingView label="Cargando métricas…" />;
  }

  const safeStats = stats ?? {
    activeMembers: 0,
    newMembersThisMonth: 0,
    sessionsToday: 0,
    occupancy7d: null,
    bookingsThisMonth: 0,
    monthRevenueCents: 0,
    monthCurrency: null,
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Dashboard</Text>
        <TouchableOpacity onPress={() => void refresh()} activeOpacity={0.7}>
          <Text style={styles.refreshHint}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      {error && <ErrorText>{error}</ErrorText>}

      {/* Métricas reales */}
      <View style={styles.statsRow}>
        <StatCard
          label="Miembros registrados"
          value={String(safeStats.activeMembers)}
          hint={
            safeStats.newMembersThisMonth > 0
              ? `+${safeStats.newMembersThisMonth} este mes`
              : 'Sin altas este mes'
          }
        />
        <StatCard
          label="Ingresos del mes"
          value={formatMoney(safeStats.monthRevenueCents, safeStats.monthCurrency)}
        />
        <StatCard label="Clases hoy" value={String(safeStats.sessionsToday)} />
        <StatCard
          label="Ocupación (7 días)"
          value={safeStats.occupancy7d != null ? `${safeStats.occupancy7d}%` : '—'}
          hint={safeStats.occupancy7d != null ? 'Próximos 7 días' : 'Sin clases programadas'}
        />
        <StatCard label="Reservas este mes" value={String(safeStats.bookingsThisMonth)} />
      </View>

      <View style={styles.columns}>
        <Card style={styles.column}>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          {activity.length > 0 ? (
            <View style={styles.list}>
              {activity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </View>
          ) : (
            <EmptyState title="Todavía no hay actividad registrada." />
          )}
        </Card>

        <Card style={styles.column}>
          <Text style={styles.sectionTitle}>Próximas clases</Text>
          {upcoming.length > 0 ? (
            <View style={styles.list}>
              {upcoming.map((cls) => (
                <UpcomingRow key={cls.id} cls={cls} />
              ))}
            </View>
          ) : (
            <EmptyState
              title="Sin clases programadas."
              subtitle="Crea clases desde la app móvil con «Nueva clase»."
            />
          )}
        </Card>
      </View>
    </View>
  );
}

const ACTIVITY_COLORS: Record<ActivityItem['kind'], string> = {
  booked: colors.success,
  cancelled: colors.textError,
  joined: colors.turquesa,
};

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityDot, { backgroundColor: ACTIVITY_COLORS[item.kind] }]} />
      <View style={styles.activityBody}>
        <Text style={styles.activityText}>{item.text}</Text>
        <Text style={styles.activityTime}>
          {new Date(item.iso).toLocaleString('es-CR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

function UpcomingRow({ cls }: { cls: UpcomingClass }) {
  return (
    <View style={styles.upcomingRow}>
      <View style={[styles.upcomingBar, { backgroundColor: cls.color }]} />
      <View style={styles.activityBody}>
        <Text style={styles.activityText}>{cls.name}</Text>
        <Text style={styles.activityTime}>
          {cls.time} · Coach: {cls.coach} · {cls.spots} cupos
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  h1: { fontFamily: fonts.brand, fontSize: 26, color: colors.azulNexo },
  refreshHint: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.textAccent,
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  columns: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  column: { flex: 1, minWidth: 360, gap: 16 },
  sectionTitle: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.azulNexo },
  list: { gap: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  activityDot: { width: 10, height: 10, borderRadius: 5 },
  upcomingBar: { width: 4, height: 36, borderRadius: 2 },
  activityBody: { flex: 1, gap: 2 },
  activityText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.azulNexo },
  activityTime: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
});
