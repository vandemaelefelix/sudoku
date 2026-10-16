import type { TextStyle } from 'react-native'

/** A colourway (ADR-025). Each one has two appearances. */
export type ThemeName = 'cobalt' | 'forest' | 'bordeaux'

/** Light: a white page with coloured content. Colour: the accent is the page and the content is light (ADR-026). */
export type Appearance = 'light' | 'colour'

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
  appearance: Appearance
  /** The name the player sees in Settings. */
  label: string
  /** The style of the status bar text over colors.background. */
  statusBar: 'dark' | 'light'
  /** The colour of the scroll bars on a scroll view. The iOS appearance would choose it, but the page follows the theme (ADR-026). */
  scrollIndicator: 'black' | 'white'
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
    /** The toggle: the track and its square thumb, in points (ADR-026). */
    toggle: { width: number; height: number; thumb: number }
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
      /** Diagonal stripes over the conflict fill, 45°. Null: the fill alone marks the conflict. width and pitch in points, pitch along the x axis. */
      conflictHatch: { color: string; opacity: number; width: number; pitch: number } | null
      note: string
      /** The width of the ring that marks the selected cell. 0 for none: in Light the selected fill marks it. */
      selectedRingWidth: number
    }
    key: { fill: string; digit: string; noteDigit: string }
    /** The toggle. on and off: the fill of the track. border: the border of the track when off. thumbOn and thumbOff: the square thumb. */
    switch: { on: string; off: string; border: string; thumbOn: string; thumbOff: string }
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
  }
}
