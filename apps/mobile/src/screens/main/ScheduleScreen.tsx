import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedule } from '../../hooks/useBooking';
import { Card, Header, Button } from '../../components/ui';
import type { NavigationProp, SessionWithType } from '../../types/screens';

interface Props {
  navigation: NavigationProp;
}

export function ScheduleScreen({ navigation }: Props) {
  const { membership } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const orgId = membership?.organization_id ?? '';
  const { sessions, loading, error, refresh } = useSchedule(orgId, selectedDate);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const num = d.getDate();
    return { day, num };
  };

  const renderSession = ({ item }: { item: SessionWithType }) => {
    const capacity = item.capacity_override ?? item.spaces?.capacity ?? 30;
    const spotsLeft = capacity - (item.booking_count ?? 0);
    const isFull = spotsLeft <= 0;
    const coachName = item.coaches?.memberships?.profiles?.full_name;

    return (
      <Card
        style={styles.sessionCard}
        title={item.class_types?.name ?? 'Class'}
        subtitle={`${formatTime(item.starts_at)} – ${formatTime(item.ends_at)}  ·  ${item.spaces?.venues?.name ?? ''} · ${item.spaces?.name ?? ''}`}
        badge={isFull ? 'Full' : `${spotsLeft} spots`}
        badgeColor={isFull ? '#EF4444' : colors.turquesa}
      >
        {coachName && <Text style={styles.coach}>Coach: {coachName}</Text>}
        <Button
          title={isFull ? 'Join Waitlist' : 'Book Now'}
          variant={isFull ? 'ghost' : 'primary'}
          fullWidth
          onPress={() =>
            navigation.navigate('SessionDetail', {
              sessionId: item.id,
              sessionData: item,
            })
          }
        />
      </Card>
    );
  };

  if (!orgId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No organization</Text>
        <Text style={styles.emptyHint}>Join a gym to view the schedule.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Schedule" subtitle="Book your next session" />

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

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="ghost" onPress={refresh} />
        </View>
      )}

      <FlatList
        data={sessions as SessionWithType[]}
        keyExtractor={(s) => s.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No sessions</Text>
              <Text style={styles.emptyHint}>No classes scheduled for this day.</Text>
            </View>
          ) : null
        }
      />
    </View>
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
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  sessionCard: { gap: 8 },
  coach: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  emptyHint: { fontFamily: fonts.uiRegular, fontSize: 13, color: '#9CA3AF' },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontFamily: fonts.uiRegular, fontSize: 13, color: '#EF4444' },
});
