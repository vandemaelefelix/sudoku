import { Alert } from 'react-native'
import type { Account } from '@/account/hooks/useAccount'
import type { GameStorage } from '@/storage'
import { cleanUpDeletedAccount } from './accountDeleted'
import { ACCOUNT_DELETED_TITLE } from './constants/sync.constants'
import type { SyncApi } from './syncApi'
import { createSyncService, type SyncService } from './SyncService'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The service of the app: the real clock and sleep, and the reaction to a deleted account. `account` gives the latest account. */
export function createAppSyncService(storage: GameStorage, api: SyncApi, account: () => Account): SyncService {
  return createSyncService({
    history: storage.history,
    state: storage.sync,
    api,
    now: () => new Date().toISOString(),
    sleep,
    onAccountDeleted: (owner) =>
      cleanUpDeletedAccount(
        {
          history: storage.history,
          signOut: () => account().signOut(),
          announce: () => Alert.alert(ACCOUNT_DELETED_TITLE),
        },
        owner,
      ),
  })
}
