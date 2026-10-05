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
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card, LoadingView } from '../../components/ui';
import { useDashboard, type ActivityItem, type UpcomingClass } from '../../hooks/useAdmin';
import { formatMoney } from '../../hooks/usePayments';
import { toLocalDateStr } from '../../utils/date';
import type { NavigationProp } from '../../types/screens';

export function DashboardScreen({ navigation }: { navigation: NavigationProp }) {
  const { membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const { stats, activity, upcoming, loading, error, refresh } = useDashboard(orgId);
  const [refreshing, setRefreshing] = useState(false);

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

  // Transición inicial: sin datos aún, spinner a pantalla completa.
  const initialLoading = loading && stats === null;

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Dashboard"
          subtitle={membership?.role === 'admin' ? 'Administrador' : 'Entrenador'}
        />
        <LoadingView label="Cargando métricas…" />
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
        <View style={styles.metricsGrid}>
          <MetricCard
            title="Miembros activos"
            value={String(safeStats.activeMembers)}
            change={
              safeStats.newMembersThisMonth > 0
                ? `+${safeStats.newMembersThisMonth} este mes`
                : undefined
            }
            changePositive
            icon="👥"
          />
          <MetricCard
            title="Ingresos del mes"
            value={formatMoney(safeStats.monthRevenueCents, safeStats.monthRevenueCurrency)}
            icon="💰"
          />
          <MetricCard title="Clases hoy" value={String(safeStats.sessionsToday)} icon="📅" />
          <MetricCard
            title="Ocupación media"
            value={safeStats.occupancy7d != null ? `${safeStats.occupancy7d}%` : '—'}
            change={safeStats.occupancy7d != null ? 'Próximos 7 días' : 'Sin clases programadas'}
            changePositive
            icon="📊"
          />
          <MetricCard
            title="Reservas este mes"
            value={String(safeStats.bookingsThisMonth)}
            icon="🎟️"
          />
        </View>

        {/* Quick Actions */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          <View style={styles.actionsGrid}>
            <ActionButton
              icon="➕"
              label="Nueva clase"
              color={colors.turquesa}
              onPress={() =>
                navigation.navigate('CreateSession', { defaultDate: toLocalDateStr() })
              }
            />
            <ActionButton
              icon="📋"
              label="Publicar programa"
              color={colors.limaProgreso}
              onPress={() => navigation.navigate('PublishProgram')}
            />
            <ActionButton
              icon="🔔"
              label="Enviar notificación"
              color={colors.azulNexo}
              onPress={() => navigation.navigate('SendNotification')}
            />
            <ActionButton
              icon="💰"
              label="Pagos"
              color={colors.mentaActiva}
              onPress={() => navigation.navigate('Payments')}
            />
            <ActionButton
              icon="🎨"
              label="Crear tipo de clase"
              color="#8B5CF6"
              onPress={() => navigation.navigate('GymContent', { form: 'classType' })}
            />
            <ActionButton
              icon="🏟️"
              label="Crear sedes/espacios"
              color="#F59E0B"
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
    </SafeAreaView>
  );
}

function MetricCard({
  title,
  value,
  change,
  changePositive,
  icon,
}: {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      {change !== undefined && (
        <Text
          style={[styles.metricChange, { color: changePositive ? colors.limaProgreso : '#EF4444' }]}
        >
          {change}
        </Text>
      )}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: color + '15' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.actionIcon, { color }]}>{icon}</Text>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.activityItem}>
      <Text style={styles.activityIcon}>{item.icon}</Text>
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
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  error: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#EF4444',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricIcon: { fontSize: 24 },
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
    color: colors.turquesa,
  },
  emptySection: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#9CA3AF',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionIcon: { fontSize: 20 },
  actionLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
  },
  activityList: { gap: 12 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  activityIcon: { fontSize: 20 },
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
