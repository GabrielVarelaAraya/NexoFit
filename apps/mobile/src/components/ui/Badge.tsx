import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, textStyles } from '@nexofit/core';

interface BadgeProps {
  label: string;
  /** Color de acento: el fondo es una versión translúcida. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Etiqueta de estado («Confirmada», «50 cupos», «Admin»…). */
export function Badge({ label, color = colors.turquesa, style }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: { ...textStyles.label, fontSize: 12, lineHeight: 16, color: colors.azulNexo },
});
