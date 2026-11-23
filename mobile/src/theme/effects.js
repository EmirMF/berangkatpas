import { dark } from './index';

export const HERO_GRADIENT = ['#0272db', '#0a63cf', '#6a3fd8'];

export const softShadow = {
  shadowColor: '#0b1b2b',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const floatShadow = {
  shadowColor: '#0b1b2b',
  shadowOpacity: 0.14,
  shadowRadius: 32,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
};

export const primaryShadow = {
  shadowColor: '#0272db',
  shadowOpacity: 0.3,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

export const hairline = (c) => (c === dark ? c.border : '#e3ebf5');

export const washColors = (c) =>
  c === dark ? ['#10223d', c.bg] : ['#d4e8ff', '#e6f1fe', c.bg];

export const modeTone = (c, mode) => {
  const isDark = c === dark;
  const map = {
    walk: { bg: c.primaryTint, fg: c.primaryText },
    motorcycle: { bg: c.secondaryTint, fg: c.secondaryText },
    car: { bg: c.accentTint, fg: isDark ? c.accent : '#8a5a00' },
  };
  return map[mode] || map.walk;
};

export const logoPalette = (c) =>
  c === dark
    ? { body: '#121c2e', edge: '#3a4d6b', ring: '#24385a', short: '#b06af0', long: '#3b9bff', dot: '#ffc83d', dotEdge: '#121c2e' }
    : { body: '#ffffff', edge: '#c3d0e0', ring: '#d4e8ff', short: '#9333e0', long: '#0272db', dot: '#ffc83d', dotEdge: '#ffffff' };