import { View } from 'react-native';
import { useStyles } from '../theme';
import { hairline, softShadow } from '../theme/effects';

export default function Card({ children, style, flush }) {
  const { s } = useStyles((c) => ({
    card: { backgroundColor: c.surface, borderRadius: 24, borderWidth: 1, borderColor: hairline(c), padding: 20, ...softShadow },
    flush: { padding: 0 },
  }));
  return <View style={[s.card, flush && s.flush, style]}>{children}</View>;
}
