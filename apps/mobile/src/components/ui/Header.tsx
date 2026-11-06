import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.actionButton}
            onPress={leftAction.onPress}
            accessibilityLabel={leftAction.label}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textAccent} />
            <Text style={styles.action}>{leftAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={[styles.side, styles.sideRight]}>
        {rightAction && (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.actionButton}
            onPress={rightAction.onPress}
            accessibilityLabel={rightAction.label}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
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
    minWidth: 60,
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 4,
    gap: 2,
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
    color: colors.textSecondary,
    marginTop: 2,
  },
  action: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.textAccent,
  },
});
