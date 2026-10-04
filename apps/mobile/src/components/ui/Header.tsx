import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@nexofit/core';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: { label: string; onPress: () => void };
  rightAction?: { label: string; onPress: () => void };
}

export function Header({ title, subtitle, leftAction, rightAction }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.side}>
        {leftAction && (
          <TouchableOpacity onPress={leftAction.onPress}>
            <Text style={styles.action}>{leftAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.side}>
        {rightAction && (
          <TouchableOpacity onPress={rightAction.onPress}>
            <Text style={styles.action}>{rightAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: colors.crema,
  },
  side: {
    width: 60,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.brand,
    fontSize: 18,
    color: colors.azulNexo,
  },
  subtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  action: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.turquesa,
  },
});
