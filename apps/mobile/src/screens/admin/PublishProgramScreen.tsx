import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Button, Card, Input } from '../../components/ui';
import { holdLoading } from '../../utils/loading';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'PublishProgram'>;

interface SessionOption {
  id: string;
  label: string;
  /** id del programa existente, si el coach ya publicó uno para esta sesión. */
  programId: string | null;
}

const SESSION_SELECT = `
  id,
  starts_at,
  class_types!inner ( name )
`;

export function PublishProgramScreen({ navigation }: Props) {
  const { user, membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    const load = async () => {
      const startedAt = Date.now();
      setLoading(true);
      setLoadError(null);

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .eq('class_types.organization_id', orgId)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(12);

      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        setSessions([]);
        await holdLoading(startedAt);
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      const sessionIds = rows.map((s) => s.id);

      // Programas ya publicados para esas sesiones (para actualizar en vez de duplicar).
      const { data: programs } = await supabase
        .from('workout_programs')
        .select('id, session_id')
        .in('session_id', sessionIds);

      if (cancelled) return;

      const programBySession = new Map((programs ?? []).map((p) => [p.session_id, p.id]));

      const options: SessionOption[] = rows.map((s) => {
        const startsAt = new Date(s.starts_at);
        return {
          id: s.id,
          label: `${s.class_types?.name ?? 'Clase'} · ${startsAt.toLocaleDateString('es-ES', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })} ${startsAt.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}`,
          programId: programBySession.get(s.id) ?? null,
        };
      });

      setSessions(options);
      setSelectedSessionId((prev) => prev ?? options[0]?.id ?? null);

      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const handlePublish = async () => {
    const trimmed = content.trim();
    if (!selectedSessionId) {
      Alert.alert('Faltan datos', 'Selecciona la clase para la que quieres publicar.');
      return;
    }
    if (trimmed.length < 10) {
      Alert.alert(
        'Contenido muy corto',
        'Escribe el entrenamiento completo (mínimo 10 caracteres).'
      );
      return;
    }
    if (!user?.id) return;

    const existing = sessions.find((s) => s.id === selectedSessionId)?.programId ?? null;

    setPublishing(true);
    const supabase = getSupabase();
    const { error } = existing
      ? await supabase.from('workout_programs').update({ content: trimmed }).eq('id', existing)
      : await supabase.from('workout_programs').insert({
          session_id: selectedSessionId,
          content: trimmed,
          published_by: user.id,
        });
    setPublishing(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert(
      'Programa publicado',
      'Los miembros ya ven el entrenamiento en el detalle de la clase.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Programa de entreno"
        subtitle="Publica el WOD de una clase"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Selector de clase */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Clase</Text>
          {loading ? (
            <ActivityIndicator style={styles.loading} color={colors.turquesa} />
          ) : loadError ? (
            <Text style={styles.loadError}>{loadError}</Text>
          ) : sessions.length === 0 ? (
            <Text style={styles.hint}>
              No hay clases programadas a futuro. Crea una primero desde la Agenda.
            </Text>
          ) : (
            sessions.map((s) => {
              const isSelected = s.id === selectedSessionId;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sessionRow, isSelected && styles.sessionRowActive]}
                  onPress={() => setSelectedSessionId(s.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]} />
                  <Text style={[styles.sessionLabel, isSelected && styles.sessionLabelActive]}>
                    {s.label}
                  </Text>
                  {s.programId && <Text style={styles.publishedBadge}>Publicado</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </Card>

        {/* Contenido */}
        <Card style={styles.sectionCard}>
          <Input
            label="Entrenamiento"
            value={content}
            onChangeText={setContent}
            placeholder={'Warm-up\n• 500 m remo\n\nWOD\n• 5 rondas: …'}
            multiline
            numberOfLines={8}
            style={styles.contentInput}
          />
          <Text style={styles.hint}>
            Se muestra tal cual a tus miembros en «Entrenamiento de la sesión».
          </Text>
        </Card>

        <Button
          title="Publicar programa"
          fullWidth
          loading={publishing}
          disabled={loading || sessions.length === 0}
          onPress={handlePublish}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16 },
  sectionCard: { gap: 10 },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  loading: { marginTop: 8, marginBottom: 8 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: colors.white,
  },
  sessionRowActive: {
    borderColor: colors.turquesa,
    backgroundColor: colors.turquesa + '10',
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  radioSelected: {
    borderColor: colors.turquesa,
    backgroundColor: colors.turquesa,
  },
  sessionLabel: {
    flex: 1,
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.azulNexo,
  },
  sessionLabelActive: { fontFamily: fonts.uiSemiBold },
  publishedBadge: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    // El lima sobre blanco no contrasta: verde oscuro para el texto.
    color: '#3F7D20',
    backgroundColor: '#A9F56F40',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  contentInput: { minHeight: 160, textAlignVertical: 'top' },
  hint: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  loadError: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#EF4444',
  },
});
