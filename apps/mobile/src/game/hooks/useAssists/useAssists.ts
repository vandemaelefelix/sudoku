import { useSyncExternalStore } from 'react'
import type { AssistName, Assists } from '@/game/constants/assists.constants'
import { createAssistsStore } from '@/game/utils/assists.utils'
import { kvSettings } from '@/settings/SettingsRepository'
import { devLog, errorMessage } from '@/utils/log.utils'

// One store for the app: the Settings screen and the game grid must read the same assists.
const assistsStore = createAssistsStore(kvSettings)

function setAssist(name: AssistName, on: boolean): void {
  assistsStore.set(name, on).catch((error: unknown) => devLog('assists', `assists not saved: ${errorMessage(error)}`))
}

/** The saved assists. A change reaches every reader at once. setAssist keeps its identity. */
export function useAssists(): { assists: Assists; setAssist(name: AssistName, on: boolean): void } {
  const assists = useSyncExternalStore(assistsStore.subscribe, assistsStore.get)
  return { assists, setAssist }
}
