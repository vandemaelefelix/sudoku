import { useCallback, useContext, useRef } from 'react'
import { Alert } from 'react-native'
import {
  DELETE_RETRIES,
  DELETE_RETRY_DELAY_MS,
  DELETED_MESSAGE,
  DELETED_TITLE,
} from '@/account/constants/account.constants'
import { useAccount, type Account } from '@/account/hooks/useAccount'
import { writeCachedOwner } from '@/account/utils/ownerCache.utils'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
import { cleanUpDeletedAccount } from '@/sync/accountDeleted'
import { useSyncControl, type SyncControl } from '@/sync/hooks/useSyncControl'
import type { DeleteAccountResult } from '@/sync/sync.types'
import { devWarn, errorMessage } from '@/utils/log.utils'

/** offline: nothing changed, the player can try again. failed: the server or the token failed, nothing changed here. */
export type DeleteOutcome = 'deleted' | 'offline' | 'failed'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Deletes the account of the signed-in player (ADR-027, decision 10; ADR-028, decision 3). The server goes first.
 * Only a 2xx changes anything on the phone: it stops the sync, deletes the entries of the owner, then signs out.
 */
export function useDeleteAccount(sleep: (ms: number) => Promise<void> = wait): () => Promise<DeleteOutcome> {
  const account = useAccount()
  const owner = useOwner()
  const storage = useContext(GameStorageContext)
  const control = useSyncControl()

  // An attempt whose answer was lost may have deleted the Clerk user. Clerk then gives no token and the API says 401.
  const lostAttempt = useRef(false)

  return useCallback(async () => {
    if (account.status !== 'signedIn' || owner === null || storage === null || control === null) return 'failed'
    // A sync run that gets 410 during the delete would clean up a second time. It stops first (ADR-028).
    await control.pause()
    let deleted = false
    try {
      const outcome = await requestDeletion({ control, getApiToken: account.getApiToken, sleep, lostAttempt })
      if (outcome !== 'deleted') return outcome
      deleted = true
    } finally {
      if (!deleted) control.resume()
    }

    const announce = () => Alert.alert(DELETED_TITLE, DELETED_MESSAGE)
    // A run that goes on must not write entries after the local data is gone.
    await control.stop()
    let signedOut = false
    let signOutCalled = false
    const trackedSignOut = async () => {
      signOutCalled = true
      signedOut = await account.signOut()
      return signedOut
    }
    try {
      await cleanUpDeletedAccount({ history: storage.history, signOut: trackedSignOut, announce }, owner)
    } catch (error) {
      devWarn('account', `The local data of the deleted account was not cleaned up: ${errorMessage(error)}`)
      if (!signOutCalled) signedOut = await account.signOut()
    }
    // A sync run that cleaned up first signed out already. Only a failed sign-out that this flow saw needs the flag.
    // The owner is null for the rest of the session, also when Clerk still has the user (ADR-028).
    await writeCachedOwner(null)
    account.markDeleted({ signedOut: signOutCalled ? signedOut : true })
    return 'deleted'
    // oxlint-disable-next-line react/memo-dependencies -- the rule reads sleep as extra, but exhaustive-deps needs it: the callback passes it on.
  }, [owner, storage, control, account, sleep])
}

function needsRetry(result: DeleteAccountResult): boolean {
  return result.kind === 'offline' || result.kind === 'server_error' || result.kind === 'throttled'
}

type Request = {
  control: SyncControl
  getApiToken: Account['getApiToken']
  sleep: (ms: number) => Promise<void>
  lostAttempt: { current: boolean }
}

/** 'deleted' also covers a 401 after a lost attempt: the server then deleted the Clerk user (ADR-028). */
async function requestDeletion({ control, getApiToken, sleep, lostAttempt }: Request): Promise<DeleteOutcome> {
  const attempt = async (token: string): Promise<DeleteAccountResult> => {
    const result = await control.deleteAccount(token)
    if (needsRetry(result)) lostAttempt.current = true
    return result
  }
  let result: DeleteAccountResult
  const first = await getApiToken({ fresh: true })
  if (first === null) {
    if (!lostAttempt.current) return 'offline'
    result = { kind: 'ok' }
  } else {
    result = await attempt(first)
    // The retries keep the token: after the server deleted the Clerk user, Clerk cannot give another one.
    for (let retry = 0; retry < DELETE_RETRIES && needsRetry(result); retry += 1) {
      // oxlint-disable-next-line no-await-in-loop -- each try waits for the one before.
      await sleep(DELETE_RETRY_DELAY_MS)
      // oxlint-disable-next-line no-await-in-loop -- see above.
      result = await attempt(first)
    }
  }
  if (result.kind === 'unauthorized') {
    if (lostAttempt.current) {
      result = { kind: 'ok' }
    } else {
      const token = await getApiToken({ fresh: true })
      result = token === null ? { kind: 'offline' } : await attempt(token)
      if (result.kind === 'unauthorized' && lostAttempt.current) result = { kind: 'ok' }
    }
  }
  if (result.kind === 'offline') return 'offline'
  return result.kind === 'ok' ? 'deleted' : 'failed'
}
