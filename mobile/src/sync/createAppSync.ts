import { createAccountLifecycle, type AccountLifecycle, type AccountLifecycleDeps } from '@/account/accountLifecycle'
import type { GameStorage } from '@/storage'
import type { AccountApi, SyncApi } from './syncApi'
import { createSyncService, type SyncService } from './SyncService'

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type AppSyncDeps = {
  storage: GameStorage
  api: SyncApi
  /** Null in a build without an API URL: the account cannot be deleted there. */
  accountApi: AccountApi | null
  /** `account` gives the latest account, so a new token function does not restart the session. */
  account: AccountLifecycleDeps['account']
  ownerCache: AccountLifecycleDeps['ownerCache']
  now?(): string
  sleep?(ms: number): Promise<void>
}

/**
 * The sync service of the app with its account lifecycle. The service gives 410 `account_deleted` to the lifecycle.
 * The lifecycle pauses, stops and resumes the service for a delete (ADR-028). The real clock and sleep are the defaults.
 */
export function createAppSync({
  storage,
  api,
  accountApi,
  account,
  ownerCache,
  now = () => new Date().toISOString(),
  sleep = realSleep,
}: AppSyncDeps): { service: SyncService; lifecycle: AccountLifecycle } {
  const lifecycle = createAccountLifecycle({
    account,
    api: accountApi,
    history: storage.history,
    ownerCache,
    sleep,
    // The lifecycle calls these only after `service` exists: the service itself starts no call to it.
    sync: { pause: () => service.pause(), stop: () => service.stop(), resume: () => service.resume() },
  })
  const service = createSyncService({
    history: storage.history,
    state: storage.sync,
    api,
    now,
    sleep,
    onAccountDeleted: lifecycle.onAccountDeleted,
  })
  return { service, lifecycle }
}
