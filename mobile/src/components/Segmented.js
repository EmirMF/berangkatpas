import { View, Pressable } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import { useStyles } from '../theme';

export default function Segmented({ options, value, onChange }) {
  const { c, s } = useStyles((c) => ({
    wrap: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 24 },
    item: { flex: 1, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 4 },
    on: { backgroundColor: c.primary },
    text: { fontSize: 12, lineHeight: 16 },
  }));
  return (
    <View style={s.wrap} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = value === o.key;
        const fg = on ? c.onPrimary : c.inkMuted;
        return (
          <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={[s.item, on && s.on]}>
            <Icon name={o.icon} size={24} color={fg} />
            <Text style={[s.text, { color: fg, fontWeight: on ? '700' : '600' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
