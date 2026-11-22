import { View } from 'react-native';
import { useStyles } from '../theme';

export default function Card({ children, style, flush }) {
  const { s } = useStyles((c) => ({
    card: { backgroundColor: c.surface, borderRadius: 24, borderWidth: 1, borderColor: c.border, padding: 20, overflow: 'hidden' },
    flush: { padding: 0 },
  }));
  return <View style={[s.card, flush && s.flush, style]}>{children}</View>;
}
