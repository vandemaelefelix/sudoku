import { useEffect } from 'react'
import { AppState } from 'react-native'
import { UnistylesRuntime, useUnistyles } from 'react-native-unistyles'
import { applyThemePreference, resolveAppearance } from '@/theme/preference'
import { sessionAppearancePreference, sessionThemePreference } from '@/theme/session'
import { useThemeTransition } from '@/theme/transition'
import { useSystemScheme } from './useSystemScheme'

/**
 * Applies the look of the system when the appearance is Auto and the iOS setting changes while the app runs (ADR-026).
 * It plays the cell wave when the app is in the foreground and switches at once otherwise. It draws nothing.
 * The first frame needs no follower: startupSettings already resolved Auto with the system scheme.
 */
export function SystemAppearanceFollower() {
  const scheme = useSystemScheme()
  const { theme } = useUnistyles()
  const transition = useThemeTransition()
  const { name, appearance } = theme

  useEffect(() => {
    if (sessionAppearancePreference() !== 'auto') return
    const target = { name: sessionThemePreference(), appearance: resolveAppearance('auto', scheme) }
    if (target.name === name && target.appearance === appearance) return
    const apply = () => applyThemePreference(target.name, target.appearance, UnistylesRuntime)
    if (AppState.currentState === 'active') transition.start(target, apply)
    else apply()
  }, [scheme, name, appearance, transition])

  return null
}
