import { Pressable } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import { useStyles } from '../theme';

export default function Button({ title, onPress, variant = 'primary', icon, disabled = false, size = 'lg', testID }) {
  const { c, s } = useStyles((c) => ({
    base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 24 },
    lg: { height: 56 },
    md: { height: 48 },
    sm: { height: 36, paddingHorizontal: 16 },
    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: c.secondary },
    tint: { backgroundColor: c.primaryTint },
    danger: { backgroundColor: c.dangerTint },
    outline: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong },
    dim: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    text: { fontSize: 16, fontWeight: '700' },
  }));
  const fg = {
    primary: c.onPrimary,
    secondary: c.onSecondary,
    tint: c.primaryText,
    danger: c.danger,
    outline: c.primaryText,
  }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.base, s[size], s[variant], pressed && s.pressed, disabled && s.dim]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={[s.text, size === 'sm' && { fontSize: 13 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}
