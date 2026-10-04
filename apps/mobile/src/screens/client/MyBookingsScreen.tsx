import { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useBookings, cancelBooking, cancelWaitlistEntry } from '../../hooks/useBooking';
import { Header, Card, Button, LoadingView } from '../../components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import type { BookingWithSession } from '../../types/screens';

type Props = NativeStackScreenProps<MainStackParamList, 'MyBookings'>;

export function MyBookingsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { bookings, loading, error, refresh } = useBookings(user?.id ?? '');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

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
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCancel = (item: BookingWithSession) => {
    const isWaitlisted = item.status === 'waitlist';
    Alert.alert(
      isWaitlisted ? 'Salir de la lista de espera' : 'Cancelar reserva',
      '¿Estás seguro?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(item.id);
            const result = isWaitlisted
              ? await cancelWaitlistEntry(item.id, user?.id ?? '')
              : await cancelBooking(item.id, user?.id ?? '');
            if (result.success) {
              // La lista refresca con transición (≥ MIN_LOADING_MS) y, en
              // paralelo, useSchedule ya recalculó los cupos libres vía eventos.
              await refresh();
            } else {
              Alert.alert('Error', result.error ?? 'No se pudo cancelar.');
            }
            setCancellingId(null);
          },
        },
      ]
    );
  };

  const renderBooking = ({ item }: { item: BookingWithSession }) => {
    const session = item.sessions;
    const classType = session?.class_types;
    const isWaitlisted = item.status === 'waitlist';
    const isPast = session && new Date(session.ends_at) < new Date();
    const badge = isWaitlisted
      ? `Lista #${item.position ?? ''}`
      : item.status === 'attended'
        ? 'Asistida'
        : 'Confirmada';

    return (
      <Card
        title={classType?.name ?? 'Clase'}
        subtitle={`${formatDate(session?.starts_at ?? '')} · ${formatTime(session?.starts_at ?? '')} – ${formatTime(session?.ends_at ?? '')}`}
        badge={badge}
        badgeColor={isWaitlisted ? '#F59E0B' : colors.turquesa}
      >
        {!isPast && (
          <Button
            title={isWaitlisted ? 'Salir de la lista' : 'Cancelar'}
            variant="danger"
            fullWidth
            loading={cancellingId === item.id}
            onPress={() => handleCancel(item)}
          />
        )}
        {isPast && <Text style={styles.pastText}>Clase finalizada</Text>}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Mis reservas"
        subtitle="Próximas sesiones"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" variant="ghost" onPress={() => refresh()} />
        </View>
      )}
      <FlatList
        data={bookings as BookingWithSession[]}
        keyExtractor={(b) => b.id}
        renderItem={renderBooking}
        contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          loading ? (
            <LoadingView label="Cargando tus reservas…" style={styles.center} />
          ) : !error ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Sin reservas</Text>
              <Text style={styles.emptyHint}>Ve a la pestaña Clases para reservar una sesión.</Text>
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
  errorBox: {
    margin: 16,
    marginBottom: 0,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  errorText: { fontFamily: fonts.uiRegular, fontSize: 13, color: '#EF4444' },
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
  pastText: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});
