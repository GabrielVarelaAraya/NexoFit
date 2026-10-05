import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useBookings, useSchedule, useRecommendations } from '../../hooks/useBooking';
import { Header, Card, Button, LoadingView } from '../../components/ui';
import type { BookingWithSession, SessionWithType, NavigationProp } from '../../types/screens';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function HomeScreen({ navigation }: { navigation: NavigationProp }) {
  const { user, membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const {
    bookings,
    loading: bookingsLoading,
    refresh: refreshBookings,
  } = useBookings(user?.id ?? '');
  const {
    sessions: todaySessions,
    loading: sessionsLoading,
    refresh: refreshSessions,
  } = useSchedule(orgId, undefined);
  // Stage 5 · inteligencia: clases de tus tipos favoritos sin reservar aún.
  const {
    sessions: recommended,
    loading: recommendationsLoading,
    refresh: refreshRecommendations,
  } = useRecommendations(orgId, user?.id ?? '');
  const [refreshing, setRefreshing] = useState(false);

  const loading = bookingsLoading || sessionsLoading;

  useFocusEffect(
    useCallback(() => {
      refreshBookings();
      refreshSessions();
      refreshRecommendations();
    }, [refreshBookings, refreshSessions, refreshRecommendations])
  );

  const upcomingBookings = (bookings as BookingWithSession[])
    .filter((b) => b.sessions && new Date(b.sessions.starts_at) > new Date())
    .slice(0, 3);

  const isEmpty =
    upcomingBookings.length === 0 && todaySessions.length === 0 && recommended.length === 0;

  if (!orgId) {
    return (
      <View style={styles.container}>
        <Header title="Inicio" subtitle="Empieza eligiendo tu gimnasio" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin gimnasio</Text>
          <Text style={styles.emptyText}>
            Inscríbete en un gimnasio existente o registra el tuyo para ver clases, reservas y
            progreso.
          </Text>
          <Button
            title="Buscar un gimnasio"
            variant="primary"
            fullWidth
            onPress={() => navigation.navigate('JoinGym')}
          />
          <Button
            title="Registrar mi gimnasio"
            variant="ghost"
            fullWidth
            onPress={() => navigation.navigate('CreateGym')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Inicio"
        subtitle={user ? `Hola, ${user.email?.split('@')[0]}` : 'Bienvenido'}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isEmpty && !loading && styles.scrollContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([refreshBookings(), refreshSessions(), refreshRecommendations()]);
              setRefreshing(false);
            }}
            colors={[colors.turquesa]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && isEmpty ? (
          <LoadingView label="Cargando tu actividad…" style={styles.emptyState} />
        ) : (
          <>
            {/* Upcoming Bookings */}
            {upcomingBookings.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Próximas reservas</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('MyBookings')}>
                    <Text style={styles.seeAll}>Ver todas</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.bookingsList}>
                  {upcomingBookings.map((booking, index) => (
                    <TouchableOpacity
                      key={booking.id}
                      onPress={() => navigation.navigate('MyBookings')}
                      activeOpacity={0.7}
                    >
                      <BookingCard booking={booking} index={index} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Today's Sessions */}
            {todaySessions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Clases de hoy</Text>
                </View>
                <View style={styles.sessionsList}>
                  {todaySessions.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      onPress={() =>
                        navigation.navigate('SessionDetail', {
                          sessionId: session.id,
                          sessionData: session,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <SessionCard session={session} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Recomendaciones (Stage 5): solo si hay historial y algo nuevo */}
            {!recommendationsLoading && recommended.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recomendadas para ti</Text>
                </View>
                <View style={styles.sessionsList}>
                  {recommended.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      onPress={() =>
                        navigation.navigate('SessionDetail', {
                          sessionId: session.id,
                          sessionData: session,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <SessionCard session={session} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {isEmpty && !recommendationsLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Sin actividad reciente</Text>
                <Text style={styles.emptyText}>
                  Reserva tu primera clase o espera a que comiencen las de hoy.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function BookingCard({ booking, index }: { booking: BookingWithSession; index: number }) {
  const session = booking.sessions;
  const classType = session?.class_types;
  const isWaitlisted = booking.status === 'waitlist';

  return (
    <Card
      style={index > 0 ? styles.cardWithMargin : {}}
      title={classType?.name ?? 'Clase'}
      subtitle={`${formatDate(session?.starts_at ?? '')} · ${formatTime(session?.starts_at ?? '')} – ${formatTime(session?.ends_at ?? '')}`}
      badge={isWaitlisted ? `Lista #${booking.position ?? ''}` : 'Confirmada'}
      badgeColor={isWaitlisted ? '#F59E0B' : colors.turquesa}
    />
  );
}

function SessionCard({ session }: { session: SessionWithType }) {
  const capacity = session.capacity_override ?? session.spaces?.capacity ?? 30;
  const spotsLeft = capacity - (session.booking_count ?? 0);
  const isFull = spotsLeft <= 0;
  // Stage 5 · inteligencia: avisa cuando queda un cuarto o menos de cupos.
  const isNearlyFull = !isFull && capacity > 0 && spotsLeft / capacity <= 0.25;
  const coachName = session.coaches?.memberships?.profiles?.full_name;

  return (
    <Card
      style={styles.sessionCard}
      title={session.class_types?.name ?? 'Clase'}
      subtitle={`${formatTime(session.starts_at)} – ${formatTime(session.ends_at)} · ${session.spaces?.venues?.name ?? ''} · ${session.spaces?.name ?? ''}`}
      badge={
        isFull
          ? 'Completo'
          : isNearlyFull
            ? `¡Casi lleno! · ${spotsLeft} ${spotsLeft === 1 ? 'cupo' : 'cupos'}`
            : `${spotsLeft} cupos`
      }
      badgeColor={isFull ? '#EF4444' : isNearlyFull ? '#F59E0B' : colors.turquesa}
    >
      {coachName && <Text style={styles.coach}>Coach: {coachName}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  scrollContent: { paddingBottom: 24 },
  scrollContentEmpty: { flexGrow: 1 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 18,
    color: colors.azulNexo,
  },
  seeAll: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.turquesa,
  },
  bookingsList: { gap: 12 },
  sessionsList: { gap: 12 },
  cardWithMargin: { marginTop: 0 },
  sessionCard: { gap: 8 },
  coach: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 20,
    color: colors.azulNexo,
  },
  emptyText: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyBookings: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  emptyBookingsText: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptySessions: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptySessionsText: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
