/**
 * One visual vocabulary for the app. Watching happens on the dark `night` palette; forms,
 * settings and My cloud stay on the light `colors` palette. Marigold is reserved for Plus.
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
  accent: plus.fill,
  dark: '#101219',
  danger: '#B3261E',
  dangerSoft: '#FCEDEC',
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
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, section: 40 };
export const radius = { small: 10, card: 20, large: 28, pill: 999 };
export const type = { hero: 36, title: 28, section: 21, body: 15, caption: 12 };
/** Side margin of every screen; full-bleed rows offset by it. */
export const gutter = 20;
