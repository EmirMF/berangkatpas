import { View, ActivityIndicator } from 'react-native';
import Text from './Text';
import Icon from './Icon';
import Button from './Button';
import { useStyles } from '../theme';

export default function StateView({ loading, error, empty, emptyTitle, emptyText, emptyIcon, emptyAction, onEmptyAction, onRetry, children }) {
  const { c, s } = useStyles((c) => ({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, paddingBottom: 112 },
    circle: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    errCircle: { backgroundColor: c.dangerTint },
    title: { fontSize: 20, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
    text: { maxWidth: 280, fontSize: 14, lineHeight: 20, color: c.inkMuted, textAlign: 'center' },
  }));

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={s.text}>Memuat…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={s.center}>
        <View style={[s.circle, s.errCircle]}>
          <Icon name="cloud-off" size={48} color={c.danger} />
        </View>
        <Text style={s.title}>Tidak terhubung</Text>
        <Text style={s.text}>{error}</Text>
        {onRetry ? <Button title="Coba lagi" icon="refresh" onPress={onRetry} /> : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={s.center}>
        <View style={s.circle}>
          <Icon name={emptyIcon || 'event-note'} size={48} color={c.primaryText} />
        </View>
        <Text style={s.title}>{emptyTitle}</Text>
        <Text style={s.text}>{emptyText}</Text>
        {emptyAction ? <Button title={emptyAction} icon="add" onPress={onEmptyAction} /> : null}
      </View>
    );
  }
  return children;
}
