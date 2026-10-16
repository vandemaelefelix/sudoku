/** The colours of one Op-art colourway. Each colourway folder holds its own values in palette.ts (ADR-015, point 3; ADR-025). */
export type OpartPalette = {
  ink: string
  muted: string
  accent: string
  /** The digit a player types. Darker than the accent: the accent on the same-number fill is below 4.5 : 1. */
  entry: string
  /** The digit a player types in the Colour appearance: a light tint of the hue, for the dark page (ADR-026). */
  colourEntry: string
  /** The accent mixed with white: 300 is the strongest tint, 050 the faintest. */
  tint300: string
  tint200: string
  tint175: string
  tint150: string
  tint100: string
  tint050: string
  danger: string
  dangerSurface: string
  warning: string
  warningText: string
  warningSurface: string
}

/** The colours every colourway shares. */
export const SHARED_PALETTE = {
  white: '#ffffff',
  whiteScrim: 'rgba(255,255,255,0.55)',
  whiteScrimStrong: 'rgba(255,255,255,0.94)',
  whiteLine: 'rgba(255,255,255,0.22)',
  whiteBoxLine: 'rgba(255,255,255,0.6)',
  whiteShine: 'rgba(255,255,255,0.22)',
  whiteShineSoft: 'rgba(255,255,255,0.1)',
  whiteClear: 'rgba(255,255,255,0)',
  whiteFrame: 'rgba(255,255,255,0.45)',
} as const
