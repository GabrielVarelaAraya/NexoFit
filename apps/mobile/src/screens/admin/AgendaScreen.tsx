import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, type SessionPublic } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedule } from '../../hooks/useBooking';
import { Header, Card } from '../../components/ui';
import { toLocalDateStr } from '../../utils/date';
import type { NavigationProp } from '../../types/screens';

interface AgendaSession {
  id: string;
  class_name: string;
  start_at: string;
  end_at: string;
  coach_name: string;
  venue_name: string;
  space_name: string;
  capacity: number;
  booked: number;
}

/** Proyecta SessionPublic (useSchedule) a lo que pinta la tarjeta de agenda. */
function toAgendaSession(s: SessionPublic): AgendaSession {
  return {
    id: s.id,
    class_name: s.class_types?.name ?? 'Clase',
    start_at: s.starts_at,
    end_at: s.ends_at,
    coach_name: s.coaches?.memberships?.profiles?.full_name ?? 'Sin coach',
    venue_name: s.spaces?.venues?.name ?? '',
    space_name: s.spaces?.name ?? '—',
    capacity: s.capacity_override ?? s.spaces?.capacity ?? 0,
    booked: s.booking_count ?? 0,
  };
}

export function AgendaScreen({ navigation }: { navigation: NavigationProp }) {
  const { membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr());

  // Mismo motor que la agenda del miembro: sesiones reales + cupos por RPC.
  const { sessions: rawSessions, loading, error, refresh } = useSchedule(orgId, selectedDate);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const sessions = rawSessions.map(toAgendaSession);

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

  // Fechas en zona LOCAL: toISOString().split('T')[0] (UTC) cambiaba de día
  // por la tarde en horos negativos.
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return toLocalDateStr(d);
  });

  const renderSession = ({ item }: { item: AgendaSession }) => {
    const capacity = Math.max(item.capacity, 0);
    const pct = capacity > 0 ? Math.round((item.booked / capacity) * 100) : 0;
    const location = item.venue_name ? `${item.venue_name} · ${item.space_name}` : item.space_name;

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
            <Text style={styles.sessionLocation}>{location}</Text>
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
            {item.booked}/{capacity} ({pct}%)
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.turquesa} />
              <Text style={styles.emptyHint}>Cargando clases…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No se pudo cargar</Text>
              <Text style={styles.emptyHint}>{error}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Sin clases programadas</Text>
              <Text style={styles.emptyHint}>Toca «+» para crear una clase este día.</Text>
            </View>
          )
        }
      />

      {/* FAB for new class */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateSession', { defaultDate: selectedDate })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

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
