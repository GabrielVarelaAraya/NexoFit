import { StyleSheet, View } from 'react-native';
import { colors } from '@nexofit/core';

interface SparklineProps {
  values: readonly number[];
  color?: string;
  height?: number;
  /** Texto para lectores de pantalla (p. ej. «Peso: de 100 a 94 kg»). */
  accessibilityLabel: string;
}

/**
 * Mini-gráfico de barras sin dependencias (no hay librería de gráficos en la
 * app). La última barra va resaltada: es el valor actual.
 */
export function Sparkline({
  values,
  color = colors.textAccent,
  height = 36,
  accessibilityLabel,
}: SparklineProps) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return (
    <View
      style={[styles.row, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {values.map((value, index) => {
        // Sin variación, todas a media altura; si no, entre 20 % y 100 %.
        const ratio = range === 0 ? 0.5 : 0.2 + (0.8 * (value - min)) / range;
        const last = index === values.length - 1;
        return (
          <View
            key={index}
            style={[
              styles.bar,
              { height: Math.max(4, ratio * height), backgroundColor: color },
              !last && styles.barMuted,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 8, borderRadius: 3 },
  barMuted: { opacity: 0.35 },
});
