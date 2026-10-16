import { createContext, use } from 'react'
import type { Appearance, ThemeName } from '@/theme/theme.types'

/** The theme that a switch goes to: a colourway in an appearance. */
export type ThemeTarget = { name: ThemeName; appearance: Appearance }

export type ThemeTransition = {
  /**
   * Plays the cell wave over a switch to `target`, the new theme. Calls `apply` once, when the picture of the old screen is on screen.
   * Returns false, and never calls `apply`, while a wave runs.
   */
  start(target: ThemeTarget, apply: () => void): boolean
}

// Without a provider, in a test for example, the theme switches at once.
export const ThemeTransitionContext = createContext<ThemeTransition>({
  start: (_target, apply) => {
    apply()
    return true
  },
})

export function useThemeTransition(): ThemeTransition {
  return use(ThemeTransitionContext)
}
