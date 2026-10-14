import {
  SHARED_FINISH_CARD,
  SHARED_MOTION,
  SHARED_OPACITY,
  SHARED_SHAPE,
  SHARED_SIZE,
  SHARED_SPACE,
  SHARED_TYPE,
} from '@/theme/shared.tokens'
import type { Theme } from '@/theme/theme.types'
import { palette as p } from './palette'

const colors: Theme['colors'] = {
  background: p.night950,
  surface: p.night900,
  text: p.mist100,
  textMuted: p.mist400,
  accent: p.periwinkle400,
  onAccent: p.night950,
  accentSoft: p.indigo900,
  line: p.night800,
  lineStrong: p.night600,
  danger: p.coral400,
  dangerSurface: p.maroon900,
  warning: p.amber400,
  warningText: p.amber400,
  warningSurface: p.umber900,
  shadow: p.black,
  scrim: p.nightScrim,
  scrimStrong: p.nightScrimStrong,
}

export const midnight: Theme = {
  name: 'midnight',
  label: 'Midnight',
  statusBar: 'light',
  colors,
  type: SHARED_TYPE,
  space: SHARED_SPACE,
  shape: SHARED_SHAPE,
  size: SHARED_SIZE,
  opacity: SHARED_OPACITY,
  elevation: { key: 'none', sheet: '0 24px 60px -20px rgba(0,0,0,0.6)', panel: '0 -6px 12px rgba(0,0,0,0.4)' },
  motion: SHARED_MOTION,
  components: {
    finishCard: SHARED_FINISH_CARD,
    grid: { frame: colors.lineStrong, boxLine: colors.lineStrong, cellLine: colors.line },
    cell: {
      fill: colors.surface,
      peer: p.night850,
      same: p.indigo750,
      selected: p.indigo800,
      conflictFill: colors.dangerSurface,
      ring: colors.accent,
      given: colors.text,
      // Lighter than the accent: the accent on the same-number fill is below 4.5 : 1.
      entry: p.periwinkle350,
      conflict: colors.danger,
      // The muted text, not the canvas note grey: that grey is below 4.5 : 1 on the selected fill.
      note: colors.textMuted,
    },
    key: { fill: p.night850, digit: colors.text, noteDigit: colors.accent },
    switch: { on: colors.accent, off: p.night700, knob: p.white },
    segmented: { track: p.night850, selected: colors.surface },
    // A little stronger than Daylight, as in the design canvas: the accent is lighter on the dark fills.
    button: {
      primary: colors.text,
      onPrimary: p.night950,
      second: p.night850,
      outline: p.night850,
      outlineWidth: 0,
      radius: 16,
    },
    panel: {
      fill: colors.surface,
      radius: SHARED_SHAPE.radius.xl,
      border: colors.line,
      borderWidth: 1,
      key: p.night850,
      keyRadius: 14,
    },
    checkRing: { color: colors.warning, round: false },
    pulse: { waveOpacity: 0.32, popScale: 1.3 },
    summary: { border: colors.line, borderWidth: 1, radius: 16, rule: colors.line, ruleWidth: 1 },
    tabs: { track: p.night850, selected: colors.surface },
  },
}
