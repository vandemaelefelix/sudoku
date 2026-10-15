import type { HistoryRepository, SyncStateRepository } from '@/storage'

type Deps = {
  history: HistoryRepository
  state: SyncStateRepository
  /** Never rejects. Resolves false when Clerk could not sign out. */
  signOut(): Promise<boolean>
  announce(): void
}

// A sync run that gets 410 and the delete flow both clean up. The first call wins, so the player sees one alert.
const cleanups = new Map<string, Promise<void>>()

/** Clears the record of the owners that were cleaned up. Tests need it, because the record lives as long as the app. */
export function forgetCleanedUpOwners(): void {
  cleanups.clear()
}

/**
 * The reaction to 410 `account_deleted` (ADR-028, decision 3). The local data goes first, so it is gone even when
 * the sign-out fails. The service stays stopped for this owner either way, until the app starts again.
 * A second call for the same owner waits for the first and does nothing more. After a failure, a call tries again.
 */
export function cleanUpDeletedAccount(deps: Deps, owner: string): Promise<void> {
  const known = cleanups.get(owner)
  if (known !== undefined) return known
  const run = cleanUp(deps, owner)
  cleanups.set(owner, run)
  run.catch(() => cleanups.delete(owner))
  return run
}

async function cleanUp({ history, state, signOut, announce }: Deps, owner: string): Promise<void> {
  await history.deleteOwner(owner)
  await state.clear(owner)
  await signOut()
  announce()
}
