import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts } from '@nexofit/core';

interface ErrorBannerProps {
  message: string | null | undefined;
  style?: ViewStyle;
}

/** Franja de error inline para pantallas de auth y formularios. */
export function ErrorBanner({ message, style }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEE2E2',
    borderColor: colors.textError,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textError,
  },
});
