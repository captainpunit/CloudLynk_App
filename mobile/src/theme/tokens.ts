import type { TextStyle } from 'react-native';

/**
 * One visual vocabulary for the app. Watching happens on the dark `night` palette; forms,
 * settings and My cloud stay on the light `colors` palette. Marigold is reserved for Plus.
 * Never inline a colour in a screen: add a named token here and expose it through the
 * palette in `theme/tone.tsx`.
 */
export const plus = {
  /** Badge and Plus button fill. */
  fill: '#F4B740',
  /** Text and icons on the fill. */
  onFill: '#1F1604',
  /** Plus text on light surfaces. */
  inkOnLight: '#7A5410',
  /** Tint behind Plus panels on light surfaces. */
  softOnLight: '#FCEFD3',
  /** Tint behind Plus panels on dark surfaces. */
  softOnDark: '#F4B7401F',
};

export const colors = {
  canvas: '#F6F6F8',
  surface: '#FFFFFF',
  ink: '#161821',
  muted: '#5C6170',
  line: '#E3E4EA',
  primary: '#1F2433',
  primarySoft: '#ECEDF2',
  /** Input focus ring: primary at 20%. */
  focusRing: '#1F243333',
  accent: plus.fill,
  /** The add button in the middle of the tab bar. */
  upload: '#3D5AFE',
  dark: '#101219',
  danger: '#B3261E',
  dangerSoft: '#FCEDEC',
  // States for StatusBadge. Each text colour passes WCAG AA on its soft fill.
  success: '#1C7A4C',
  successSoft: '#E4F3EA',
  warning: '#8F5B0E',
  warningSoft: '#FBF0DC',
  // Disabled controls get their own colours instead of a faded opacity.
  disabledSurface: '#E7E8ED',
  disabledInk: '#8E92A0',
  skeleton: '#E7E8ED',
  goldSoft: plus.softOnLight,
  white: '#FFFFFF',
  goldInk: plus.inkOnLight,
  onDarkMuted: '#A2A7B6',
  player: '#000000',
  scrim: '#000000A6',
  scrimSoft: '#00000070',
  scrimClear: '#00000000',
  scrimHero: '#101219F2',
  glass: '#FFFFFFE8',
  glassLine: '#FFFFFF30',
  glassSoft: '#FFFFFF18',
  glassFaint: '#FFFFFF12',
};

/** Surfaces for watching: channels, titles and the player. */
export const night = {
  canvas: '#101219',
  surface: '#181B24',
  raised: '#232735',
  ink: '#F2F0EA',
  muted: '#A2A7B6',
  line: '#2B303E',
  danger: '#FFB4AB',
  dangerSoft: '#3B1D1E',
  /** Input focus ring: ink at 20%. */
  focusRing: '#F2F0EA33',
  success: '#7FD6A4',
  successSoft: '#173026',
  warning: '#FFB77A',
  warningSoft: '#3A2716',
  disabledSurface: '#232735',
  disabledInk: '#6E7384',
  skeleton: '#232735',
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
  blockGap: 24,
  cardPadding: 18,
  maxWidth: 720,
  touchTarget: 44,
};

/** Side margin of every screen; full-bleed rows offset by it. */
export const gutter = layout.gutter;

export const radius = { xs: 5, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

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
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, letterSpacing: -0.8 },
  headline: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 27, letterSpacing: -0.4 },
  subhead: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  button: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  body: { fontSize: 15, lineHeight: 23 },
  callout: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 19 },
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
