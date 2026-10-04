import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { bookSession } from '../../hooks/useBooking';
import { holdLoading } from '../../utils/loading';
import { Header, Button, Card } from '../../components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'SessionDetail'>;

export function SessionDetailScreen({ route, navigation }: Props) {
  const { sessionData } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [liveBookings, setLiveBookings] = useState<number | null>(null);
  const [ownBooking, setOwnBooking] = useState<{
    status: 'confirmed' | 'waitlist';
    position?: number;
  } | null>(null);
  const insets = useSafeAreaInsets();

  // Refrescar cupos al entrar: el booking_count de route.params es un
  // snapshot de cuando se listó la clase y puede estar desactualizado.
  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .rpc('get_session_capacity', { p_session_id: sessionData.id })
      .then(({ data, error }) => {
        const payload = data as { current_bookings?: number } | null;
        if (!cancelled && !error && payload && typeof payload.current_bookings === 'number') {
          setLiveBookings(payload.current_bookings);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionData.id]);

  // Estado propio del usuario en esta clase (reserva confirmada o lista de
  // espera) para no ofrecer "Reservar" a quien ya reservó.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const supabase = getSupabase();
    Promise.all([
      supabase
        .from('bookings')
        .select('status')
        .eq('session_id', sessionData.id)
        .eq('profile_id', user.id)
        .maybeSingle(),
      supabase
        .from('waitlist_positions')
        .select('position')
        .eq('session_id', sessionData.id)
        .eq('profile_id', user.id)
        .maybeSingle(),
    ]).then(([booking, waitlist]) => {
      if (cancelled) return;
      if (booking.data?.status === 'confirmed') {
        setOwnBooking({ status: 'confirmed' });
      } else if (waitlist.data) {
        setOwnBooking({ status: 'waitlist', position: waitlist.data.position });
      } else {
        setOwnBooking(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionData.id, user?.id]);

  const capacity = sessionData.capacity_override ?? sessionData.spaces?.capacity ?? 30;
  const bookingCount = liveBookings ?? sessionData.booking_count ?? 0;
  const spotsLeft = capacity - bookingCount;
  const isFull = spotsLeft <= 0;
  const isPast = new Date(sessionData.ends_at) < new Date();
  const coachName = sessionData.coaches?.memberships?.profiles?.full_name;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleBook = async () => {
    if (!user) return;
    const startedAt = Date.now();
    setLoading(true);
    const result = await bookSession(sessionData.id, user.id);
    // Transición suave: el spinner del botón se mantiene visible al menos
    // MIN_LOADING_MS antes de mostrar el resultado (delay intencional de UX).
    await holdLoading(startedAt);
    setLoading(false);

    if (result.success) {
      Alert.alert(
        result.position ? 'En lista de espera' : '¡Reservado!',
        result.position ? `Eres el #${result.position} en la lista.` : 'Tu plaza está confirmada.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Error', result.error ?? 'Algo salió mal.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Detalle de clase"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
        <View style={styles.emojiBanner}>
          <Text style={styles.emoji}>🏋️</Text>
        </View>

        <Text style={styles.className}>{sessionData.class_types?.name ?? 'Clase'}</Text>
        <Text style={styles.dateTime}>{formatDate(sessionData.starts_at)}</Text>
        <Text style={styles.timeRange}>
          {formatTime(sessionData.starts_at)} – {formatTime(sessionData.ends_at)}
        </Text>

        <Card style={styles.infoCard}>
          <InfoRow
            label="Ubicación"
            value={`${sessionData.spaces?.venues?.name ?? ''} · ${sessionData.spaces?.name ?? ''}`}
          />
          {coachName && <InfoRow label="Coach" value={coachName} />}
          <InfoRow
            label="Capacidad"
            value={
              isPast ? 'Clase finalizada' : isFull ? 'Completo' : `${spotsLeft} cupos disponibles`
            }
            valueColor={isPast ? '#9CA3AF' : isFull ? '#EF4444' : colors.turquesa}
          />
          {ownBooking && !isPast && (
            <InfoRow
              label="Tu estado"
              value={
                ownBooking.status === 'confirmed'
                  ? 'Reserva confirmada'
                  : `En lista de espera (#${ownBooking.position ?? '—'})`
              }
              valueColor={ownBooking.status === 'confirmed' ? colors.turquesa : '#F59E0B'}
            />
          )}
        </Card>

        <Button
          title={
            isPast
              ? 'Clase finalizada'
              : ownBooking?.status === 'confirmed'
                ? 'Ya reservada'
                : ownBooking?.status === 'waitlist'
                  ? 'Ya en lista de espera'
                  : isFull
                    ? 'Unirse a lista de espera'
                    : 'Reservar esta clase'
          }
          variant={isFull && !isPast && !ownBooking ? 'ghost' : 'primary'}
          fullWidth
          loading={loading}
          disabled={isPast || !!ownBooking}
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
