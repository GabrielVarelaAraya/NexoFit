import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, textStyles } from '@nexofit/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
}

const HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'calendar-outline', text: 'Reserva clases y citas 1-a-1' },
  { icon: 'trending-up-outline', text: 'Sigue tu progreso y tus marcas' },
  { icon: 'business-outline', text: 'Administra tu gimnasio o tu agenda' },
];

/**
 * Primera pantalla. Antes se pedía elegir un rol aun para iniciar sesión, pero
 * el rol real lo define la membresía: quien vuelve entra directo, y el tipo de
 * uso se pregunta solo al crear la cuenta.
 */
export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top + 32, 72), paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.hero}>
        <View style={styles.logo} accessibilityElementsHidden importantForAccessibility="no">
          <Ionicons name="pulse" size={40} color={colors.limaProgreso} />
        </View>
        <Text style={styles.brand} accessibilityRole="header">
          NexoFit
        </Text>
        <Text style={styles.tagline}>Tu gimnasio, tus clases y tu progreso en un solo lugar.</Text>

        <View style={styles.highlights}>
          {HIGHLIGHTS.map((item) => (
            <View key={item.text} style={styles.highlight}>
              <Ionicons name={item.icon} size={20} color={colors.textAccent} />
              <Text style={styles.highlightText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Iniciar sesión" fullWidth onPress={() => navigation.navigate('Login')} />
        <Button
          title="Crear cuenta"
          variant="ghost"
          fullWidth
          onPress={() => navigation.navigate('SignUp')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.crema,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.azulNexo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brand: { fontFamily: fonts.brand, fontSize: 40, lineHeight: 46, color: colors.azulNexo },
  tagline: {
    ...textStyles.bodyLg,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  highlights: { marginTop: 24, gap: 12, alignSelf: 'stretch', maxWidth: 360, width: '100%' },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlightText: { ...textStyles.body, color: colors.azulNexo, flex: 1 },
  actions: { gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },
});
