import { View, TextInput } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import { useStyles } from '../theme';

export default function CustomInput({ label, error, icon, ...rest }) {
  const { c, s } = useStyles((c) => ({
    wrap: { gap: 8 },
    label: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
    field: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, backgroundColor: c.surface },
    err: { borderColor: c.danger, borderWidth: 2 },
    input: { flex: 1, fontSize: 15, color: c.ink, paddingVertical: 12, fontFamily: 'PlusJakartaSans_400Regular' },
    error: { fontSize: 12, lineHeight: 16, color: c.danger },
  }));
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.field, error && s.err]}>
        {icon ? <Icon name={icon} size={20} color={c.inkMuted} /> : null}
        <TextInput style={s.input} placeholderTextColor={c.inkMuted} accessibilityLabel={label} {...rest} />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}
