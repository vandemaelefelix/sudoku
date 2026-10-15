import type { Appearance, Theme, ThemeName } from '@/theme/theme.types'
import { bordeaux, bordeauxColour } from '@/theme/themes/bordeaux'
import { cobalt, cobaltColour } from '@/theme/themes/cobalt'
import { forest, forestColour } from '@/theme/themes/forest'

/**
 * The Light theme of every colourway, in the order of the Settings picker. Jest uses the first one.
 * To add a colourway, add its folder and one line to each of the two lists here (ADR-025, ADR-026).
 */
export const THEMES: Readonly<Record<ThemeName, Theme>> = { cobalt, forest, bordeaux }

/** The Colour theme of every colourway, in the same order. */
export const COLOUR_THEMES: Readonly<Record<ThemeName, Theme>> = {
  cobalt: cobaltColour,
  forest: forestColour,
  bordeaux: bordeauxColour,
}

export const THEME_NAMES = Object.keys(THEMES) as readonly ThemeName[]

export const APPEARANCES: readonly Appearance[] = ['light', 'colour']

/** The theme of a colourway in an appearance. */
export function themeFor(name: ThemeName, appearance: Appearance): Theme {
  return (appearance === 'light' ? THEMES : COLOUR_THEMES)[name]
}
