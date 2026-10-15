import type { Theme } from './theme.types'

/** The system font (San Francisco) until the app bundles a font. */
const SYSTEM = 'System'

export const SHARED_TYPE: Theme['type'] = {
  display: { family: SYSTEM, weight: '700', scale: 17, tracking: 0, uppercase: false, textShadow: null },
  title: { family: SYSTEM, weight: '700', scale: 22, tracking: 0, uppercase: false, textShadow: null },
  body: { family: SYSTEM, weight: '400', scale: 15, tracking: 0, uppercase: false, textShadow: null },
  label: { family: SYSTEM, weight: '600', scale: 13, tracking: 0, uppercase: false, textShadow: null },
  section: { family: SYSTEM, weight: '600', scale: 13, tracking: 0.06, uppercase: true, textShadow: null },
  caption: { family: SYSTEM, weight: '400', scale: 13, tracking: 0, uppercase: false, textShadow: null },
  button: { family: SYSTEM, weight: '600', scale: 16, tracking: 0, uppercase: false, textShadow: null },
  timer: { family: SYSTEM, weight: '600', scale: 15, tracking: 0, uppercase: false, textShadow: null },
  given: { family: SYSTEM, weight: '600', scale: 23, tracking: 0, uppercase: false, textShadow: null },
  entry: { family: SYSTEM, weight: '500', scale: 23, tracking: 0, uppercase: false, textShadow: null },
  note: { family: SYSTEM, weight: '500', scale: 11, tracking: 0, uppercase: false, textShadow: null },
  key: { family: SYSTEM, weight: '500', scale: 28, tracking: 0, uppercase: false, textShadow: null },
  keyNote: { family: SYSTEM, weight: '600', scale: 20, tracking: 0, uppercase: false, textShadow: null },
  question: { family: SYSTEM, weight: '700', scale: 20, tracking: 0, uppercase: false, textShadow: null },
  status: { family: SYSTEM, weight: '600', scale: 16, tracking: 0, uppercase: false, textShadow: null },
  eyebrow: { family: SYSTEM, weight: '400', scale: 14, tracking: 0, uppercase: false, textShadow: null },
}

export const SHARED_SPACE: Theme['space'] = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }

export const SHARED_SIZE: Theme['size'] = {
  touch: 44,
  icon: 24,
  header: 48,
  tool: 52,
  key: { width: 64, height: 60 },
  pill: { height: 36, paddingHorizontal: 14 },
  dot: { size: 8, gap: 6 },
  noteInset: 2,
  preview: 180,
  toggle: { width: 52, height: 28, thumb: 18 },
  card: { width: 300, grid: 256 },
  titleBlock: 0,
  panelEdge: 0,
}

export const SHARED_OPACITY: Theme['opacity'] = { disabled: 0.3, locked: 0.35, pressed: 0.7 }

export const SHARED_MOTION: Theme['motion'] = { short: 150, medium: 280, long: 700, pulseStep: 45, pop: 450 }
