import { SHARED_FINISH_CARD, SHARED_MOTION, SHARED_OPACITY, SHARED_SIZE, SHARED_SPACE } from '@/theme/shared.tokens'
import type { Theme, TypeRole } from '@/theme/theme.types'
import { palette as p } from './palette'

// PostScript names of the bundled files in assets/fonts (ADR-021).
const SERIF = 'CormorantGaramond-Bold'
const SERIF_ITALIC = 'CormorantGaramond-SemiBoldItalic'
const SANS = 'InstrumentSans-Regular'
const SANS_MEDIUM = 'InstrumentSans-Medium'
const SANS_SEMIBOLD = 'InstrumentSans-SemiBold'
const MONO = 'DMMono-Regular'
const MONO_MEDIUM = 'DMMono-Medium'

function role(family: string, weight: TypeRole['weight'], scale: number, tracking = 0, uppercase = false): TypeRole {
  return { family, weight, scale, tracking, uppercase, textShadow: null }
}

const colors: Theme['colors'] = {
  background: p.beige200,
  surface: p.beige100,
  text: p.ink950,
  textMuted: p.stone600,
  accent: p.ink950,
  onAccent: p.beige100,
  accentSoft: p.sand300,
  line: p.sand400,
  lineStrong: p.ink950,
  danger: p.red700,
  dangerSurface: p.red100,
  warning: p.ochre600,
  warningText: p.ochre800,
  warningSurface: p.ochre100,
  shadow: p.black,
  scrim: p.beigeScrim,
  scrimStrong: p.beigeScrimStrong,
}

/** Beige page, black only, a black disc and a band of vertical stripes. */
export const progressive: Theme = {
  name: 'progressive',
  label: 'Progressive',
  statusBar: 'dark',
  colors,
  type: {
    display: role(SERIF, '700', 44, -0.01, true),
    title: role(SERIF, '700', 26),
    body: role(SANS, '400', 15),
    label: role(SANS_SEMIBOLD, '600', 13),
    section: role(MONO_MEDIUM, '500', 11, 0.08, true),
    caption: role(SANS, '400', 13),
    button: role(SANS_SEMIBOLD, '600', 15, 0.06, true),
    timer: role(MONO_MEDIUM, '500', 15),
    given: role(SERIF, '700', 25),
    entry: role(SANS_MEDIUM, '500', 21),
    note: role(SANS_MEDIUM, '500', 11),
    key: role(SERIF, '700', 28),
    keyNote: role(SANS_SEMIBOLD, '600', 20),
    question: role(SERIF, '700', 28),
    status: role(SERIF_ITALIC, '600', 21),
    eyebrow: role(MONO, '400', 11, 0.08, true),
  },
  space: SHARED_SPACE,
  shape: {
    radius: { sm: 0, md: 4, lg: 4, xl: 0, pill: 999 },
    gridLine: { outer: 2, box: 2, cell: 1 },
    stroke: { thin: 1, dot: 1.5, ring: 2 },
  },
  size: { ...SHARED_SIZE, titleBlock: 60, panelEdge: 30 },
  opacity: SHARED_OPACITY,
  elevation: { key: 'none', sheet: '0 24px 60px -20px rgba(0,0,0,0.3)', panel: 'none' },
  motion: SHARED_MOTION,
  components: {
    finishCard: SHARED_FINISH_CARD,
    grid: { frame: colors.lineStrong, boxLine: colors.lineStrong, cellLine: colors.line },
    cell: {
      fill: colors.surface,
      peer: p.beige150,
      same: p.sand350,
      selected: p.sand300,
      conflictFill: colors.dangerSurface,
      ring: colors.accent,
      given: colors.text,
      entry: p.blue700,
      conflict: colors.danger,
      note: colors.textMuted,
    },
    key: { fill: p.beige100, digit: colors.text, noteDigit: colors.accent },
    switch: { on: colors.accent, off: p.sand500, knob: p.beige100 },
    segmented: { track: p.beige200, selected: colors.surface },
    button: {
      primary: p.ink950,
      onPrimary: p.beige100,
      second: colors.surface,
      outline: p.ink950,
      outlineWidth: 1.5,
      radius: 0,
    },
    panel: { fill: colors.surface, radius: 0, border: colors.line, borderWidth: 0, key: p.beige200, keyRadius: 0 },
    checkRing: { color: colors.warning, round: true },
    pulse: { waveOpacity: 0.22, popScale: 1.3 },
  },
}
