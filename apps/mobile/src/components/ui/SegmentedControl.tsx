import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, textStyles } from '@nexofit/core';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/** Selector de 2–4 vistas mutuamente excluyentes (p. ej. Próximas / Anteriores). */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]} accessibilityRole="tablist">
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <TouchableOpacity
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onChange(segment.value)}
          >
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
              {segment.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  itemActive: { backgroundColor: colors.textAccent },
  text: { ...textStyles.label, color: colors.textSecondary },
  textActive: { color: colors.white },
});
