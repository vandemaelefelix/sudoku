import type { TextStyle } from 'react-native'

export type ThemeName = 'daylight' | 'midnight'

/** A text role. scale: the font size in points at the default Dynamic Type size. */
export type TypeRole = {
  family: string
  weight: NonNullable<TextStyle['fontWeight']>
  scale: number
  /** Letter spacing in em. 0 for none. The caller multiplies it by scale. */
  tracking: number
  textShadow: { color: string; offset: { width: number; height: number }; radius: number } | null
}

export type Theme = {
  name: ThemeName
  /** The style of the status bar text over colors.background. */
  statusBar: 'dark' | 'light'
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
    /** The uppercase heading of a settings section. */
    section: TypeRole
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
    /** Border widths in points. */
    stroke: { thin: number; dot: number; ring: number }
  }
  /** Fixed sizes in points. touch is the smallest touch target of a button. */
  size: {
    touch: number
    icon: number
    header: number
    tool: number
    key: { width: number; height: number }
    pill: { height: number; paddingHorizontal: number }
    dot: { size: number; gap: number }
    noteInset: number
    /** The side of the assist preview grid. Cells of about 20 pt. */
    preview: number
  }
  /** disabled: a control that cannot act now. locked: the controls of a game that ended. */
  opacity: { disabled: number; locked: number }
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
    /** The digit pop of a pulse, in milliseconds. The wave of a pulse uses long. */
    pop: number
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
    /** waveOpacity: the opacity of colors.accent at the peak of the wave. popScale: the digit scale at the peak of the pop. */
    pulse: { waveOpacity: number; popScale: number }
  }
}
