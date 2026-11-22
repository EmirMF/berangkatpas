import { View, Pressable } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import { useStyles } from '../theme';

export default function ScreenHeader({ title, caption, onBack, right }) {
  const { c, s } = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    back: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, minWidth: 0 },
    caption: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
    title: { fontSize: onBack ? 24 : 32, lineHeight: onBack ? 32 : 40, fontWeight: '800', letterSpacing: -0.5 },
  }));
  return (
    <View style={s.row}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Kembali" style={s.back}>
          <Icon name="arrow-back" size={24} color={c.primaryText} />
        </Pressable>
      ) : null}
      <View style={s.body}>
        {caption ? <Text style={s.caption}>{caption}</Text> : null}
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}
