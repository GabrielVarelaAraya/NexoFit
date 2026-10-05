import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Button, Card, Input } from '../../components/ui';
import { holdLoading } from '../../utils/loading';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'SendNotification'>;

export function SendNotificationScreen({ navigation }: Props) {
  const { user, membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // null = aún cargando destinatarios.
  const [recipientIds, setRecipientIds] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    const load = async () => {
      const startedAt = Date.now();
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('memberships')
        .select('profile_id')
        .eq('organization_id', orgId);
      // Transición suave: el spinner se ve siempre al menos MIN_LOADING_MS.
      await holdLoading(startedAt);
      if (cancelled) return;

      if (error) {
        setRecipientIds([]);
        return;
      }
      // El aviso es para los demás: no enviárselo al propio remitente.
      setRecipientIds((data ?? []).map((r) => r.profile_id).filter((id) => id !== user?.id));
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, user?.id]);

  const handleSend = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      Alert.alert('Faltan datos', 'Escribe un título y un mensaje.');
      return;
    }
    if (!orgId) return;

    const recipients = recipientIds ?? [];
    if (recipients.length === 0) {
      Alert.alert('Sin destinatarios', 'No hay miembros a quien enviar el aviso.');
      return;
    }

    setSending(true);
    const supabase = getSupabase();
    const { error } = await supabase.from('notifications').insert(
      recipients.map((profileId) => ({
        profile_id: profileId,
        organization_id: orgId,
        title: trimmedTitle,
        body: trimmedBody,
        type: 'info',
      }))
    );
    setSending(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert(
      'Notificación enviada',
      `Se envió a ${recipients.length} ${recipients.length === 1 ? 'miembro' : 'miembros'}.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Enviar notificación"
        subtitle="Aviso interno para tus miembros"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.sectionCard}>
          <Input
            label="Título"
            value={title}
            onChangeText={setTitle}
            placeholder="Cambio de horario, recordatorio…"
            maxLength={80}
          />
          <Input
            label="Mensaje"
            value={body}
            onChangeText={setBody}
            placeholder="Escribe el aviso para los miembros…"
            multiline
            numberOfLines={5}
            style={styles.bodyInput}
            maxLength={400}
          />
          <Text style={styles.hint}>
            {recipientIds === null
              ? 'Cargando destinatarios…'
              : recipientIds.length === 0
                ? 'Todavía no hay otros miembros en tu organización.'
                : `Se enviará a ${recipientIds.length} ${
                    recipientIds.length === 1 ? 'miembro' : 'miembros'
                  }. Aparecerá en Perfil → Notificaciones.`}
          </Text>
        </Card>

        <Button
          title="Enviar notificación"
          fullWidth
          loading={sending}
          disabled={recipientIds === null || recipientIds.length === 0}
          onPress={handleSend}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16 },
  sectionCard: { gap: 12 },
  bodyInput: { minHeight: 120, textAlignVertical: 'top' },
  hint: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});
