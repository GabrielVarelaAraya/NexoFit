import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card } from '../../components/ui';

export function DashboardScreen() {
  const { membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
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
        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <MetricCard
            title="Miembros activos"
            value="247"
            change="+12 este mes"
            changePositive
            icon="👥"
          />
          <MetricCard title="Clases hoy" value="8" change="3 completadas" icon="📅" />
          <MetricCard
            title="Ocupación media"
            value="78%"
            change="+5% vs semana pasada"
            changePositive
            icon="📊"
          />
          <MetricCard
            title="Ingresos mes"
            value="€12,450"
            change="+18% vs mes anterior"
            changePositive
            icon="💰"
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
              onPress={() => {}}
            />
            <ActionButton
              icon="👤"
              label="Nuevo miembro"
              color={colors.mentaActiva}
              onPress={() => {}}
            />
            <ActionButton
              icon="📋"
              label="Crear programa"
              color={colors.limaProgreso}
              onPress={() => {}}
            />
            <ActionButton
              icon="🔔"
              label="Enviar notificación"
              color={colors.azulNexo}
              onPress={() => {}}
            />
          </View>
        </Card>

        {/* Recent Activity */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Actividad reciente</Text>
            <Text style={styles.seeAll}>Ver todo</Text>
          </View>
          <View style={styles.activityList}>
            {recentActivity.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </View>
        </Card>

        {/* Upcoming Classes */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Próximas clases</Text>
            <Text style={styles.seeAll}>Ver agenda</Text>
          </View>
          <View style={styles.upcomingList}>
            {upcomingClasses.map((cls) => (
              <UpcomingClass key={cls.id} cls={cls} />
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const recentActivity = [
  {
    id: '1',
    type: 'booking',
    text: 'María García reservó "CrossFit WOD"',
    time: 'hace 5 min',
    icon: '✅',
  },
  { id: '2', type: 'member', text: 'Nuevo miembro: Carlos López', time: 'hace 12 min', icon: '👤' },
  {
    id: '3',
    type: 'cancel',
    text: 'Juan Pérez canceló "Yoga Matutino"',
    time: 'hace 28 min',
    icon: '❌',
  },
  {
    id: '4',
    type: 'waitlist',
    text: 'Ana Martín promovida de lista de espera',
    time: 'hace 1 h',
    icon: '⬆️',
  },
];

const upcomingClasses = [
  {
    id: '1',
    name: 'CrossFit WOD',
    time: '07:00',
    coach: 'Carlos R.',
    spots: '12/20',
    color: '#EF4444',
  },
  {
    id: '2',
    name: 'Yoga Vinyasa',
    time: '09:30',
    coach: 'Laura M.',
    spots: '8/15',
    color: '#8B5CF6',
  },
  {
    id: '3',
    name: 'Funcional',
    time: '12:00',
    coach: 'Pedro G.',
    spots: '15/20',
    color: '#06B6D4',
  },
  {
    id: '4',
    name: 'HIIT Cardio',
    time: '18:30',
    coach: 'Sara K.',
    spots: '5/15',
    color: '#F59E0B',
  },
];

function MetricCard({
  title,
  value,
  change,
  changePositive,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  changePositive?: boolean;
  icon: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text
        style={[styles.metricChange, { color: changePositive ? colors.limaProgreso : '#EF4444' }]}
      >
        {change}
      </Text>
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

function ActivityItem({ item }: { item: (typeof recentActivity)[0] }) {
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

function UpcomingClass({ cls }: { cls: (typeof upcomingClasses)[0] }) {
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
