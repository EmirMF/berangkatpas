import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Text from './Text';
import { useTheme } from '../theme';
import { logoPalette } from '../theme/effects';

const PIN = 'M60 112C60 112 22 76 22 48A38 38 0 0 1 98 48C98 76 60 112 60 112Z';

export function LogoMark({ size = 72 }) {
  const c = useTheme();
  const p = logoPalette(c);
  return (
    <Svg width={size * 0.8} height={size} viewBox="16 6 88 110" accessibilityLabel="Logo BerangkatPas">
      <Path d={PIN} fill={p.body} stroke={p.edge} strokeWidth={3} />
      <Circle cx={60} cy={48} r={28} stroke={p.ring} strokeWidth={10} fill="none" />
      <Path d="M56.3 56.5L73.8 37.8" stroke={p.long} strokeWidth={8.5} strokeLinecap="round" fill="none" />
      <Path d="M46.3 46.5L56.3 56.5" stroke={p.short} strokeWidth={8.5} strokeLinecap="round" fill="none" />
      <Circle cx={56.3} cy={56.5} r={5.5} fill={p.dot} stroke={p.dotEdge} strokeWidth={1.5} />
    </Svg>
  );
}

export default function Logo({ size = 72, wordmark }) {
  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <LogoMark size={size} />
      {wordmark ? <Text style={{ fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 }}>BerangkatPas</Text> : null}
    </View>
  );
}
