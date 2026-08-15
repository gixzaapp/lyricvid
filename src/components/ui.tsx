import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from 'react-native';

import { colors } from '@/theme';

type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'primary', compact, style, disabled, ...rest }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        compact && styles.compact,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      {...rest}>
      <Text
        style={[
          styles.buttonLabel,
          variant === 'secondary' && { color: colors.text },
          variant === 'ghost' && { color: colors.accent },
          variant === 'danger' && { color: colors.danger },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Helper({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'warning' | 'success';
}) {
  const color: TextStyle['color'] =
    tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.muted;
  return <Text style={[styles.helper, { color }]}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
  buttonLabel: {
    color: '#0B0B10',
    fontWeight: '700',
    fontSize: 15,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  chipLabel: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
  },
  chipLabelSelected: {
    color: colors.text,
  },
  section: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
});
