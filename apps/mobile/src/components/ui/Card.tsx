import { View, Text, StyleSheet, type ViewProps } from 'react-native';
import { colors, fonts } from '@nexofit/core';

interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  children?: React.ReactNode;
}

export function Card({
  title,
  subtitle,
  badge,
  badgeColor = colors.turquesa,
  children,
  style,
  ...rest
}: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {(title || badge) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
            </View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  subtitle: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
  },
});
