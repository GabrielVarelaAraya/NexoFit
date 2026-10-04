import { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card, Button, LoadingView } from '../../components/ui';
import { holdLoading } from '../../utils/loading';

interface Appointment {
  id: string;
  service_name: string;
  professional_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

export function AppointmentsScreen() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Próximas primero (más cercana arriba), después las pasadas (más reciente arriba).
  const sortedAppointments = useMemo(() => {
    const now = Date.now();
    return [...appointments].sort((a, b) => {
      const aPast = new Date(a.ends_at).getTime() < now;
      const bPast = new Date(b.ends_at).getTime() < now;
      if (aPast !== bPast) return aPast ? 1 : -1;
      const diff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      return aPast ? -diff : diff;
    });
  }, [appointments]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const fetchAppointments = useCallback(async () => {
    const startedAt = Date.now();
    if (!user?.id) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: fetchErr } = await supabase
        .from('appointments')
        .select(
          `
        id,
        starts_at,
        ends_at,
        status,
        services ( name ),
        professionals ( memberships ( profiles ( full_name ) ) )
      `
        )
        .eq('profile_id', user.id)
        .order('starts_at', { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        setAppointments([]);
      } else {
        setAppointments(
          (data ?? []).map((a) => ({
            id: a.id,
            starts_at: a.starts_at,
            ends_at: a.ends_at,
            status: a.status,
            service_name: a.services?.name ?? 'Servicio',
            professional_name: a.professionals?.memberships?.profiles?.full_name ?? 'Profesional',
          }))
        );
      }
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [fetchAppointments])
  );

  const handleCancel = (id: string) => {
    Alert.alert('Cancelar cita', '¿Estás seguro?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(id);
          const supabase = getSupabase();
          const { error: cancelErr } = await supabase
            .from('appointments')
            .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
            .eq('id', id)
            .eq('profile_id', user?.id ?? '')
            .neq('status', 'cancelled');
          setCancellingId(null);

          if (cancelErr) {
            Alert.alert('Error', cancelErr.message);
          } else {
            fetchAppointments();
          }
        },
      },
    ]);
  };

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const isPast = new Date(item.ends_at) < new Date();
    const isCancelled = item.status === 'cancelled';

    return (
      <Card
        title={item.service_name}
        subtitle={`${formatDate(item.starts_at)} · ${formatTime(item.starts_at)} – ${formatTime(item.ends_at)}`}
        badge={isCancelled ? 'Cancelada' : isPast ? 'Finalizada' : 'Confirmada'}
        badgeColor={isCancelled ? '#EF4444' : isPast ? '#9CA3AF' : colors.turquesa}
      >
        <Text style={styles.professional}>Profesional: {item.professional_name}</Text>
        {!isPast && !isCancelled && (
          <Button
            title="Cancelar cita"
            variant="danger"
            fullWidth
            disabled={cancellingId === item.id}
            loading={cancellingId === item.id}
            onPress={() => handleCancel(item.id)}
          />
        )}
        {isCancelled && <Text style={styles.pastText}>Cita cancelada</Text>}
        {isPast && !isCancelled && <Text style={styles.pastText}>Cita finalizada</Text>}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Citas" subtitle="Tus citas 1-a-1" />
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" variant="ghost" onPress={fetchAppointments} />
        </View>
      )}
      <FlatList
        data={sortedAppointments}
        keyExtractor={(a) => a.id}
        renderItem={renderAppointment}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAppointments} />}
        ListEmptyComponent={
          loading ? (
            <LoadingView label="Cargando tus citas…" style={styles.center} />
          ) : !error ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Sin citas</Text>
              <Text style={styles.emptyHint}>
                Cuando reserves una sesión 1-a-1 con un profesional, aparecerá aquí.
              </Text>
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
    gap: 12,
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 18,
    color: colors.azulNexo,
  },
  emptyHint: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  professional: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  pastText: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  errorText: { fontFamily: fonts.uiRegular, fontSize: 13, color: '#EF4444' },
});
