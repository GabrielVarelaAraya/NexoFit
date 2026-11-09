import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card, FadeIn, Skeleton, SkeletonScreen } from '../../components/ui';
import { useDashboard, type ActivityItem, type UpcomingClass } from '../../hooks/useAdmin';
import { formatMoney } from '../../hooks/usePayments';
import { toLocalDateStr } from '../../utils/date';
import type { NavigationProp } from '../../types/screens';

export function DashboardScreen({ navigation }: { navigation: NavigationProp }) {
  const { membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const { stats, activity, upcoming, loading, error, refresh } = useDashboard(orgId);
  const [refreshing, setRefreshing] = useState(false);
  const isAdmin = membership?.role === 'admin';

  // Refrescar al volver a la pestaña: los contadores cambian con reservas y altas.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (!orgId) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Dashboard" subtitle="Selecciona una organización" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin organización</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Transición inicial: sin datos aún, un skeleton con la forma del dashboard
  // (antes un spinner a pantalla completa: la página «saltaba» al llegar los datos).
  const initialLoading = loading && stats === null;

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Dashboard"
          subtitle={membership?.role === 'admin' ? 'Administrador' : 'Entrenador'}
        />
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  const safeStats = stats ?? {
    activeMembers: 0,
    newMembersThisMonth: 0,
    sessionsToday: 0,
    occupancy7d: null,
    bookingsThisMonth: 0,
    monthRevenueCents: 0,
    monthRevenueCurrency: null,
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Dashboard"
        subtitle={membership?.role === 'admin' ? 'Administrador' : 'Entrenador'}
      />
      <FadeIn style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.turquesa]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {error && <Text style={styles.error}>{error}</Text>}

          {/* Métricas reales (ingresos = pagos registrados del mes, Stage 5) */}
          {/* 4 KPIs (grid parejo de 2×2; antes la 5.ª quedaba sola) y cada uno
            lleva a su detalle. «Reservas este mes» pasa a dato de apoyo. */}
          <View style={styles.metricsGrid}>
            <MetricCard
              title="Miembros activos"
              value={String(safeStats.activeMembers)}
              change={
                safeStats.newMembersThisMonth > 0
                  ? `+${safeStats.newMembersThisMonth} este mes`
                  : 'Sin altas este mes'
              }
              changePositive={safeStats.newMembersThisMonth > 0}
              icon="people"
              onPress={() => navigation.navigate('Clientes')}
            />
            {isAdmin ? (
              <MetricCard
                title="Ingresos del mes"
                value={formatMoney(safeStats.monthRevenueCents, safeStats.monthRevenueCurrency)}
                icon="cash"
                onPress={() => navigation.navigate('Payments')}
              />
            ) : (
              <MetricCard
                title="Reservas este mes"
                value={String(safeStats.bookingsThisMonth)}
                icon="ticket"
              />
            )}
            <MetricCard
              title="Clases hoy"
              value={String(safeStats.sessionsToday)}
              icon="calendar"
              onPress={() => navigation.navigate('Agenda')}
            />
            <MetricCard
              title="Ocupación media"
              value={safeStats.occupancy7d != null ? `${safeStats.occupancy7d}%` : '—'}
              change={
                safeStats.occupancy7d != null
                  ? `Próximos 7 días · ${safeStats.bookingsThisMonth} reservas este mes`
                  : 'Sin clases programadas'
              }
              icon="stats-chart"
              onPress={() => navigation.navigate('Agenda')}
            />
          </View>

          {/* Quick Actions */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Acciones rápidas</Text>
            <View style={styles.actionsGrid}>
              <ActionButton
                icon="add"
                label="Nueva clase"
                onPress={() =>
                  navigation.navigate('CreateSession', { defaultDate: toLocalDateStr() })
                }
              />
              <ActionButton
                icon="clipboard"
                label="Publicar programa"
                onPress={() => navigation.navigate('PublishProgram')}
              />
              <ActionButton
                icon="notifications"
                label="Enviar notificación"
                onPress={() => navigation.navigate('SendNotification')}
              />
              {/* Pagos es solo admin (RLS): el coach no veía nada al entrar. */}
              {isAdmin && (
                <ActionButton
                  icon="cash"
                  label="Registrar pago"
                  onPress={() => navigation.navigate('Payments')}
                />
              )}
              <ActionButton
                icon="color-palette"
                label="Tipos de clase"
                onPress={() => navigation.navigate('GymContent', { form: 'classType' })}
              />
              <ActionButton
                icon="business"
                label="Sedes y espacios"
                onPress={() => navigation.navigate('GymContent', { form: 'spaces' })}
              />
            </View>
          </Card>

          {/* Recent Activity */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Actividad reciente</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Agenda')}>
                <Text style={styles.seeAll}>Ver agenda</Text>
              </TouchableOpacity>
            </View>
            {activity.length > 0 ? (
              <View style={styles.activityList}>
                {activity.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptySection}>Todavía no hay actividad registrada.</Text>
            )}
          </Card>

          {/* Upcoming Classes */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Próximas clases</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Agenda')}>
                <Text style={styles.seeAll}>Ver agenda</Text>
              </TouchableOpacity>
            </View>
            {upcoming.length > 0 ? (
              <View style={styles.upcomingList}>
                {upcoming.map((cls) => (
                  <UpcomingRow key={cls.id} cls={cls} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptySection}>
                Sin clases programadas. Crea una con «Nueva clase».
              </Text>
            )}
          </Card>
        </ScrollView>
      </FadeIn>
    </SafeAreaView>
  );
}

function MetricCard({
  title,
  value,
  change,
  changePositive,
  icon,
  onPress,
}: {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.metricCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}: ${value}`}
    >
      <View style={styles.metricTop}>
        <Ionicons name={icon} size={24} color={colors.azulNexo} />
        {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      {change !== undefined && (
        <Text
          style={[
            styles.metricChange,
            { color: changePositive ? colors.textSuccess : colors.textSecondary },
          ]}
        >
          {change}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/** Misma estructura que el dashboard real: 4 KPIs, acciones y actividad. */
function DashboardSkeleton() {
  return (
    <SkeletonScreen label="Cargando métricas" style={styles.content}>
      <View style={styles.metricsGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.metricCard}>
            <Skeleton width={24} height={24} radius={6} />
            <Skeleton width="50%" height={26} />
            <Skeleton width="70%" height={12} />
          </View>
        ))}
      </View>
      <Card style={styles.sectionCard}>
        <Skeleton width="40%" height={16} />
        <View style={styles.actionsGrid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.actionBtn}>
              <Skeleton width={36} height={36} radius={18} />
              <Skeleton width="70%" height={12} />
            </View>
          ))}
        </View>
      </Card>
      <Card style={styles.sectionCard}>
        <Skeleton width="45%" height={16} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={skeletonStyles.row}>
            <Skeleton width={22} height={22} radius={11} />
            <View style={skeletonStyles.rowText}>
              <Skeleton width="80%" height={13} />
              <Skeleton width="30%" height={11} />
            </View>
          </View>
        ))}
      </Card>
    </SkeletonScreen>
  );
}

const skeletonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rowText: { flex: 1, gap: 6 },
});

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  // Un solo estilo para todas: el color no comunicaba nada y el ícono en fila
  // cortaba los textos largos en pantallas angostas.
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={styles.actionBtn}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.textAccent} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Colores semánticos para el feed de actividad.
const ACTIVITY_ICON_COLORS: Partial<Record<keyof typeof Ionicons.glyphMap, string>> = {
  'checkmark-circle': colors.success,
  'close-circle': colors.textError ?? colors.danger,
  person: colors.azulNexo,
};

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.activityItem}>
      <Ionicons
        name={item.icon}
        size={20}
        color={ACTIVITY_ICON_COLORS[item.icon] ?? colors.azulNexo}
      />
      <View style={styles.activityContent}>
        <Text style={styles.activityText}>{item.text}</Text>
        <Text style={styles.activityTime}>{item.time}</Text>
      </View>
    </View>
  );
}

function UpcomingRow({ cls }: { cls: UpcomingClass }) {
  return (
    <View style={styles.upcomingItem}>
      <View style={[styles.upcomingColor, { backgroundColor: cls.color }]} />
      <View style={styles.upcomingInfo}>
        <Text style={styles.upcomingName}>{cls.name}</Text>
        <Text style={styles.upcomingMeta}>
          {cls.time} · Coach: {cls.coach} · {cls.spots}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  fill: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  error: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textError,
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricValue: {
    fontFamily: fonts.brand,
    fontSize: 26,
    color: colors.azulNexo,
  },
  metricTitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  metricChange: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
  },
  sectionCard: { gap: 12 },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAll: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textAccent,
  },
  emptySection: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: 8,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textAccent + '14',
  },
  actionLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
    textAlign: 'center',
  },
  activityList: { gap: 12 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  activityContent: { flex: 1, gap: 2 },
  activityText: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.azulNexo,
  },
  activityTime: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  upcomingList: { gap: 12 },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  upcomingColor: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  upcomingInfo: { flex: 1, gap: 2 },
  upcomingName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  upcomingMeta: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
});
