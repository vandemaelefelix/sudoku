import { Alert } from 'react-native'
import {
  ACCOUNT_DELETED_TITLE,
  DELETE_RETRIES,
  DELETE_RETRY_DELAY_MS,
  DELETED_MESSAGE,
  DELETED_TITLE,
} from '@/account/constants/account.constants'
import type { Account } from '@/account/hooks/useAccount'
import type { ClerkAdapter } from '@/account/utils/clerkAdapter.utils'
import type { OwnerCache } from '@/account/utils/ownerCache.utils'
import type { HistoryRepository } from '@/storage'
import type { DeleteAccountResult } from '@/sync/sync.types'
import type { SyncService } from '@/sync/SyncService'
import type { AccountApi } from '@/sync/syncApi'
import { devWarn, errorMessage } from '@/utils/log.utils'

/** offline: nothing changed, the player can try again. failed: the server or the token failed, nothing changed here. */
export type DeleteOutcome = 'deleted' | 'offline' | 'failed'

export type AccountLifecycleDeps = {
  account: Pick<Account, 'getApiToken' | 'signOut' | 'markDeleted'>
  /** Null in a build without an API URL: the account cannot be deleted there. */
  api: AccountApi | null
  sync: Pick<SyncService, 'pause' | 'stop' | 'resume'>
  history: Pick<HistoryRepository, 'deleteOwner'>
  ownerCache: OwnerCache
  sleep(ms: number): Promise<void>
}

export type AccountLifecycle = {
  /** False when the build has no API to call. `deleteAccount` then answers 'failed'. */
  canDelete: boolean
  /**
   * Deletes the account of the signed-in owner (ADR-027, decision 10; ADR-028, decision 3). The server goes first.
   * Only a 2xx, or a lost answer followed by a 401, changes anything on the phone: it stops the sync, deletes the
   * entries and the sync state of the owner, signs out, clears the owner cache and marks the account deleted.
   */
  deleteAccount(owner: string): Promise<DeleteOutcome>
  /**
   * The reaction to 410 `account_deleted` (ADR-028). The local data goes first, so it is gone even when the sign-out fails.
   * The cleanup runs once for each owner: a call that comes during or after the first waits for it and does nothing
   * more. After a failure, a call tries again. It rejects when the local data was not deleted.
   */
  onAccountDeleted(owner: string): Promise<void>
  /**
   * Forgets a lost delete attempt. Call it when the delete screen goes away and on a sign-out. A lost answer counts as
   * a delete only inside one open screen, so a timed-out delete cannot wipe the phone much later (ADR-028).
   */
  forgetLostAttempt(): void
}

/**
 * Starts the account lifecycle of one session of the app. It owns the ADR-028 delete order, the 410 reaction and the
 * owner cache. The caller gives the sync, because the sync gives the 410 back to `onAccountDeleted`.
 */
export function createAccountLifecycle(deps: AccountLifecycleDeps): AccountLifecycle {
  const { account, api, sync, history, ownerCache, sleep } = deps
  // An attempt whose answer was lost may have deleted the Clerk user. Clerk then gives no token and the API says 401.
  let lostAttemptOf: string | null = null
  // The result is true when Clerk signed out.
  let cleanup: { owner: string; done: Promise<boolean> } | null = null

  const cleanUpOnce = (owner: string, announce: () => void): Promise<boolean> => {
    if (cleanup?.owner === owner) return cleanup.done
    const done = (async () => {
      await history.deleteOwner(owner)
      const signedOut = await account.signOut()
      announce()
      return signedOut
    })()
    const mine = { owner, done }
    cleanup = mine
    done.catch(() => {
      if (cleanup === mine) cleanup = null
    })
    return done
  }

  const attempt = async (accountApi: AccountApi, owner: string, token: string): Promise<DeleteAccountResult> => {
    const result = await accountApi.deleteAccount(token)
    if (needsRetry(result)) lostAttemptOf = owner
    return result
  }

  /** 'deleted' also covers a 401 after a lost attempt: the server then deleted the Clerk user (ADR-028). */
  const requestDeletion = async (accountApi: AccountApi, owner: string): Promise<DeleteOutcome> => {
    let result: DeleteAccountResult
    const first = await account.getApiToken({ fresh: true })
    if (first === null) {
      if (lostAttemptOf !== owner) return 'offline'
      result = { kind: 'ok' }
    } else {
      result = await attempt(accountApi, owner, first)
      // The retries keep the token: after the server deleted the Clerk user, Clerk cannot give another one.
      for (let retry = 0; retry < DELETE_RETRIES && needsRetry(result); retry += 1) {
        // oxlint-disable-next-line no-await-in-loop -- each try waits for the one before.
        await sleep(DELETE_RETRY_DELAY_MS)
        // oxlint-disable-next-line no-await-in-loop -- see above.
        result = await attempt(accountApi, owner, first)
      }
    }
    if (result.kind === 'unauthorized') {
      if (lostAttemptOf === owner) {
        result = { kind: 'ok' }
      } else {
        const token = await account.getApiToken({ fresh: true })
        result = token === null ? { kind: 'offline' } : await attempt(accountApi, owner, token)
        if (result.kind === 'unauthorized' && lostAttemptOf === owner) result = { kind: 'ok' }
      }
    }
    if (result.kind === 'offline') return 'offline'
    return result.kind === 'ok' ? 'deleted' : 'failed'
  }

  return {
    canDelete: api !== null,
    async deleteAccount(owner) {
      if (api === null) return 'failed'
      // A sync run that gets 410 during the delete would clean up a second time. It stops first (ADR-028).
      await sync.pause()
      let deleted = false
      try {
        const outcome = await requestDeletion(api, owner)
        if (outcome !== 'deleted') return outcome
        deleted = true
      } finally {
        if (!deleted) sync.resume()
      }
      // A run that goes on must not write entries after the local data is gone.
      await sync.stop()
      lostAttemptOf = null
      let signedOut: boolean
      try {
        signedOut = await cleanUpOnce(owner, () => Alert.alert(DELETED_TITLE, DELETED_MESSAGE))
      } catch (error) {
        devWarn('account', `The local data of the deleted account was not cleaned up: ${errorMessage(error)}`)
        signedOut = await account.signOut()
      }
      // The owner is null for the rest of the session, also when Clerk still has the user (ADR-028).
      await ownerCache.write(null)
      if (!signedOut) await ownerCache.setPendingSignOut(true)
      account.markDeleted()
      return 'deleted'
    },
    forgetLostAttempt() {
      lostAttemptOf = null
    },
    async onAccountDeleted(owner) {
      await cleanUpOnce(owner, () => Alert.alert(ACCOUNT_DELETED_TITLE))
    },
  }
}

function needsRetry(result: DeleteAccountResult): boolean {
  return result.kind === 'offline' || result.kind === 'server_error' || result.kind === 'throttled'
}

type PendingSignOut = {
  ownerCache: OwnerCache
  clerk: Pick<ClerkAdapter, 'signOut'>
  /** True when Clerk loaded without a user. Nothing is left to sign out. */
  clerkSignedOut: boolean
  /** Called before the sign-out, so the session has no owner while it runs. */
  onPending(): void
}

/**
 * A start after a deleted account whose sign-out failed: sign out again, silently, then forget the flag (ADR-028).
 * Call it once Clerk has loaded. The flag stays when the sign-out fails again.
 */
export async function resumePendingSignOut({ ownerCache, clerk, clerkSignedOut, onPending }: PendingSignOut) {
  if (!(await ownerCache.pendingSignOut())) return
  onPending()
  if (clerkSignedOut || (await clerk.signOut())) await ownerCache.setPendingSignOut(false)
}
