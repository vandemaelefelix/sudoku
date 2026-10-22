import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { Alert } from 'react-native'
import { AccountLifecycleContext } from '@/account/hooks/useAccountLifecycle'
import { useAccount } from '@/account/hooks/useAccount'
import { keychainOwnerCache } from '@/account/utils/ownerCache.utils'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
import { runAdoptStep } from '@/sync/adoptStep'
import { IDLE_SYNC, SyncContext } from '@/sync/hooks/useSync'
import { useSyncTriggers } from '@/sync/hooks/useSyncTriggers'
import { createSyncApi, type AccountApi, type SyncApi } from '@/sync/syncApi'
import { createAppSync } from '@/sync/createAppSync'
import { readSyncApiUrl } from '@/sync/utils/syncConfig.utils'
import { currentIntl } from '@/i18n/currentIntl'

type SyncProviderProps = { apiUrl?: string | null; api?: SyncApi; accountApi?: AccountApi; children: ReactNode }

const noStatus = () => IDLE_SYNC
const noSubscription = () => () => undefined

// The sync service asks outside React, so the question reads the formatter of the provider (ADR-033, point 11).
function askToAdopt(): Promise<boolean> {
  const intl = currentIntl()
  return new Promise((resolve) => {
    Alert.alert(
      intl.formatMessage({ id: 'sync.adopt.title' }),
      intl.formatMessage({ id: 'sync.adopt.message' }),
      [
        { text: intl.formatMessage({ id: 'sync.adopt.decline' }), style: 'cancel', onPress: () => resolve(false) },
        { text: intl.formatMessage({ id: 'sync.adopt.accept' }), onPress: () => resolve(true) },
      ],
      { cancelable: false },
    )
  })
}

/**
 * Syncs the history of a signed-in player (ADR-028). It renders the children at once and never waits for the network (SUD-01).
 * A build without an API URL, or without an account, has no sync: every call is a no-op.
 */
export function SyncProvider({ apiUrl = readSyncApiUrl(), api, accountApi, children }: SyncProviderProps) {
  const storage = useGameStorage()
  const account = useAccount()
  const owner = useOwner()
  // The service reads the latest account through this ref, so a new token function does not restart the session.
  const latest = useRef(account)
  useEffect(() => {
    latest.current = account
  }, [account])
  // oxlint-disable-next-line react/refs -- the service calls this in an event, never during render.
  const getAccount = useCallback(() => latest.current, [])

  const unconfigured = account.status === 'unconfigured'
  const app = useMemo(() => {
    const client = api ?? (apiUrl === null ? null : createSyncApi({ baseUrl: apiUrl }))
    if (client === null || unconfigured) return null
    const accountClient = accountApi ?? (apiUrl === null ? null : createSyncApi({ baseUrl: apiUrl }))
    // oxlint-disable-next-line react/refs -- getAccount only reads the ref later, in an event.
    return createAppSync({
      storage,
      api: client,
      accountApi: accountClient,
      account: {
        getApiToken: (options) => getAccount().getApiToken(options),
        signOut: () => getAccount().signOut(),
        markDeleted: () => getAccount().markDeleted(),
      },
      ownerCache: keychainOwnerCache,
    })
  }, [api, apiUrl, accountApi, storage, unconfigured, getAccount])
  const service = app?.service ?? null

  useSyncTriggers(service)

  // One prompt at a time, also when the effect runs twice.
  const adopting = useRef<{ owner: string; done: Promise<void> } | null>(null)
  const signedInOwner = account.status === 'signedIn' ? owner : null
  useEffect(() => {
    if (service === null) return undefined
    if (signedInOwner === null) {
      service.setSession(null)
      return undefined
    }
    let live = true
    const step =
      adopting.current?.owner === signedInOwner
        ? adopting.current.done
        : runAdoptStep({
            history: storage.history,
            owner: signedInOwner,
            ask: askToAdopt,
          }).catch(() => undefined)
    if (adopting.current?.owner !== signedInOwner) {
      const done = step.finally(() => {
        if (adopting.current?.done === done) adopting.current = null
      })
      adopting.current = { owner: signedInOwner, done }
    }
    void step.then(() => {
      if (!live) return
      service.setSession({
        owner: signedInOwner,
        getToken: (options) => getAccount().getApiToken(options),
        isCurrent: () => live,
      })
      void service.trigger('sign-in')
    })
    return () => {
      live = false
      service.setSession(null)
    }
  }, [service, signedInOwner, storage, getAccount])

  const status = useSyncExternalStore(service?.subscribe ?? noSubscription, service?.status ?? noStatus)
  return (
    <AccountLifecycleContext value={app?.lifecycle ?? null}>
      <SyncContext value={status}>{children}</SyncContext>
    </AccountLifecycleContext>
  )
}
