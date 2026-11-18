import { createContext, use, type ReactNode } from 'react';
import { colors, night, plus } from './tokens';

export type Tone = 'light' | 'dark';

export interface Palette {
  canvas: string;
  surface: string;
  raised: string;
  ink: string;
  muted: string;
  line: string;
  /** Fill of the main button; Plus has its own fill. */
  action: string;
  onAction: string;
  focusRing: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  disabledSurface: string;
  disabledInk: string;
  skeleton: string;
  /** Plus text on this tone's canvas. */
  plusInk: string;
  plusSoft: string;
}

const palettes: Record<Tone, Palette> = {
  light: {
    canvas: colors.canvas,
    surface: colors.surface,
    raised: colors.primarySoft,
    ink: colors.ink,
    muted: colors.muted,
    line: colors.line,
    action: colors.primary,
    onAction: colors.white,
    focusRing: colors.focusRing,
    danger: colors.danger,
    dangerSoft: colors.dangerSoft,
    success: colors.success,
    successSoft: colors.successSoft,
    warning: colors.warning,
    warningSoft: colors.warningSoft,
    disabledSurface: colors.disabledSurface,
    disabledInk: colors.disabledInk,
    skeleton: colors.skeleton,
    plusInk: plus.inkOnLight,
    plusSoft: plus.softOnLight,
  },
  dark: {
    ...night,
    action: night.ink,
    onAction: night.canvas,
    plusInk: plus.fill,
    plusSoft: plus.softOnDark,
  },
};

const ToneContext = createContext<Tone>('light');

/** Everything inside renders on the given tone; screens default to light. */
export function ToneProvider({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <ToneContext value={tone}>{children}</ToneContext>;
}

export function useTone(): Tone {
  return use(ToneContext);
}

export function usePalette(): Palette {
  return palettes[use(ToneContext)];
}
