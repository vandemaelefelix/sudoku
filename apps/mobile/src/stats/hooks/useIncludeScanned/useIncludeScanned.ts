import { useSyncExternalStore } from 'react'
import { kvSettings } from '@/settings/SettingsRepository'
import { createIncludeScannedStore } from '@/stats/utils/includeScanned.utils'
import { devLog, errorMessage } from '@/utils/log.utils'

// One store for the app: the switch on the stats screen must reach the home card too.
const store = createIncludeScannedStore(kvSettings)

function setIncludeScanned(on: boolean): void {
  store.set(on).catch((error: unknown) => devLog('stats', `scanned switch not saved: ${errorMessage(error)}`))
}

/** Whether scanned puzzles count in the stats. setIncludeScanned keeps its identity. */
export function useIncludeScanned(): { includeScanned: boolean; setIncludeScanned(on: boolean): void } {
  const includeScanned = useSyncExternalStore(store.subscribe, store.get)
  return { includeScanned, setIncludeScanned }
}
