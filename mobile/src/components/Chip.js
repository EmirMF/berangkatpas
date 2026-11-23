import { Pressable } from 'react-native';
import Text from './Text';
import { useStyles } from '../theme';

export default function Chip({ label, selected, onPress, round, soft }) {
  const { c, s } = useStyles((c) => ({
    chip: { height: 44, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    pill: { height: 38, paddingHorizontal: 18 },
    round: { width: 40, height: 40, paddingHorizontal: 0 },
    on: { backgroundColor: c.primary, borderColor: c.primary, shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    softOn: { backgroundColor: c.primaryTint, borderColor: c.primary, borderWidth: 1.5 },
    text: { fontSize: 14, fontWeight: '600' },
    small: { fontSize: 13 },
  }));
  const tint = soft && selected;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[s.chip, soft && s.pill, round && s.round, selected && (soft ? s.softOn : s.on)]}
    >
      <Text style={[s.text, (round || soft) && s.small, { color: tint ? c.primaryText : selected ? c.onPrimary : round ? c.inkMuted : c.ink }, selected && { fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}
