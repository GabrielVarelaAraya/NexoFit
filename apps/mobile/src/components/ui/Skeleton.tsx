import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '@nexofit/core';

/**
 * Pulso compartido: todas las piezas de un skeleton laten al mismo ritmo.
 * Con «reducir movimiento» activado queda estático.
 */
function usePulse() {
  const opacity = useRef(new Animated.Value(0.55)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && setReduceMotion(enabled))
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return opacity;
}

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Bloque gris que ocupa el lugar de un contenido mientras carga. */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const opacity = usePulse();
  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius, opacity }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/**
 * Contenedor de una pantalla en carga: anuncia «Cargando…» una sola vez a
 * lectores de pantalla y oculta los bloques individuales.
 */
export function SkeletonScreen({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={style}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      {children}
    </View>
  );
}

/**
 * Lista de tarjetas en carga (Clases, Citas, Mis reservas, Agenda…): título,
 * subtítulo y, si aplica, un botón a todo el ancho, como las tarjetas reales.
 */
export function CardListSkeleton({
  label,
  count = 3,
  withButton = false,
  flush = false,
  style,
}: {
  label: string;
  count?: number;
  withButton?: boolean;
  /** Sin padding propio: para usarlo dentro de una lista que ya lo tiene. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SkeletonScreen label={label} style={[listStyles.list, flush && listStyles.flush, style]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={listStyles.card}>
          <View style={listStyles.cardTop}>
            <Skeleton width="50%" height={16} />
            <Skeleton width={64} height={22} radius={6} />
          </View>
          <Skeleton width="75%" height={12} />
          {withButton && <Skeleton height={44} radius={12} />}
        </View>
      ))}
    </SkeletonScreen>
  );
}

/** Lista de filas con avatar (Clientes, lista de clase). */
export function RowListSkeleton({
  label,
  count = 5,
  flush = false,
  style,
}: {
  label: string;
  count?: number;
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SkeletonScreen label={label} style={[listStyles.list, flush && listStyles.flush, style]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={listStyles.row}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={listStyles.rowText}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={11} />
          </View>
          <Skeleton width={64} height={22} radius={999} />
        </View>
      ))}
    </SkeletonScreen>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.border },
});

const listStyles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  flush: { padding: 0 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flex: 1, gap: 6 },
});
