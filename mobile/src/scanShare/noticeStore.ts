import { kvSettings } from '@/settings/SettingsRepository'
import { createNoticeStore } from './scanShareSettings'

/** The one notice store of the app: the uploader, the sheet and the scan queue read the same flag. */
export const noticeStore = createNoticeStore(kvSettings)
