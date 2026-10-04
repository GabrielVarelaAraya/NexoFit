import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts } from '@nexofit/core';

interface LoadingViewProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Spinner centrado con etiqueta: transición estándar al cargar una pantalla. */
export function LoadingView({ label = 'Cargando…', style }: LoadingViewProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={colors.turquesa} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
