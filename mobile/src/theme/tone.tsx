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
  danger: string;
  dangerSoft: string;
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
    danger: colors.danger,
    dangerSoft: colors.dangerSoft,
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
