import { kvSettings } from '@/settings/SettingsRepository'
import { createShareStore } from './scanShareSettings'

/** The one share store of the app: the switch in Settings must reach the correction screen, the capture and the uploader. */
export const shareStore = createShareStore(kvSettings)
