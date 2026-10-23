import { useEffect, useSyncExternalStore } from 'react'
import { useAccount } from '@/account/hooks/useAccount'
import { useSettingValue } from '@/preferences/hooks/useSettingValue'
import { noticeStore } from '@/scanShare/noticeStore'
import { drainQueue, scanShare } from '@/scanShare/scanShareRuntime'
import { setTokenSource } from '@/scanShare/tokenSource'
import { shareStore } from '@/scanShare/shareStore'
import { versionLabel } from '@/utils/appInfo.utils'

/**
 * The scan sharing of the player (ADR-030). `on` is the "Help improve the app" switch. Turning it off clears the queue.
 * `enqueueScan` and `drainQueue` never throw. The queue and the uploader are one module value, so every screen uses the same one.
 */
export function useScanShare() {
  const on = useSettingValue(shareStore)
  useSyncExternalStore(noticeStore.subscribe, noticeStore.snapshot)
  const { getApiToken } = useAccount()
  useEffect(() => setTokenSource(getApiToken), [getApiToken])
  return {
    on,
    /** True when a scan waits and the player has not seen the first-upload notice. */
    noticeDue: on && noticeStore.due() && !noticeStore.seen(),
    acceptNotice: () => void scanShare.acceptNotice().catch(() => undefined),
    declineNotice: () => void scanShare.declineNotice().catch(() => undefined),
    setOn: (next: boolean) => void scanShare.setShareScans(next).catch(() => undefined),
    enqueueScan: scanShare.enqueueScan,
    discardPhoto: scanShare.discardPhoto,
    drainQueue,
    version: versionLabel(),
  }
}
