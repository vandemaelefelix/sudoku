import { createContext, use } from 'react'
import type { Appearance, ThemeName } from '@/theme/theme.types'

/** The theme that a switch goes to: a colourway in an appearance. */
export type ThemeTarget = { name: ThemeName; appearance: Appearance }

export type ThemeTransition = {
  /**
   * Plays the cell wave over a switch to `target`, the new theme. Calls `apply` once, when the picture of the old screen is on screen.
   * `settleMs` delays the picture, so a motion that the choice started ends before the picture freezes the screen.
   * During a wave, a new call waits for its end and replaces an earlier call that waits. A replaced `apply` never runs.
   */
  start(target: ThemeTarget, apply: () => void, settleMs?: number): void
}

// Without a provider, in a test for example, the theme switches at once.
export const ThemeTransitionContext = createContext<ThemeTransition>({
  start: (_target, apply) => apply(),
})

export function useThemeTransition(): ThemeTransition {
  return use(ThemeTransitionContext)
}
