import { Pressable } from 'react-native';
import Text from './Text';
import { useStyles } from '../theme';

export default function Chip({ label, selected, onPress, round }) {
  const { c, s } = useStyles((c) => ({
    chip: { height: 44, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    round: { width: 40, height: 40, paddingHorizontal: 0 },
    on: { backgroundColor: c.primary, borderColor: c.primary },
    text: { fontSize: 14, fontWeight: '600' },
    small: { fontSize: 12 },
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[s.chip, round && s.round, selected && s.on]}
    >
      <Text style={[s.text, round && s.small, { color: selected ? c.onPrimary : c.ink }, selected && { fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}
