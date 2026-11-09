import { View, Text, StyleSheet, type ViewProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@nexofit/core';
import { Badge } from './Badge';

interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  /** Muestra «›» a la derecha: la tarjeta entera es tocable (afordancia web/nativo). */
  chevron?: boolean;
  children?: React.ReactNode;
}

export function Card({
  title,
  subtitle,
  badge,
  badgeColor = colors.turquesa,
  chevron = false,
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
          {badge && <Badge label={badge} color={badgeColor} style={styles.badge} />}
          {chevron && (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
              style={styles.chevron}
            />
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: { marginLeft: 8 },
  chevron: {
    marginLeft: 4,
    // Alineado con la línea del título (el header usa alignItems flex-start).
    marginTop: 2,
  },
});
