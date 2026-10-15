import { useCallback, useContext } from 'react'
import { Alert } from 'react-native'
import {
  DELETE_RETRIES,
  DELETE_RETRY_DELAY_MS,
  DELETED_MESSAGE,
  DELETED_TITLE,
} from '@/account/constants/account.constants'
import { useAccount } from '@/account/hooks/useAccount'
import { writeCachedOwner } from '@/account/utils/ownerCache.utils'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
import { cleanUpDeletedAccount } from '@/sync/accountDeleted'
import { useSyncControl } from '@/sync/hooks/useSyncControl'
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
  const { status, getApiToken, signOut } = account

  return useCallback(async () => {
    if (status !== 'signedIn' || owner === null || storage === null || control === null) return 'failed'
    let token = await getApiToken({ fresh: true })
    if (token === null) return 'offline'
    let result: DeleteAccountResult = await control.deleteAccount(token)
    // The retries keep the token: after the server deleted the Clerk user, Clerk cannot give another one.
    for (let retry = 0; retry < DELETE_RETRIES && needsRetry(result); retry += 1) {
      // oxlint-disable-next-line no-await-in-loop -- each try waits for the one before.
      await sleep(DELETE_RETRY_DELAY_MS)
      // oxlint-disable-next-line no-await-in-loop -- see above.
      result = await control.deleteAccount(token)
    }
    if (result.kind === 'unauthorized') {
      token = await getApiToken({ fresh: true })
      result = token === null ? { kind: 'offline' } : await control.deleteAccount(token)
    }
    if (result.kind === 'offline') return 'offline'
    if (result.kind !== 'ok') return 'failed'

    const announce = () => Alert.alert(DELETED_TITLE, DELETED_MESSAGE)
    // A run that goes on must not write entries after the local data is gone.
    await control.stop()
    let signedOut = false
    let signOutCalled = false
    const trackedSignOut = async () => {
      signOutCalled = true
      signedOut = await signOut()
      return signedOut
    }
    try {
      await cleanUpDeletedAccount(
        { history: storage.history, state: storage.sync, signOut: trackedSignOut, announce },
        owner,
      )
    } catch (error) {
      devWarn('account', `The local data of the deleted account was not cleaned up: ${errorMessage(error)}`)
      if (!signOutCalled) signedOut = await signOut()
    }
    // Clerk may fail to sign out, because the user is gone. The next start must not use the dead owner.
    if (!signedOut) await writeCachedOwner(null)
    return 'deleted'
  }, [status, owner, storage, control, getApiToken, signOut, sleep])
}

function needsRetry(result: DeleteAccountResult): boolean {
  return result.kind === 'offline' || result.kind === 'server_error' || result.kind === 'throttled'
}
