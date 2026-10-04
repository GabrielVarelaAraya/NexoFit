import { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Button } from '../../components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateGym'>;

// Espejo de la generación de slug en create_organization() (000009),
// solo para la vista previa: el slug final lo calcula el servidor.
function slugifyPreview(input: string): string {
  return input
    .toLowerCase()
    .replace(/[á]/g, 'a')
    .replace(/[é]/g, 'e')
    .replace(/[í]/g, 'i')
    .replace(/[ó]/g, 'o')
    .replace(/[ú]/g, 'u')
    .replace(/[ü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function CreateGymScreen({ navigation }: Props) {
  const { refreshMembership } = useAuth();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const slugPreview = useMemo(() => slugifyPreview(name.trim()), [name]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      Alert.alert('Nombre muy corto', 'El nombre del gimnasio debe tener al menos 3 caracteres.');
      return;
    }
    if (creating) return;

    Keyboard.dismiss();
    setCreating(true);

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('create_organization', { p_name: trimmed });

    setCreating(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    const result = data as {
      status?: string;
      message?: string;
      name?: string;
      slug?: string;
    };

    if (result?.status !== 'created') {
      Alert.alert('Error', result?.message ?? 'No se pudo crear el gimnasio.');
      return;
    }

    await refreshMembership();
    Alert.alert(
      '¡Gimnasio creado!',
      `"${result.name}" ya está disponible en NexoFit (/${result.slug}).`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Crear gimnasio"
        subtitle="Registra tu establecimiento y empieza a ofrecerlo"
        leftAction={{ label: '← Volver', onPress: () => navigation.goBack() }}
      />

      <View style={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
        <Text style={styles.label}>Nombre del gimnasio</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ej: CrossFit Heredia"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          maxLength={80}
        />

        {slugPreview.length > 0 && (
          <Text style={styles.slugPreview}>
            Dirección: <Text style={styles.slugValue}>/{slugPreview}</Text>
          </Text>
        )}

        <Text style={styles.note}>
          Quedarás como administrador del gimnasio. Desde tu cuenta podrás gestionarlo; los clientes
          podrán encontrarlo y unirse desde "Buscar gimnasio".
        </Text>

        <Button
          title="Crear gimnasio"
          variant="primary"
          fullWidth
          loading={creating}
          onPress={handleCreate}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 12 },
  label: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.azulNexo },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    color: colors.azulNexo,
  },
  slugPreview: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textSecondary },
  slugValue: { fontFamily: fonts.uiSemiBold, color: colors.turquesa },
  note: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 4,
  },
});
