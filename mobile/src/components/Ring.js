import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export default function Ring({ size = 128, stroke = 14, segments, track, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const gap = segments.length > 1 ? 4 : 0;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {track ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" /> : null}
        {segments.filter((x) => x.value > 0).map((seg, i) => {
          const len = (seg.value / total) * circ;
          const el = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={seg.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(len - gap, 1)} ${circ}`}
              strokeDashoffset={-offset}
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
          offset += len;
          return el;
        })}
      </Svg>
      {children}
    </View>
  );
}
