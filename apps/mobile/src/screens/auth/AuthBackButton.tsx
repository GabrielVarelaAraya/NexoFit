import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, textStyles } from '@nexofit/core';

/** «‹ Volver» para las pantallas de acceso (sin header de navegación). */
export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Volver"
      style={styles.button}
      onPress={onPress}
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={20} color={colors.textAccent} />
      <Text style={styles.text}>Volver</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: 16,
    marginLeft: -4,
    paddingVertical: 4,
  },
  text: { ...textStyles.bodyStrong, color: colors.textAccent },
});
