import type { Theme } from './theme.types'

/** The system font (San Francisco) until the app bundles a font. */
const SYSTEM = 'System'

export const SHARED_TYPE: Theme['type'] = {
  title: { family: SYSTEM, weight: '700', scale: 22, textShadow: null },
  body: { family: SYSTEM, weight: '400', scale: 15, textShadow: null },
  label: { family: SYSTEM, weight: '600', scale: 13, textShadow: null },
  caption: { family: SYSTEM, weight: '400', scale: 13, textShadow: null },
  button: { family: SYSTEM, weight: '600', scale: 16, textShadow: null },
  timer: { family: SYSTEM, weight: '600', scale: 15, textShadow: null },
  given: { family: SYSTEM, weight: '600', scale: 23, textShadow: null },
  entry: { family: SYSTEM, weight: '500', scale: 23, textShadow: null },
  note: { family: SYSTEM, weight: '500', scale: 11, textShadow: null },
  key: { family: SYSTEM, weight: '500', scale: 28, textShadow: null },
  keyNote: { family: SYSTEM, weight: '600', scale: 20, textShadow: null },
}

export const SHARED_SPACE: Theme['space'] = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }

export const SHARED_SHAPE: Theme['shape'] = {
  radius: { sm: 6, md: 14, lg: 16, xl: 26, pill: 999 },
  gridLine: { outer: 2, box: 2, cell: 1 },
}

export const SHARED_MOTION: Theme['motion'] = { short: 150, medium: 350, long: 700, pulseStep: 45 }
