import { useSettingValue } from '@/preferences/hooks/useSettingValue'
import { kvSettings } from '@/preferences/SettingsRepository'
import { createSettingStore } from '@/preferences/settingStore'
import { INCLUDE_SCANNED_SETTING } from '@/stats/utils/includeScanned.utils'

// One store for the app: the switch on the stats screen must reach the home card too.
const store = createSettingStore(kvSettings, INCLUDE_SCANNED_SETTING)

function setIncludeScanned(on: boolean): void {
  store.trySet(on)
}

/** Whether scanned puzzles count in the stats. setIncludeScanned keeps its identity. */
export function useIncludeScanned(): { includeScanned: boolean; setIncludeScanned(on: boolean): void } {
  const includeScanned = useSettingValue(store)
  return { includeScanned, setIncludeScanned }
}
