import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

export const light = {
  bg: '#f4f8fd',
  surface: '#ffffff',
  border: '#c3d0e0',
  borderStrong: '#72849e',
  ink: '#0b1b2b',
  inkMuted: '#52627a',
  primary: '#0272db',
  onPrimary: '#ffffff',
  primaryText: '#0261b8',
  primaryTint: '#e3f1ff',
  secondary: '#9333e0',
  onSecondary: '#ffffff',
  secondaryText: '#7a28c8',
  secondaryTint: '#f2e6fd',
  accent: '#ffc83d',
  onAccent: '#0b1b2b',
  accentTint: '#fff0c9',
  danger: '#c62828',
  dangerTint: '#fde4e4',
  success: '#17703f',
  successTint: '#ddf3e7',
  focus: '#0261b8',
};

export const dark = {
  ...light,
  bg: '#0a1220',
  surface: '#121c2e',
  border: '#3a4d6b',
  borderStrong: '#6c84a8',
  ink: '#eaf1fa',
  inkMuted: '#9db0c9',
  primaryText: '#6db8ff',
  primaryTint: '#0f2a47',
  secondaryText: '#d4a5ff',
  secondaryTint: '#2b1847',
  accentTint: '#3a2b00',
  danger: '#ff8a80',
  dangerTint: '#3d1414',
  success: '#5fd59a',
  successTint: '#0f3322',
  focus: '#7cc0ff',
};

export const space = (n) => n * 4;

export const radius = { input: 20, card: 24, hero: 28, pill: 999 };

export const TAB_SPACE = 112;

export function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

export function useStyles(factory) {
  const c = useTheme();
  return useMemo(() => ({ c, s: StyleSheet.create(factory(c)) }), [c]);
}
