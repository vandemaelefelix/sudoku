import { useSyncExternalStore } from 'react'
import { LANGUAGE_SETTING, type LanguageChoice } from '@/i18n/utils/locale.utils'
import { kvSettings } from '@/settings/SettingsRepository'
import { createSettingStore } from '@/settings/settingStore'

// One store for the app: the switch in Settings must reach the provider at the root.
const languageStore = createSettingStore(kvSettings, LANGUAGE_SETTING)

function choose(choice: LanguageChoice): void {
  languageStore.trySet(choice)
}

/** The language choice of the player: System, English or Dutch. choose keeps its identity. The choice survives a restart. */
export function useLanguage(): { choice: LanguageChoice; choose(choice: LanguageChoice): void } {
  const choice = useSyncExternalStore(languageStore.subscribe, languageStore.get)
  return { choice, choose }
}
