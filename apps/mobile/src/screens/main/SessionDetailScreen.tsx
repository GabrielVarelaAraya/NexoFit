import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { bookSession } from '../../hooks/useBooking';
import { Header, Button, Card } from '../../components/ui';
import type { SessionWithType } from '../../types/screens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type SessionDetailParamList = {
  Main: undefined;
  SessionDetail: { sessionId: string; sessionData: SessionWithType };
};

type Props = NativeStackScreenProps<SessionDetailParamList, 'SessionDetail'>;

export function SessionDetailScreen({ route, navigation }: Props) {
  const { sessionData } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const spotsLeft = (sessionData.capacity_override ?? 30) - (sessionData.booking_count ?? 0);
  const isFull = spotsLeft <= 0;

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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleBook = async () => {
    if (!user) return;
    setLoading(true);
    const result = await bookSession(sessionData.id, user.id);
    setLoading(false);

    if (result.success) {
      Alert.alert(
        result.position ? 'Waitlisted' : 'Booked!',
        result.position ? `You're #${result.position} on the waitlist.` : 'Your spot is confirmed.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Error', result.error ?? 'Something went wrong.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Session Details"
        leftAction={{ label: '← Back', onPress: () => navigation.goBack() }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emojiBanner}>
          <Text style={styles.emoji}>{sessionData.class_types?.emoji ?? '🏋️'}</Text>
        </View>

        <Text style={styles.className}>{sessionData.class_types?.name ?? 'Class'}</Text>
        <Text style={styles.dateTime}>{formatDate(sessionData.start_at)}</Text>
        <Text style={styles.timeRange}>
          {formatTime(sessionData.start_at)} – {formatTime(sessionData.end_at)}
        </Text>

        <Card style={styles.infoCard}>
          <InfoRow
            label="Location"
            value={`${sessionData.venues?.name ?? ''} · ${sessionData.spaces?.name ?? ''}`}
          />
          {sessionData.profiles && <InfoRow label="Coach" value={sessionData.profiles.full_name} />}
          <InfoRow
            label="Capacity"
            value={isFull ? 'Full' : `${spotsLeft} spots available`}
            valueColor={isFull ? '#EF4444' : colors.turquesa}
          />
        </Card>

        {sessionData.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notes}>{sessionData.notes}</Text>
          </Card>
        )}

        <Button
          title={isFull ? 'Join Waitlist' : 'Book This Session'}
          variant={isFull ? 'ghost' : 'primary'}
          fullWidth
          loading={loading}
          onPress={handleBook}
        />
      </ScrollView>
    </View>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: { fontFamily: fonts.uiRegular, fontSize: 14, color: '#6B7280' },
  value: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  emojiBanner: {
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.turquesa + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 40 },
  className: {
    fontFamily: fonts.brand,
    fontSize: 24,
    color: colors.azulNexo,
  },
  dateTime: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: '#6B7280',
  },
  timeRange: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.turquesa,
  },
  infoCard: { gap: 0 },
  notesCard: { gap: 4 },
  notesLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
  },
  notes: { fontFamily: fonts.uiRegular, fontSize: 14, color: '#374151' },
});
