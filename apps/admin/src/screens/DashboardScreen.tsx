import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, formatWeekdayDate } from '@nexofit/core';
import { Card, EmptyState, ErrorText, Skeleton, SkeletonScreen, StatCard } from '../components/ui';
import { useDashboard, type ActivityItem, type UpcomingClass } from '../hooks/useAdminData';
import type { ScreenProps } from '../app/router';
import { dayLabel } from '../utils/date';
import { formatChange, formatMoney, formatRelative, formatTime } from '../utils/format';

// Dashboard con las mismas métricas que la app móvil, comparadas con el mismo
// tramo del mes anterior; cada tarjeta lleva a su listado.
export function DashboardScreen({ organizationId, navigate }: ScreenProps) {
  const { stats, activity, upcoming, loading, error, updatedAt, refresh } =
    useDashboard(organizationId);

  if (loading && stats === null) {
    return <DashboardSkeleton />;
  }

  const s = stats ?? {
    activeMembers: 0,
    newMembersThisMonth: 0,
    sessionsToday: 0,
    occupancy7d: null,
    bookingsThisMonth: 0,
    monthRevenueCents: 0,
    monthCurrency: null,
    prevNewMembers: 0,
    prevBookings: 0,
    prevRevenueCents: 0,
  };

  const revenueChange = formatChange(s.monthRevenueCents, s.prevRevenueCents);
  const bookingsChange = formatChange(s.bookingsThisMonth, s.prevBookings);
  const tone = (current: number, previous: number) =>
    previous <= 0 || current === previous ? 'neutral' : current > previous ? 'good' : 'bad';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Dashboard</Text>
        <View style={styles.refresh}>
          {updatedAt && <Text style={styles.updated}>Actualizado {formatRelative(updatedAt)}</Text>}
          <TouchableOpacity
            onPress={() => void refresh()}
            activeOpacity={0.7}
            disabled={loading}
            accessibilityRole="button"
            style={styles.refreshButton}
          >
            <Text style={styles.refreshText}>{loading ? 'Actualizando…' : '↻ Actualizar'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && <ErrorText>{error}</ErrorText>}

      {/* Mismos nombres y definiciones que en la app móvil. */}
      <View style={styles.statsRow}>
        <StatCard
          label="Miembros activos"
          value={String(s.activeMembers)}
          change={
            s.newMembersThisMonth > 0 ? `+${s.newMembersThisMonth} este mes` : 'Sin altas este mes'
          }
          changeTone={s.newMembersThisMonth > 0 ? 'good' : 'neutral'}
          hint={s.prevNewMembers > 0 ? `${s.prevNewMembers} el mes pasado a esta fecha` : undefined}
          onPress={() => navigate('members')}
        />
        <StatCard
          label="Ingresos del mes"
          value={formatMoney(s.monthRevenueCents, s.monthCurrency)}
          change={revenueChange ? `${revenueChange} vs mes anterior` : null}
          changeTone={tone(s.monthRevenueCents, s.prevRevenueCents)}
          onPress={() => navigate('payments')}
        />
        <StatCard
          label="Clases hoy"
          value={String(s.sessionsToday)}
          onPress={() => navigate('agenda')}
        />
        <StatCard
          label="Ocupación media"
          value={s.occupancy7d != null ? `${s.occupancy7d}%` : '—'}
          hint={s.occupancy7d != null ? 'Próximos 7 días' : 'Sin clases programadas'}
          onPress={() => navigate('agenda')}
        />
        <StatCard
          label="Reservas este mes"
          value={String(s.bookingsThisMonth)}
          change={bookingsChange ? `${bookingsChange} vs mes anterior` : null}
          changeTone={tone(s.bookingsThisMonth, s.prevBookings)}
        />
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Próximas clases</Text>
            <TouchableOpacity accessibilityRole="link" onPress={() => navigate('agenda')}>
              <Text style={styles.link}>Ver agenda →</Text>
            </TouchableOpacity>
          </View>
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

/** Misma forma que el dashboard: 5 KPIs y las columnas de actividad y clases. */
function DashboardSkeleton() {
  return (
    <SkeletonScreen label="Cargando métricas" style={styles.container}>
      <View style={styles.headerRow}>
        <Skeleton width={180} height={30} />
        <Skeleton width={150} height={30} radius={999} />
      </View>
      <View style={styles.statsRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} style={styles.skeletonStat}>
            <Skeleton width="60%" height={12} />
            <Skeleton width="45%" height={28} />
            <Skeleton width="70%" height={11} />
          </Card>
        ))}
      </View>
      <View style={styles.columns}>
        {[0, 1].map((col) => (
          <Card key={col} style={styles.column}>
            <Skeleton width="40%" height={16} />
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.activityRow}>
                <Skeleton width={10} height={10} radius={5} />
                <View style={styles.activityBody}>
                  <Skeleton width="75%" height={13} />
                  <Skeleton width="25%" height={11} />
                </View>
              </View>
            ))}
          </Card>
        ))}
      </View>
    </SkeletonScreen>
  );
}

const ACTIVITY_COLORS: Record<ActivityItem['kind'], string> = {
  booked: colors.success,
  cancelled: colors.textError,
  joined: colors.turquesa,
  payment: colors.azulNexo,
  appointment: '#0EA5E9',
};

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityDot, { backgroundColor: ACTIVITY_COLORS[item.kind] }]} />
      <View style={styles.activityBody}>
        <Text style={styles.activityText}>{item.text}</Text>
        <Text style={styles.activityTime}>{formatRelative(item.iso)}</Text>
      </View>
    </View>
  );
}

function UpcomingRow({ cls }: { cls: UpcomingClass }) {
  // «Hoy 07:00» / «Mañana 18:00» / «jue 12 nov 07:00»: antes solo la hora.
  const day = dayLabel(cls.startsAt) ?? formatWeekdayDate(cls.startsAt);
  return (
    <View style={styles.upcomingRow}>
      <View style={[styles.upcomingBar, { backgroundColor: cls.color }]} />
      <View style={styles.activityBody}>
        <Text style={styles.activityText}>{cls.name}</Text>
        <Text style={styles.activityTime}>
          {day} {formatTime(cls.startsAt)} · Coach: {cls.coach} · {cls.spots} cupos
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  h1: { fontFamily: fonts.brand, fontSize: 26, color: colors.azulNexo },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  updated: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
  refreshButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  refreshText: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.textAccent },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  skeletonStat: { flex: 1, minWidth: 180, gap: 10 },
  columns: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  column: { flex: 1, minWidth: 300, gap: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.azulNexo },
  link: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.textAccent },
  list: { gap: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  activityDot: { width: 10, height: 10, borderRadius: 5 },
  upcomingBar: { width: 4, height: 36, borderRadius: 2 },
  activityBody: { flex: 1, gap: 2 },
  activityText: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.azulNexo },
  activityTime: { fontFamily: fonts.uiRegular, fontSize: 12, color: colors.textSecondary },
});
