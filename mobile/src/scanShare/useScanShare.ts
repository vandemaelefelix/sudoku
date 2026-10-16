import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAccount } from '@/account/hooks/useAccount'
import { versionLabel } from './scanConfig'
import { contributorId, drainQueue, scanShare, setTokenSource } from './scanShareRuntime'
import { noticeStore } from './noticeStore'
import { shareStore } from './shareStore'

/**
 * The scan sharing of the player (ADR-030). `on` is the "Help improve the app" switch. Turning it off clears the queue.
 * `enqueueScan` and `drainQueue` never throw. The queue and the uploader are one module value, so every screen uses the same one.
 */
export function useScanShare() {
  const on = useSyncExternalStore(shareStore.subscribe, shareStore.get)
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
    drainQueue,
    version: versionLabel(),
  }
}

/** The contributor ID of this device, or null until it is read. */
export function useContributorId(): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    contributorId()
      .then((value) => live && setId(value))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return id
}
