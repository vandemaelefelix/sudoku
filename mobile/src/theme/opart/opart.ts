import { SHARED_MOTION, SHARED_OPACITY, SHARED_SIZE, SHARED_SPACE } from '@/theme/shared.tokens'
import type { Appearance, Theme, ThemeName, TypeRole } from '@/theme/theme.types'
import { colourLook } from './opart.colour'
import { lightLook } from './opart.light'
import type { OpartPalette } from './opart.types'

// PostScript names of the bundled files in assets/fonts (ADR-021).
const SERIF = 'InstrumentSerif-Regular'
const SERIF_ITALIC = 'InstrumentSerif-Italic'
const SANS = 'InstrumentSans-Regular'
const SANS_MEDIUM = 'InstrumentSans-Medium'
const SANS_SEMIBOLD = 'InstrumentSans-SemiBold'
const MONO = 'IBMPlexMono-Medium'

function role(family: string, weight: TypeRole['weight'], scale: number, tracking = 0, uppercase = false): TypeRole {
  return { family, weight, scale, tracking, uppercase, textShadow: null }
}

/**
 * The Op-art theme in one colourway and one appearance (ADR-025, ADR-026). The type, the sizes and the shape are the same
 * for all of them. The palette and the appearance decide the colours.
 */
export function buildOpartTheme(
  name: ThemeName,
  label: string,
  p: OpartPalette,
  appearance: Appearance = 'light',
): Theme {
  const look = appearance === 'light' ? lightLook(p) : colourLook(p)
  return {
    name,
    appearance,
    label,
    statusBar: look.statusBar,
    scrollIndicator: look.scrollIndicator,
    colors: look.colors,
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
      // The italic of the given face: one family on the grid. The style, not only the colour, marks a typed digit.
      entry: role(SERIF_ITALIC, '400', 28),
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
    elevation: look.elevation,
    motion: SHARED_MOTION,
    components: look.components,
  }
}
