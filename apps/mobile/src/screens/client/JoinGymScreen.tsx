import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Card, Button, LoadingView } from '../../components/ui';
import { holdLoading } from '../../utils/loading';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'JoinGym'>;

type Gym = { id: string; name: string; slug: string };

export function JoinGymScreen({ navigation }: Props) {
  const { user, refreshMembership } = useAuth();
  const insets = useSafeAreaInsets();

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetchGyms = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: fetchErr } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .order('name');

      if (fetchErr) {
        setError(fetchErr.message);
        setGyms([]);
      } else {
        setGyms(data ?? []);
      }
    } finally {
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGyms();
  }, [fetchGyms]);

  const handleJoin = async (gym: Gym) => {
    if (!user?.id || joiningId) return;
    setJoiningId(gym.id);

    const supabase = getSupabase();
    const { error: insertErr } = await supabase.from('memberships').insert({
      organization_id: gym.id,
      profile_id: user.id,
      role: 'member',
    });

    // 23505 = UNIQUE(organization_id, profile_id): ya era miembro → éxito.
    if (insertErr && insertErr.code !== '23505') {
      setJoiningId(null);
      Alert.alert('Error', insertErr.message);
      return;
    }

    await refreshMembership();
    setJoiningId(null);
    Alert.alert('¡Inscripción completa!', `Ya eres miembro de ${gym.name}.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const term = search.trim().toLowerCase();
  const filtered = term
    ? gyms.filter((g) => g.name.toLowerCase().includes(term) || g.slug.includes(term))
    : gyms;

  const renderGym = ({ item }: { item: Gym }) => (
    <Card title={item.name} subtitle={`/${item.slug}`}>
      <Button
        title="Unirme a este gimnasio"
        variant="primary"
        fullWidth
        loading={joiningId === item.id}
        disabled={joiningId !== null}
        onPress={() => handleJoin(item)}
      />
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Buscar gimnasio"
        subtitle="Elige el gimnasio al que quieres inscribirte"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nombre…"
        placeholderTextColor="#9CA3AF"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" variant="ghost" onPress={fetchGyms} />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(g) => g.id}
        renderItem={renderGym}
        contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <LoadingView label="Buscando gimnasios…" style={styles.loading} />
          ) : !error ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>
                {term ? 'Sin resultados' : 'Aún no hay gimnasios'}
              </Text>
              <Text style={styles.emptyHint}>
                {term
                  ? 'Prueba con otro término de búsqueda.'
                  : 'Ningún gimnasio está registrado todavía. Si representas uno, créalo desde Inicio.'}
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
  searchInput: {
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    color: colors.azulNexo,
  },
  list: { padding: 16, gap: 12 },
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
  loading: { marginTop: 40 },
  center: { alignItems: 'center', paddingTop: 40, gap: 6 },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 16, color: colors.azulNexo },
  emptyHint: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
