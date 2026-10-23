import { useSyncExternalStore } from 'react'
import type { SettingStore } from '@/preferences/settingStore'

/** The value of a setting store. The component renders again when the value changes. */
export function useSettingValue<T>(store: SettingStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get)
}
