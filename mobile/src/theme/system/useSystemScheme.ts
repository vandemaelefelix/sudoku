import { useSyncExternalStore } from 'react'
import { Appearance } from 'react-native'
import type { SystemScheme } from '@/theme/preference'

function subscribe(onChange: () => void): () => void {
  const subscription = Appearance.addChangeListener(onChange)
  return () => subscription.remove()
}

/** The iOS appearance. It changes when the player changes the iOS setting while the app runs. Needs userInterfaceStyle automatic (ADR-026). */
export function useSystemScheme(): SystemScheme {
  return useSyncExternalStore(subscribe, () => Appearance.getColorScheme())
}
