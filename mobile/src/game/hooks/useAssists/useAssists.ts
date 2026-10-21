import { useSyncExternalStore } from 'react'
import type { AssistName, Assists } from '@/game/constants/assists.constants'
import { ASSISTS_SETTING } from '@/game/utils/assists.utils'
import { kvSettings } from '@/settings/SettingsRepository'
import { createSettingStore } from '@/settings/settingStore'

// One store for the app: the Settings screen and the game grid must read the same assists.
const assistsStore = createSettingStore(kvSettings, ASSISTS_SETTING)

function setAssist(name: AssistName, on: boolean): void {
  assistsStore.trySet({ ...assistsStore.get(), [name]: on })
}

/** The saved assists. A change reaches every reader at once. setAssist keeps its identity. */
export function useAssists(): { assists: Assists; setAssist(name: AssistName, on: boolean): void } {
  const assists = useSyncExternalStore(assistsStore.subscribe, assistsStore.get)
  return { assists, setAssist }
}
