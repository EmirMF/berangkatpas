import { View, Pressable } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import { useStyles } from '../theme';

export default function ScreenHeader({ title, caption, onBack, right }) {
  const { c, s } = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#0b1b2b', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    spacer: { width: 44 },
    barTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '800', paddingHorizontal: 8 },
    body: { flex: 1, minWidth: 0 },
    caption: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
    title: { fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  }));
  if (onBack) {
    return (
      <View style={s.bar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Kembali" style={s.back}>
          <Icon name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <Text style={s.barTitle} numberOfLines={1}>{title}</Text>
        <View style={s.spacer} />
      </View>
    );
  }
  return (
    <View style={s.row}>
      <View style={s.body}>
        {caption ? <Text style={s.caption}>{caption}</Text> : null}
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}
