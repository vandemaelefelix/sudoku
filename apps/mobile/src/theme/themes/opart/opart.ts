import { SHARED_MOTION, SHARED_OPACITY, SHARED_SIZE, SHARED_SPACE } from '@/theme/shared.tokens'
import type { Theme, TypeRole } from '@/theme/theme.types'
import { palette as p } from './palette'

// PostScript names of the bundled files in assets/fonts (ADR-021).
const SERIF = 'InstrumentSerif-Regular'
const SANS = 'InstrumentSans-Regular'
const SANS_MEDIUM = 'InstrumentSans-Medium'
const SANS_SEMIBOLD = 'InstrumentSans-SemiBold'
const MONO = 'IBMPlexMono-Medium'

function role(family: string, weight: TypeRole['weight'], scale: number, tracking = 0, uppercase = false): TypeRole {
  return { family, weight, scale, tracking, uppercase, textShadow: null }
}

const colors: Theme['colors'] = {
  background: p.white,
  surface: p.white,
  text: p.navy900,
  textMuted: p.navy500,
  accent: p.cobalt600,
  onAccent: p.white,
  accentSoft: p.cobalt150,
  line: p.cobalt200,
  lineStrong: p.cobalt600,
  danger: p.red700,
  dangerSurface: p.red100,
  warning: p.orange600,
  warningText: p.orange800,
  warningSurface: p.orange100,
  shadow: p.navy900,
  scrim: p.whiteScrim,
  scrimStrong: p.whiteScrimStrong,
}

/** White page, one cobalt, wavy parallel lines on the panel edge. */
export const opart: Theme = {
  name: 'opart',
  label: 'Op-art',
  statusBar: 'dark',
  colors,
  type: {
    display: role(SERIF, '400', 50, -0.01),
    title: role(SERIF, '400', 28),
    body: role(SANS, '400', 15),
    label: role(SANS_SEMIBOLD, '600', 13),
    section: role(MONO, '500', 11, 0.1, true),
    caption: role(SANS, '400', 13),
    button: role(SANS_SEMIBOLD, '600', 15, 0.02),
    timer: role(MONO, '500', 15),
    given: role(SERIF, '400', 27),
    entry: role(SANS_MEDIUM, '500', 21),
    note: role(SANS_MEDIUM, '500', 11),
    key: role(SERIF, '400', 30),
    keyNote: role(SANS_SEMIBOLD, '600', 20),
    question: role(SERIF, '400', 30),
    status: role(SERIF, '400', 22),
    eyebrow: role(MONO, '500', 11, 0.1, true),
  },
  space: SHARED_SPACE,
  shape: {
    radius: { sm: 2, md: 4, lg: 4, xl: 0, pill: 999 },
    gridLine: { outer: 2, box: 2, cell: 1 },
    stroke: { thin: 1, dot: 1.5, ring: 2 },
  },
  size: { ...SHARED_SIZE, titleBlock: 60, panelEdge: 34 },
  opacity: SHARED_OPACITY,
  elevation: { key: 'none', sheet: '0 24px 60px -20px rgba(15,29,92,0.3)', panel: 'none' },
  motion: SHARED_MOTION,
  components: {
    // A flat cobalt card with a white frame and a white shine: one colour, no rainbow.
    finishCard: {
      top: colors.accent,
      middle: colors.accent,
      bottom: colors.accent,
      text: p.white,
      textMuted: p.cobalt150,
      given: p.white,
      entry: p.cobalt300,
      line: p.whiteLine,
      boxLine: p.whiteBoxLine,
      shine: p.whiteShine,
      shineCool: p.whiteShineSoft,
      shineWarm: p.whiteShineSoft,
      shineClear: p.whiteClear,
      badge: p.white,
      badgeText: colors.accent,
      radius: 14,
      badgeRadius: 2,
      buttonRadius: 0,
      frame: p.whiteFrame,
      // A close contact shadow and a long soft one lift the card off the white page.
      shadow:
        '0 1px 2px rgba(15,29,92,0.25), 0 10px 20px -6px rgba(15,29,92,0.3), 0 32px 64px -24px rgba(15,29,92,0.45)',
    },
    grid: { frame: colors.lineStrong, boxLine: colors.lineStrong, cellLine: colors.line },
    cell: {
      fill: colors.surface,
      peer: p.cobalt050,
      same: p.cobalt175,
      selected: p.cobalt150,
      conflictFill: colors.dangerSurface,
      ring: colors.accent,
      given: colors.text,
      // Darker than the canvas #2b4dff: that blue on the same-number fill is below 4.5 : 1.
      entry: p.cobalt550,
      conflict: colors.danger,
      note: colors.textMuted,
    },
    key: { fill: p.cobalt100, digit: colors.text, noteDigit: colors.accent },
    switch: { on: colors.accent, off: p.cobalt300, knob: p.white },
    segmented: { track: p.cobalt100, selected: colors.surface },
    button: {
      primary: colors.accent,
      onPrimary: p.white,
      second: colors.surface,
      outline: colors.accent,
      outlineWidth: 1.5,
      radius: 0,
    },
    panel: { fill: colors.surface, radius: 0, border: colors.line, borderWidth: 0, key: p.cobalt100, keyRadius: 0 },
    checkRing: { color: colors.warning, round: true },
    pulse: { waveOpacity: 0.25, popScale: 1.3 },
    summary: { border: colors.lineStrong, borderWidth: 1.5, radius: 0, rule: colors.lineStrong, ruleWidth: 1.5 },
    tabs: { track: p.cobalt100, selected: colors.surface, selectedBorder: colors.accent, selectedBorderWidth: 1.5 },
  },
}
