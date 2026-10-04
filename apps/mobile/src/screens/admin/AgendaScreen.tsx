import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card } from '../../components/ui';

interface Session {
  id: string;
  class_name: string;
  start_at: string;
  end_at: string;
  coach_name: string;
  venue_name: string;
  space_name: string;
  capacity: number;
  booked: number;
  status: string;
}

export function AgendaScreen() {
  const { membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    // TODO: Replace with actual Supabase query
    await new Promise((r) => setTimeout(r, 500));
    setSessions(mockSessions);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
    }, [fetchSessions])
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const num = d.getDate();
    return { day, num };
  };

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const renderSession = ({ item }: { item: Session }) => {
    const occupancy = `${item.booked}/${item.capacity}`;
    const pct = Math.round((item.booked / item.capacity) * 100);

    return (
      <Card style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionTime}>
            <Text style={styles.sessionTimeText}>
              {formatTime(item.start_at)} – {formatTime(item.end_at)}
            </Text>
            <Text style={styles.sessionClass}>{item.class_name}</Text>
          </View>
          <View style={styles.sessionMeta}>
            <Text style={styles.sessionCoach}>Coach: {item.coach_name}</Text>
            <Text style={styles.sessionLocation}>
              {item.venue_name} · {item.space_name}
            </Text>
          </View>
        </View>
        <View style={styles.sessionFooter}>
          <View style={styles.occupancy}>
            <View
              style={[
                styles.occupancyBar,
                { width: `${pct}%`, backgroundColor: pct >= 90 ? '#EF4444' : colors.turquesa },
              ]}
            />
          </View>
          <Text style={styles.occupancyText}>
            {occupancy} ({pct}%)
          </Text>
        </View>
      </Card>
    );
  };

  if (!orgId) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Agenda" subtitle="Selecciona una organización" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin organización</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Agenda" subtitle="Gestiona tus clases" />

      {/* Date Selector */}
      <FlatList
        data={dates}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateBar}
        keyExtractor={(d) => d}
        renderItem={({ item: dateStr }) => {
          const { day, num } = formatDateLabel(dateStr);
          const isSelected = dateStr === selectedDate;
          return (
            <TouchableOpacity
              style={[styles.dateItem, isSelected && styles.dateItemActive]}
              onPress={() => setSelectedDate(dateStr)}
            >
              <Text style={[styles.dateDay, isSelected && styles.dateDayActive]}>{day}</Text>
              <Text style={[styles.dateNum, isSelected && styles.dateNumActive]}>{num}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Sessions List */}
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSessions} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Sin clases programadas</Text>
              <Text style={styles.emptyHint}>Crea una nueva clase para este día.</Text>
            </View>
          ) : null
        }
      />

      {/* FAB for new class */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => Alert.alert('Crear clase', 'Funcionalidad próximamente')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const mockSessions: Session[] = [
  {
    id: '1',
    class_name: 'CrossFit WOD',
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    coach_name: 'Carlos Ruiz',
    venue_name: 'Nexo Training',
    space_name: 'Sala Principal',
    capacity: 20,
    booked: 15,
    status: 'scheduled',
  },
  {
    id: '2',
    class_name: 'Yoga Vinyasa',
    start_at: new Date(Date.now() + 7200000).toISOString(),
    end_at: new Date(Date.now() + 10800000).toISOString(),
    coach_name: 'Laura Martín',
    venue_name: 'Nexo Training',
    space_name: 'Sala Zen',
    capacity: 15,
    booked: 8,
    status: 'scheduled',
  },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  dateBar: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  dateItem: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  dateItemActive: { backgroundColor: colors.turquesa },
  dateDay: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  dateDayActive: { color: colors.crema },
  dateNum: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 18,
    color: colors.azulNexo,
  },
  dateNumActive: { color: colors.crema },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },
  sessionCard: { gap: 12 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sessionTime: { gap: 4 },
  sessionTimeText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  sessionClass: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#6B7280',
  },
  sessionMeta: { gap: 2, alignItems: 'flex-end' },
  sessionCoach: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#9CA3AF',
  },
  sessionLocation: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: '#9CA3AF',
  },
  sessionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  occupancy: {
    flex: 1,
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  occupancyBar: { height: '100%', borderRadius: 3 },
  occupancyText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
    marginLeft: 12,
    minWidth: 80,
    textAlign: 'right',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  emptyHint: { fontFamily: fonts.uiRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.turquesa,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.turquesa,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontFamily: fonts.brand, fontSize: 28, color: colors.white },
});
