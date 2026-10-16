import { useCallback, useRef, useState } from 'react'
import { Appearance } from 'react-native'
import { kvSettings } from '@/settings/SettingsRepository'
import {
  resolveAppearance,
  saveAppearancePreference,
  saveThemePreference,
  type AppearancePreference,
  type ThemePreference,
} from '@/theme/preference'
import {
  sessionAppearancePreference,
  sessionThemePreference,
  setSessionAppearancePreference,
  setSessionThemePreference,
} from '@/theme/session'
import { useThemeTransition } from '@/theme/transition'
import { devLog, errorMessage } from '@/utils/log.utils'

type ThemePreferenceState = {
  preference: ThemePreference
  appearance: AppearancePreference
  choose(next: ThemePreference): void
  chooseAppearance(next: AppearancePreference): void
}

/**
 * The colourway and the appearance of the player. Each choice plays the cell wave, applies the combined theme under it and
 * saves the choice (ADR-015, ADR-025, ADR-026). Auto is resolved with the system scheme at the moment of the choice.
 * The preference changes at once, so the picker moves with the wave. A choice during the wave is refused and changes nothing.
 * A choice that gives the look that is already on plays no wave.
 */
export function useThemePreference(): ThemePreferenceState {
  const transition = useThemeTransition()
  const [preference, setPreference] = useState(sessionThemePreference)
  const [appearance, setAppearance] = useState(sessionAppearancePreference)
  const current = useRef({ preference, appearance })

  const choose = useCallback(
    (next: ThemePreference) => {
      const { preference: before, appearance: now } = current.current
      const scheme = Appearance.getColorScheme()
      const commit = () => {
        saveThemePreference(kvSettings, next, now, scheme).catch((error: unknown) =>
          devLog('theme', `theme not saved: ${errorMessage(error)}`),
        )
      }
      // The same look changes nothing on screen, so it needs no wave.
      if (next === before) commit()
      else if (!transition.start({ name: next, appearance: resolveAppearance(now, scheme) }, commit)) return
      current.current = { preference: next, appearance: now }
      setSessionThemePreference(next)
      setPreference(next)
    },
    [transition],
  )

  const chooseAppearance = useCallback(
    (next: AppearancePreference) => {
      const { preference: now, appearance: before } = current.current
      const scheme = Appearance.getColorScheme()
      const commit = () => {
        saveAppearancePreference(kvSettings, next, now, scheme).catch((error: unknown) =>
          devLog('theme', `appearance not saved: ${errorMessage(error)}`),
        )
      }
      const target = resolveAppearance(next, scheme)
      if (target === resolveAppearance(before, scheme)) commit()
      else if (!transition.start({ name: now, appearance: target }, commit)) return
      current.current = { preference: now, appearance: next }
      setSessionAppearancePreference(next)
      setAppearance(next)
    },
    [transition],
  )

  return { preference, appearance, choose, chooseAppearance }
}
