import type { TextStyle, ViewStyle } from 'react-native';

/**
 * CloudLynk design tokens: one visual vocabulary for every screen.
 * Hybrid direction: light surfaces for browsing and managing, dark "cinema"
 * surfaces for heroes, channel headers and the player. Never inline a colour;
 * add a semantically named token here instead.
 */
export const colors = {
  // Light surfaces
  canvas: '#F5F7F7',
  surface: '#FFFFFF',
  surfaceSunken: '#EEF2F1',
  line: '#E2E8E7',
  // Text. muted passes WCAG AA (about 5:1) on canvas and surface.
  ink: '#0F1F21',
  muted: '#5F6E6E',
  white: '#FFFFFF',
  // Brand
  primary: '#146C60',
  primaryPressed: '#0F574E',
  primarySoft: '#E3F0EC',
  focusRing: '#146C6033',
  accent: '#E0B66C',
  goldSoft: '#FAF0DC',
  goldInk: '#8A6221',
  // States
  success: '#1C7A4C',
  successSoft: '#E4F3EA',
  warning: '#8F5B0E',
  warningSoft: '#FBF0DC',
  danger: '#B83A44',
  dangerSoft: '#FBECEE',
  disabledSurface: '#E8EDEC',
  disabledInk: '#97A3A3',
  skeleton: '#E6ECEB',
  // Cinema surfaces (heroes, channel headers, player)
  cinemaCanvas: '#0B1514',
  cinemaSurface: '#13201F',
  cinemaLine: '#FFFFFF1F',
  cinemaSkeleton: '#FFFFFF14',
  onCinema: '#FFFFFF',
  onCinemaMuted: '#B7CAC4',
  // Overlays on imagery
  scrim: '#00000080',
  scrimSoft: '#00000070',
  scrimClear: '#00000005',
  scrimHero: '#071A16E8',
  glass: '#FFFFFFE8',
  glassLine: '#FFFFFF30',
  glassSoft: '#FFFFFF18',
  glassFaint: '#FFFFFF12',
  // Earlier names, kept so existing screens keep working.
  dark: '#13201F',
  player: '#071413',
  onDarkMuted: '#B7CAC4',
};

/** 4-point spacing grid. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
  huge: 56,
};

/** Page-level rhythm shared by every screen. */
export const layout = {
  gutter: 20,
  sectionGap: 32,
  blockGap: 24,
  cardPadding: 16,
  maxWidth: 720,
  touchTarget: 44,
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

/** Soft resting shadow plus a deeper one for floating UI (toast, sheets). */
export const elevation = {
  card: { boxShadow: '0px 1px 2px #0F1F210A, 0px 6px 16px #0F1F210D' },
  floating: { boxShadow: '0px 12px 32px #0F1F2129' },
} satisfies Record<string, ViewStyle>;

/** Plus Jakarta Sans for display text; the platform font for reading text. */
export const fonts = {
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * Type scale. Jakarta presets never set fontWeight: the family name carries the
 * weight, and Android falls back to the system font when both are set.
 */
export const text = {
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  headline: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26, letterSpacing: -0.2 },
  subhead: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  button: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  body: { fontSize: 15, lineHeight: 22 },
  callout: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof text;

/** Durations in milliseconds. Curves and springs live in components/ui/motion. */
export const motion = { fast: 120, base: 200, slow: 280, pressScale: 0.97 };
