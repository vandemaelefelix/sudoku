import { useSyncExternalStore } from 'react'
import { kvSettings } from '@/settings/SettingsRepository'
import { createSettingStore } from '@/settings/settingStore'
import { HAPTICS_SETTING } from '@/settings/utils/haptics.utils'
import { playHaptic, type HapticName } from '@/utils/haptics.utils'

// One store for the app: the switch in Settings must reach every screen that plays a haptic.
const hapticsStore = createSettingStore(kvSettings, HAPTICS_SETTING)

function setOn(on: boolean): void {
  hapticsStore.trySet(on)
}

// Reads the switch at the moment of the haptic, so play keeps its identity and an effect that calls it does not run again.
function play(name: HapticName): void {
  if (hapticsStore.get()) playHaptic(name)
}

/** The haptics switch of the player and play, which plays a haptic only when the switch is on. setOn and play keep their identity. */
export function useHaptics(): { on: boolean; setOn(on: boolean): void; play(name: HapticName): void } {
  const on = useSyncExternalStore(hapticsStore.subscribe, hapticsStore.get)
  return { on, setOn, play }
}
