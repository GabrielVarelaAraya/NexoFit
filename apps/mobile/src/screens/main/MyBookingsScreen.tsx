import { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useBookings, cancelBooking } from '../../hooks/useBooking';
import { Card, Header, Button } from '../../components/ui';
import type { BookingWithSession } from '../../types/screens';

export function MyBookingsScreen() {
  const { user } = useAuth();
  const { bookings, loading, refresh } = useBookings(user?.id ?? '');

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCancel = (bookingId: string) => {
    Alert.alert('Cancel Booking', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          const result = await cancelBooking(bookingId);
          if (result.success) {
            refresh();
          } else {
            Alert.alert('Error', result.error ?? 'Could not cancel.');
          }
        },
      },
    ]);
  };

  const renderBooking = ({ item }: { item: BookingWithSession }) => {
    const session = item.sessions;
    const classType = session?.class_types;
    const isWaitlisted = item.status === 'waitlist';

    return (
      <Card
        title={`${classType?.emoji ?? ''} ${classType?.name ?? 'Class'}`}
        subtitle={`${formatDate(session?.start_at ?? '')} · ${formatTime(session?.start_at ?? '')} – ${formatTime(session?.end_at ?? '')}`}
        badge={isWaitlisted ? `Waitlist #${item.position ?? ''}` : 'Confirmed'}
        badgeColor={isWaitlisted ? '#F59E0B' : colors.turquesa}
      >
        <Button title="Cancel" variant="danger" fullWidth onPress={() => handleCancel(item.id)} />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="My Bookings" subtitle="Upcoming sessions" />
      <FlatList
        data={bookings as BookingWithSession[]}
        keyExtractor={(b) => b.id}
        renderItem={renderBooking}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptyHint}>Head to the Schedule tab to book a session.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  list: { padding: 16, gap: 12, paddingBottom: 24 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 80,
  },
  emptyTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  emptyHint: { fontFamily: fonts.uiRegular, fontSize: 13, color: '#9CA3AF' },
});
