import { View } from 'react-native';
import Ring from './Ring';
import Text from './Text';
import { useTheme } from '../theme';

export default function Logo({ size = 72, wordmark }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <Ring
        size={size}
        stroke={size / 6}
        segments={[
          { value: 5, color: c.primary },
          { value: 1, color: c.accent },
          { value: 3, color: c.secondary },
        ]}
      />
      {wordmark ? <Text style={{ fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 }}>BerangkatPas</Text> : null}
    </View>
  );
}
