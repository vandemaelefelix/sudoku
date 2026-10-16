import { createContext, useContext } from 'react'
import type { SyncStatus } from '@/sync/sync.types'

/** Without a provider, or in a build without sync, nothing has synced. */
export const IDLE_SYNC: SyncStatus = { lastSyncedAt: null, revision: 0 }

export const SyncContext = createContext<SyncStatus>(IDLE_SYNC)

/** `revision` changes when a sync wrote entries from another device, so a screen can read its numbers again. */
export function useSync(): SyncStatus {
  return useContext(SyncContext)
}
