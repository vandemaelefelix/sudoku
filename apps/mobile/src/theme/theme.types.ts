import type { TextStyle } from 'react-native'

export type ThemeName = 'daylight' | 'midnight'

/** A text role. scale: the font size in points at the default Dynamic Type size. */
export type TypeRole = {
  family: string
  weight: NonNullable<TextStyle['fontWeight']>
  scale: number
  textShadow: { color: string; offset: { width: number; height: number }; radius: number } | null
}

export type Theme = {
  name: ThemeName
  colors: {
    background: string
    surface: string
    text: string
    textMuted: string
    accent: string
    onAccent: string
    accentSoft: string
    line: string
    lineStrong: string
    danger: string
    dangerSurface: string
    warning: string
    warningText: string
    warningSurface: string
    shadow: string
    /** Over the game when it ends in a loss. Has alpha. */
    scrim: string
    /** Over the game behind the finish card. Has alpha. */
    scrimStrong: string
  }
  type: {
    title: TypeRole
    body: TypeRole
    label: TypeRole
    caption: TypeRole
    button: TypeRole
    timer: TypeRole
    given: TypeRole
    entry: TypeRole
    note: TypeRole
    key: TypeRole
    keyNote: TypeRole
  }
  space: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number }
  shape: {
    radius: { sm: number; md: number; lg: number; xl: number; pill: number }
    /** The grid draws its lines as gaps (ADR-015, point 6). Widths in points. */
    gridLine: { outer: number; box: number; cell: number }
  }
  elevation: {
    /** React Native boxShadow strings, or 'none'. */
    key: string
    sheet: string
    panel: string
  }
  motion: {
    /** Durations in milliseconds. */
    short: number
    medium: number
    long: number
    /** The delay per cell of a pulse, in milliseconds. */
    pulseStep: number
  }
  components: {
    grid: { frame: string; boxLine: string; cellLine: string }
    cell: {
      fill: string
      peer: string
      same: string
      selected: string
      conflictFill: string
      ring: string
      given: string
      entry: string
      conflict: string
      note: string
    }
    key: { fill: string; digit: string; noteDigit: string }
    switch: { on: string; off: string; knob: string }
    segmented: { track: string; selected: string }
  }
}
