import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Retraso escalonado para listas: las primeras tarjetas entran una tras otra. */
export function staggerDelay(index: number, step = 45, maxItems = 6): number {
  return Math.min(Math.max(index, 0), maxItems) * step;
}

/**
 * Envuelve un renderItem de FlatList para que cada tarjeta entre con fundido
 * escalonado: `renderItem={withFadeIn(renderBooking)}`.
 */
export function withFadeIn<T>(
  render: (info: { item: T; index: number }) => React.ReactElement | null
) {
  const Item = (info: { item: T; index: number }) => (
    <FadeIn delay={staggerDelay(info.index)}>{render(info)}</FadeIn>
  );
  return Item;
}

interface FadeInProps {
  children: React.ReactNode;
  /** Duración del fundido en ms. */
  duration?: number;
  /** Espera antes de empezar (ver staggerDelay). */
  delay?: number;
  /** Desplazamiento vertical inicial en px; 0 = solo fundido. */
  rise?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrada suave del contenido real cuando reemplaza al skeleton: fundido +
 * un ligero deslizamiento hacia arriba. Como el skeleton tiene la misma forma
 * que el contenido, el ojo lee «los bloques se rellenan» en vez de un salto.
 * Con «reducir movimiento» del sistema aparece de inmediato.
 */
export function FadeIn({ children, duration = 260, delay = 0, rise = 8, style }: FadeInProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          progress.setValue(1);
          return;
        }
        animation = Animated.timing(progress, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        });
        animation.start();
      });

    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [progress, duration, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
