import { View, Pressable } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import { useStyles } from '../theme';

export default function Stepper({ value, onChange, min = 0, max = 120, step = 5, unit = 'menit', inline }) {
  const { c, s } = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 20, paddingHorizontal: 8 },
    btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    off: { opacity: 0.4 },
    val: { fontSize: 20, lineHeight: 24, fontWeight: '800' },
    inl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    inlBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    inlPlus: { backgroundColor: c.primary },
    inlVal: { fontSize: 17, lineHeight: 24, fontWeight: '800', minWidth: 64, textAlign: 'center' },
  }));
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  const set = (v) => onChange(String(Math.max(min, Math.min(max, v))));
  if (inline) {
    return (
      <View style={s.inl}>
        <Pressable accessibilityLabel="Kurangi" disabled={n <= min} onPress={() => set(n - step)} style={[s.inlBtn, n <= min && s.off]}>
          <Icon name="remove" size={22} color={c.primaryText} />
        </Pressable>
        <Text style={s.inlVal}>{n} {unit === 'menit' ? 'mnt' : unit}</Text>
        <Pressable accessibilityLabel="Tambah" disabled={n >= max} onPress={() => set(n + step)} style={[s.inlBtn, s.inlPlus, n >= max && s.off]}>
          <Icon name="add" size={22} color={c.onPrimary} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={s.row}>
      <Pressable accessibilityLabel="Kurangi" disabled={n <= min} onPress={() => set(n - step)} style={[s.btn, n <= min && s.off]}>
        <Icon name="remove" size={24} color={c.primaryText} />
      </Pressable>
      <Text style={s.val}>{n} {unit}</Text>
      <Pressable accessibilityLabel="Tambah" disabled={n >= max} onPress={() => set(n + step)} style={[s.btn, n >= max && s.off]}>
        <Icon name="add" size={24} color={c.primaryText} />
      </Pressable>
    </View>
  );
}
