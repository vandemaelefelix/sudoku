import type { HistoryRepository, SyncStateRepository } from '@/storage'

type Deps = {
  history: HistoryRepository
  state: SyncStateRepository
  /** Never rejects. Resolves false when Clerk could not sign out. */
  signOut(): Promise<boolean>
  announce(): void
}

/**
 * The reaction to 410 `account_deleted` (ADR-028, decision 3). The local data goes first, so it is gone even when
 * the sign-out fails. The service stays stopped for this owner either way, until the app starts again.
 */
export async function cleanUpDeletedAccount({ history, state, signOut, announce }: Deps, owner: string): Promise<void> {
  await history.deleteOwner(owner)
  await state.clear(owner)
  await signOut()
  announce()
}
