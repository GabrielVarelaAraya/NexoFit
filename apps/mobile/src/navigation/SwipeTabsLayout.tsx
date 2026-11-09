import { useMemo, type ReactNode } from 'react';
import { PanResponder, Platform, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { isHorizontalSwipe, swipeEnabled, swipeTarget } from './swipeTabs';

/**
 * Props para marcar una zona con scroll horizontal propio (tira de días,
 * carruseles…). En web el deslizamiento entre pestañas la ignora, para que
 * arrastrar ahí desplace la tira y no cambie de pestaña. En nativo no hace
 * falta: el ScrollView interno gana el gesto por sí solo.
 */
export const noSwipeProps: object = Platform.OS === 'web' ? { dataSet: { noSwipe: 'true' } } : {};

const NO_SWIPE_SELECTOR = '[data-no-swipe],input,textarea,select,[contenteditable="true"]';

/** Solo web: ¿el gesto empezó en una zona con scroll horizontal o en un campo de texto? */
function startsInNoSwipeZone(event: GestureResponderEvent): boolean {
  if (Platform.OS !== 'web') return false;
  const target = event.nativeEvent?.target as unknown as
    { closest?: (selector: string) => unknown } | undefined;
  return Boolean(target?.closest?.(NO_SWIPE_SELECTOR));
}

function touchPoints(): number {
  const nav = (globalThis as { navigator?: { maxTouchPoints?: number } }).navigator;
  return nav?.maxTouchPoints ?? 0;
}

/**
 * Deslizar a izquierda o derecha cambia de pestaña (como en las apps nativas).
 * Se usa como `screenLayout` de cada navegador de pestañas; el cambio se anima
 * con `animation: 'shift'`. No añade dependencias: usa PanResponder.
 */
export function SwipeTabsLayout({
  navigation,
  children,
}: {
  navigation: NavigationProp<ParamListBase>;
  children: ReactNode;
}) {
  const enabled = swipeEnabled(Platform.OS, touchPoints());

  const responder = useMemo(
    () =>
      PanResponder.create({
        // No se reclama el toque al inicio: los botones y listas siguen igual.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (event, gesture) =>
          isHorizontalSwipe(gesture.dx, gesture.dy) && !startsInNoSwipeZone(event),
        // Si un ScrollView interno quiere el gesto, se lo cedemos.
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_event, gesture) => {
          const state = navigation.getState();
          if (!state) return;
          const target = swipeTarget(
            state.routes.length,
            state.index,
            gesture.dx,
            gesture.dy,
            gesture.vx
          );
          if (target !== null) navigation.navigate(state.routes[target].name);
        },
      }),
    [navigation]
  );

  if (!enabled) return <>{children}</>;
  return (
    <View style={styles.fill} {...responder.panHandlers}>
      {children}
    </View>
  );
}

/** Valor listo para `screenLayout` de los navegadores de pestañas. */
export function swipeScreenLayout({
  navigation,
  children,
}: {
  navigation: NavigationProp<ParamListBase>;
  children: ReactNode;
}) {
  return <SwipeTabsLayout navigation={navigation}>{children}</SwipeTabsLayout>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
