import type { TextStyle } from 'react-native'

export type ThemeName = 'daylight' | 'midnight' | 'opart' | 'progressive'

/** A text role. scale: the font size in points at the default Dynamic Type size. */
export type TypeRole = {
  family: string
  weight: NonNullable<TextStyle['fontWeight']>
  scale: number
  /** Letter spacing in em. 0 for none. The caller multiplies it by scale. */
  tracking: number
  /** True: the text shows in capitals. */
  uppercase: boolean
  textShadow: { color: string; offset: { width: number; height: number }; radius: number } | null
}

export type Theme = {
  name: ThemeName
  /** The name the player sees in Settings. */
  label: string
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
    /** The large screen title under the top bar. Only a theme with size.titleBlock above 0 shows it. */
    display: TypeRole
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
    /** The question of the check state, for example "Is this a 4?". */
    question: TypeRole
    /** The first line of the correction panel, for example "3 cells to check". */
    status: TypeRole
    /** Small labels, such as the level and the place of a cell. */
    eyebrow: TypeRole
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
    /** The finish card width and the side of its grid, in points. */
    card: { width: number; grid: number }
    /** The height of the title block under the top bar. 0: the title sits in the top bar. */
    titleBlock: number
    /** The height of the panel edge decoration. 0 for a theme without one. */
    panelEdge: number
  }
  /** disabled: a control that cannot act now. locked: the controls of a game that ended. */
  /** pressed: a button while the finger is on it. */
  opacity: { disabled: number; locked: number; pressed: number }
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
    /** The gradient runs top, middle, bottom at 150°. A flat card gives the three stops one colour. Radii in points. */
    finishCard: {
      top: string
      middle: string
      bottom: string
      text: string
      textMuted: string
      given: string
      entry: string
      line: string
      boxLine: string
      shine: string
      shineCool: string
      shineWarm: string
      shineClear: string
      badge: string
      badgeText: string
      radius: number
      badgeRadius: number
      /** The New puzzle button under the card. */
      buttonRadius: number
      /** The colour of a thin frame inset from the card edge, as on a playing card. Null for none. */
      frame: string | null
      /** A box shadow for the card. Null: the sheet elevation of the theme. */
      shadow: string | null
    }
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
    /** The main and the second button. second: the fill of the second button, outline: its border. Both use colors.text. */
    button: {
      primary: string
      onPrimary: string
      second: string
      outline: string
      outlineWidth: number
      radius: number
    }
    /** The bottom panel of the correction screen. key: the fill of a pad key. */
    panel: { fill: string; radius: number; border: string; borderWidth: number; key: string; keyRadius: number }
    /** The dashed ring of an uncertain cell. round: a circle, else a rounded square. */
    checkRing: { color: string; round: boolean }
    /** waveOpacity: the opacity of colors.accent at the peak of the wave. popScale: the digit scale at the peak of the pop. */
    pulse: { waveOpacity: number; popScale: number }
    /** The stats card and the empty state of a level (border, radius) and the strong rules of the stats screen (the table header and the chart base). Widths and radius in points. */
    summary: { border: string; borderWidth: number; radius: number; rule: string; ruleWidth: number }
    /** The tab bar of the stats screen. */
    tabs: { track: string; selected: string; selectedBorder: string; selectedBorderWidth: number }
  }
}
