import type { Theme } from './theme.types'

/** The side margin of a screen, in points: space.lg on an iPhone, more on an iPad, so the content is never wider than size.content. */
export function contentInset(theme: Theme, screenWidth: number): number {
  return Math.max(theme.space.lg, (screenWidth - theme.size.content) / 2)
}

/** The width of the content of a screen, in points. */
export function contentWidth(theme: Theme, screenWidth: number): number {
  return screenWidth - 2 * contentInset(theme, screenWidth)
}
