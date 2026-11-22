import { Text as RNText, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

const FAMILY = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_400Regular',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
};

export default function Text({ style, children, ...rest }) {
  const c = useTheme();
  const flat = StyleSheet.flatten(style) || {};
  const weight = flat.fontWeight === 'bold' ? '700' : String(flat.fontWeight || '400');
  const fontFamily = FAMILY[weight] || FAMILY[400];
  return (
    <RNText {...rest} style={[{ color: c.ink }, style, { fontFamily, fontWeight: undefined }]}>
      {children}
    </RNText>
  );
}
