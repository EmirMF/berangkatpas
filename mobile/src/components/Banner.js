import { View } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import Button from './Button';
import { useStyles } from '../theme';

const ICON = { warn: 'info-outline', danger: 'cloud-off', info: 'info-outline', ok: 'check-circle' };

export default function Banner({ text, title, tone = 'warn', icon, actionLabel, onAction }) {
  const { c, s } = useStyles((c) => ({
    box: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16 },
    body: { flex: 1, minWidth: 0 },
    title: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    text: { fontSize: 13, lineHeight: 20 },
  }));
  const bg = { warn: c.accentTint, danger: c.dangerTint, info: c.primaryTint, ok: c.successTint }[tone];
  const fg = { warn: c.ink, danger: c.danger, info: c.primaryText, ok: c.success }[tone];
  return (
    <View style={[s.box, { backgroundColor: bg }]} accessibilityRole="alert">
      <Icon name={icon || ICON[tone]} size={24} color={fg} />
      <View style={s.body}>
        {title ? <Text style={[s.title, { color: tone === 'danger' ? c.danger : c.ink }]}>{title}</Text> : null}
        <Text style={[s.text, { color: tone === 'danger' ? c.ink : c.ink }]}>{text}</Text>
      </View>
      {actionLabel ? <Button title={actionLabel} onPress={onAction} variant="outline" size="sm" /> : null}
    </View>
  );
}
