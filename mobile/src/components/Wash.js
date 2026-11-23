import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { washColors } from '../theme/effects';

export default function Wash({ height = 300, colors }) {
  const c = useTheme();
  return (
    <LinearGradient
      colors={colors || washColors(c)}
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, height }}
    />
  );
}
