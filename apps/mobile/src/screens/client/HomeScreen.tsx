import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  colors,
  fonts,
  formatTime,
  formatWeekdayDate as formatDate,
  textStyles,
  useHasLoaded,
} from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useBookings, useSchedule, useRecommendations } from '../../hooks/useBooking';
import { useSettings } from '../../hooks/useProgress';
import { greeting } from '../../utils/greeting';
import { stillAhead } from '../../utils/schedule';
import { formatGymDate, formatGymTime } from '../../utils/appointments';
import { useNextAppointment } from '../../hooks/useNextAppointment';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, FadeIn, Skeleton, SkeletonScreen } from '../../components/ui';
import { getSignupIntent } from '../../utils/signupIntent';
import type { BookingWithSession, SessionWithType, NavigationProp } from '../../types/screens';

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
  const { profile } = useSettings(user?.id ?? '');
  const { next: nextAppointment, refresh: refreshNextAppointment } = useNextAppointment(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  const loading = bookingsLoading || sessionsLoading;
  const hasLoaded = useHasLoaded(loading);

  useFocusEffect(
    useCallback(() => {
      refreshBookings();
      refreshSessions();
      refreshRecommendations();
      void refreshNextAppointment();
    }, [refreshBookings, refreshSessions, refreshRecommendations, refreshNextAppointment])
  );

  const upcomingBookings = (bookings as BookingWithSession[])
    .filter((b) => b.sessions && new Date(b.sessions.starts_at) > new Date())
    .slice(0, 3);
  // Por la tarde «Clases de hoy» mostraba clases de la mañana ya terminadas.
  const todayAhead = stillAhead(todaySessions);

  const isEmpty =
    upcomingBookings.length === 0 && todayAhead.length === 0 && recommended.length === 0;

  if (!orgId) {
    // «Registrar mi gimnasio» es solo del rol de gimnasio (selección de rol
    // → SignUp); el cliente únicamente se inscribe en gimnasios existentes.
    const isGymOwner = getSignupIntent() === 'gym_owner';
    return (
      <View style={styles.container}>
        <Header title="Inicio" subtitle="Empieza eligiendo tu gimnasio" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin gimnasio</Text>
          <Text style={styles.emptyText}>
            {isGymOwner
              ? 'Registra tu gimnasio para empezar a gestionar sus clases, espacios y miembros.'
              : 'Inscríbete en un gimnasio existente para ver clases, reservas y progreso.'}
          </Text>
          {isGymOwner ? (
            <>
              <Button
                title="Registrar mi gimnasio"
                variant="primary"
                fullWidth
                onPress={() => navigation.navigate('CreateGym')}
              />
              <Button
                title="Buscar un gimnasio"
                variant="ghost"
                fullWidth
                onPress={() => navigation.navigate('JoinGym')}
              />
            </>
          ) : (
            <Button
              title="Buscar un gimnasio"
              variant="primary"
              fullWidth
              onPress={() => navigation.navigate('JoinGym')}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Inicio"
        // Sin perfil aún, solo «Hola»: antes mostraba la parte del correo y
        // cambiaba al nombre un instante después (parpadeo).
        subtitle={user && profile ? greeting(profile.full_name, user.email) : 'Hola'}
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
              await Promise.all([
                refreshBookings(),
                refreshSessions(),
                refreshRecommendations(),
                refreshNextAppointment(),
              ]);
              setRefreshing(false);
            }}
            colors={[colors.turquesa]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !hasLoaded && isEmpty ? (
          // Skeleton con la forma de Inicio: accesos rápidos y tarjetas de clases.
          <SkeletonScreen label="Cargando tu actividad" style={styles.section}>
            <View style={styles.shortcuts}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.shortcut}>
                  <Skeleton width={22} height={22} radius={6} />
                  <Skeleton width="70%" height={12} />
                </View>
              ))}
            </View>
            <Skeleton width="45%" height={18} style={styles.skeletonTitle} />
            {[0, 1, 2].map((i) => (
              <Card key={i} style={styles.skeletonCard}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="80%" height={12} />
              </Card>
            ))}
          </SkeletonScreen>
        ) : (
          <FadeIn>
            {/* Resumen: próxima cita y accesos directos a lo que más se hace. */}
            <View style={styles.section}>
              {nextAppointment && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Tu próxima cita: ${nextAppointment.serviceName}, ${formatGymDate(new Date(nextAppointment.startsAt))} a las ${formatGymTime(new Date(nextAppointment.startsAt))}`}
                  style={styles.nextCard}
                  onPress={() => navigation.navigate('Citas')}
                  activeOpacity={0.8}
                >
                  <View style={styles.nextIcon}>
                    <Ionicons name="calendar" size={22} color={colors.limaProgreso} />
                  </View>
                  <View style={styles.nextBody}>
                    <Text style={styles.nextEyebrow}>Tu próxima cita</Text>
                    <Text style={styles.nextTitle}>{nextAppointment.serviceName}</Text>
                    <Text style={styles.nextMeta}>
                      {formatGymDate(new Date(nextAppointment.startsAt))} ·{' '}
                      {formatGymTime(new Date(nextAppointment.startsAt))}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.white} />
                </TouchableOpacity>
              )}
              <View style={styles.shortcuts}>
                {(
                  [
                    { icon: 'barbell-outline', label: 'Reservar clase', to: 'Clases' },
                    { icon: 'calendar-outline', label: 'Reservar cita', to: 'BookAppointment' },
                    { icon: 'trending-up-outline', label: 'Mi progreso', to: 'Progreso' },
                    { icon: 'fitness-outline', label: 'Registrar entrenamiento', to: 'WorkoutLog' },
                  ] as const
                ).map((item) => (
                  <TouchableOpacity
                    key={item.to}
                    accessibilityRole="button"
                    style={styles.shortcut}
                    onPress={() => navigation.navigate(item.to)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={item.icon} size={22} color={colors.textAccent} />
                    <Text style={styles.shortcutText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Upcoming Bookings */}
            {upcomingBookings.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Próximas reservas</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('MyBookings')}
                    accessibilityLabel="Ver todas mis reservas"
                    activeOpacity={0.7}
                  >
                    <Text style={styles.seeAll}>Ver todas</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.bookingsList}>
                  {upcomingBookings.map((booking, index) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={booking.id}
                      onPress={() => navigation.navigate('MyBookings')}
                      accessibilityLabel="Ver mis reservas"
                      activeOpacity={0.7}
                    >
                      <BookingCard booking={booking} index={index} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Today's Sessions */}
            {todayAhead.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Clases de hoy</Text>
                </View>
                <View style={styles.sessionsList}>
                  {todayAhead.map((session) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={session.id}
                      onPress={() =>
                        navigation.navigate('SessionDetail', {
                          sessionId: session.id,
                          sessionData: session,
                        })
                      }
                      accessibilityLabel={`Ver detalle de ${session.class_types?.name ?? 'clase'}`}
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
                      accessibilityRole="button"
                      key={session.id}
                      onPress={() =>
                        navigation.navigate('SessionDetail', {
                          sessionId: session.id,
                          sessionData: session,
                        })
                      }
                      accessibilityLabel={`Ver detalle de ${session.class_types?.name ?? 'clase'}`}
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
          </FadeIn>
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
      badgeColor={isWaitlisted ? colors.warning : colors.turquesa}
      chevron
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
      badgeColor={isFull ? colors.danger : isNearlyFull ? colors.warning : colors.turquesa}
      chevron
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
    color: colors.textAccent,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.azulNexo,
    marginTop: 16,
    marginBottom: 12,
  },
  nextIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white + '1A',
  },
  nextBody: { flex: 1, gap: 2 },
  nextEyebrow: { ...textStyles.caption, color: colors.white + 'B3' },
  nextTitle: { ...textStyles.title, color: colors.white },
  nextMeta: { ...textStyles.body, color: colors.white + 'E6' },
  // Cuadrícula de 2×2: con 4 accesos en una fila los textos largos no caben.
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  skeletonTitle: { marginTop: 24, marginBottom: 12 },
  skeletonCard: { gap: 8, marginBottom: 12 },
  shortcut: {
    flexGrow: 1,
    flexBasis: '47%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutText: { ...textStyles.label, color: colors.azulNexo, textAlign: 'center' },
  bookingsList: { gap: 12 },
  sessionsList: { gap: 12 },
  cardWithMargin: { marginTop: 0 },
  sessionCard: { gap: 8 },
  coach: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
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
