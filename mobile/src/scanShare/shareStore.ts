import { kvSettings } from '@/settings/SettingsRepository'
import { createSettingStore } from '@/settings/settingStore'
import { SHARE_SCANS_SETTING } from './scanShareSettings'

/** The one share store of the app: the switch in Settings must reach the correction screen, the capture and the uploader. */
export const shareStore = createSettingStore(kvSettings, SHARE_SCANS_SETTING)
