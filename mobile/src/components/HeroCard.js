import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { HERO_GRADIENT, primaryShadow } from '../theme/effects';

export default function HeroCard({ children, onPress, padding = 24 }) {
  const body = (
    <View style={[{ borderRadius: 28 }, primaryShadow]}>
      <LinearGradient
        colors={HERO_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 28, padding, overflow: 'hidden' }}
      >
        <Svg width={200} height={200} viewBox="0 0 200 200" style={{ position: 'absolute', right: -60, top: -60 }} pointerEvents="none">
          <Circle cx={100} cy={100} r={70} stroke="#ffffff" strokeOpacity={0.13} strokeWidth={26} fill="none" />
          <Path d="M100 30A70 70 0 0 1 162 66" stroke="#ffc83d" strokeOpacity={0.9} strokeWidth={26} strokeLinecap="round" fill="none" />
        </Svg>
        {children}
      </LinearGradient>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
}
