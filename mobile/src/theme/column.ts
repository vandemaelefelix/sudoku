import type { Theme } from './theme.types'

/** The side margin of a screen, in points: space.lg on an iPhone, more on an iPad, so the content keeps size.column. */
export function columnInset(theme: Theme, screenWidth: number): number {
  return Math.max(theme.space.lg, (screenWidth - theme.size.column) / 2)
}

/** The width of the content column of a screen, in points. */
export function columnWidth(theme: Theme, screenWidth: number): number {
  return screenWidth - 2 * columnInset(theme, screenWidth)
}
