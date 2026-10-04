import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedule, useBookings } from '../../hooks/useBooking';
import { Header, Card, Button, LoadingView } from '../../components/ui';
import { toLocalDateStr } from '../../utils/date';
import type { NavigationProp, SessionWithType } from '../../types/screens';

interface Props {
  navigation: NavigationProp;
}

export function ScheduleScreen({ navigation }: Props) {
  const { user, membership } = useAuth();
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr());
  const orgId = membership?.organization_id ?? '';
  const { sessions, loading, error, refresh } = useSchedule(orgId, selectedDate);
  const { bookings, refresh: refreshBookings } = useBookings(user?.id ?? '');

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshBookings();
    }, [refresh, refreshBookings])
  );

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return toLocalDateStr(d);
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const num = d.getDate();
    return { day, num };
  };

  // Estado de MIS reservas por sesión: si ya reservó, no mostrar "Reservar".
  const myStatusBySession = new Map<string, string>(
    bookings.map((b): [string, string] => [b.session_id, b.status])
  );

  const renderSession = ({ item }: { item: SessionWithType }) => {
    const capacity = item.capacity_override ?? item.spaces?.capacity ?? 30;
    const spotsLeft = capacity - (item.booking_count ?? 0);
    const isFull = spotsLeft <= 0;
    const coachName = item.coaches?.memberships?.profiles?.full_name;

    const myStatus = myStatusBySession.get(item.id);
    const isBooked = myStatus === 'confirmed' || myStatus === 'attended';
    const isWaiting = myStatus === 'waitlist';

    const buttonTitle = isBooked
      ? 'Ya reservada'
      : isWaiting
        ? 'En lista de espera'
        : isFull
          ? 'Lista de espera'
          : 'Reservar';
    const buttonVariant = isBooked || isWaiting || isFull ? 'ghost' : 'primary';

    return (
      <Card
        style={styles.sessionCard}
        title={item.class_types?.name ?? 'Clase'}
        subtitle={`${formatTime(item.starts_at)} – ${formatTime(item.ends_at)}  ·  ${item.spaces?.venues?.name ?? ''} · ${item.spaces?.name ?? ''}`}
        badge={isFull ? 'Completo' : `${spotsLeft} cupos`}
        badgeColor={isFull ? '#EF4444' : colors.turquesa}
      >
        {coachName && <Text style={styles.coach}>Coach: {coachName}</Text>}
        <Button
          title={buttonTitle}
          variant={buttonVariant}
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
      <View style={styles.container}>
        <Header title="Clases" subtitle="Empieza eligiendo tu gimnasio" />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Sin gimnasio</Text>
          <Text style={styles.emptyHint}>
            Inscríbete en un gimnasio o registra el tuyo para ver las clases.
          </Text>
          <Button
            title="Buscar un gimnasio"
            variant="primary"
            fullWidth
            style={styles.joinButton}
            onPress={() => navigation.navigate('JoinGym')}
          />
          <Button
            title="Registrar mi gimnasio"
            variant="ghost"
            fullWidth
            style={styles.joinButton}
            onPress={() => navigation.navigate('CreateGym')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Clases" subtitle="Reserva tu próxima sesión" />

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
          <Button title="Reintentar" variant="ghost" onPress={refresh} />
        </View>
      )}

      {loading ? (
        <LoadingView label="Cargando clases…" />
      ) : (
        <FlatList
          data={sessions as SessionWithType[]}
          keyExtractor={(s) => s.id}
          renderItem={renderSession}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            !error ? (
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>Sin clases</Text>
                <Text style={styles.emptyHint}>No hay clases programadas para este día.</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  dateBar: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 12, gap: 8 },
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  joinButton: { marginTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
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
