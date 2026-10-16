import { createContext, useContext } from 'react'
import type { AccountApi } from '@/sync/syncApi'

/** What the account layer needs from the sync layer to delete the account (ADR-028, decision 3). */
export type SyncControl = AccountApi & {
  /** Ends the session and waits for the run that goes on, so no run writes after the local data is deleted. */
  stop(): Promise<void>
  /** Stops a run and blocks new runs while the delete call is out, so a 410 cannot start a second cleanup. */
  pause(): Promise<void>
  /** Lets the sync run again after a delete that did not happen. */
  resume(): void
}

/** Null in a build without an API URL: the account cannot be deleted there. */
export const SyncControlContext = createContext<SyncControl | null>(null)

export function useSyncControl(): SyncControl | null {
  return useContext(SyncControlContext)
}
