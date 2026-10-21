import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { Alert } from 'react-native'
import { useAccount } from '@/account/hooks/useAccount'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
import { runAdoptStep } from '@/sync/adoptStep'
import { ADOPT_ACCEPT, ADOPT_DECLINE, ADOPT_MESSAGE, ADOPT_TITLE } from '@/sync/constants/sync.constants'
import { IDLE_SYNC, SyncContext } from '@/sync/hooks/useSync'
import { SyncControlContext, type SyncControl } from '@/sync/hooks/useSyncControl'
import { useSyncTriggers } from '@/sync/hooks/useSyncTriggers'
import { createSyncApi, type AccountApi, type SyncApi } from '@/sync/syncApi'
import { createAppSyncService } from '@/sync/createAppSyncService'
import type { SyncService } from '@/sync/SyncService'
import { readSyncApiUrl } from '@/sync/utils/syncConfig.utils'

type SyncProviderProps = { apiUrl?: string | null; api?: SyncApi; accountApi?: AccountApi; children: ReactNode }

const noStatus = () => IDLE_SYNC
const noSubscription = () => () => undefined

function askToAdopt(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      ADOPT_TITLE,
      ADOPT_MESSAGE,
      [
        { text: ADOPT_DECLINE, style: 'cancel', onPress: () => resolve(false) },
        { text: ADOPT_ACCEPT, onPress: () => resolve(true) },
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
  const service = useMemo<SyncService | null>(() => {
    const client = api ?? (apiUrl === null ? null : createSyncApi({ baseUrl: apiUrl }))
    if (client === null || unconfigured) return null
    // oxlint-disable-next-line react/refs -- getAccount only reads the ref later, in an event.
    return createAppSyncService(storage, client, getAccount)
  }, [api, apiUrl, storage, unconfigured, getAccount])

  const control = useMemo<SyncControl | null>(() => {
    const client = accountApi ?? (apiUrl === null ? null : createSyncApi({ baseUrl: apiUrl }))
    if (client === null || service === null) return null
    return {
      deleteAccount: (token) => client.deleteAccount(token),
      stop: () => service.stop(),
      pause: () => service.pause(),
      resume: () => service.resume(),
    }
  }, [accountApi, apiUrl, service])

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
    <SyncControlContext value={control}>
      <SyncContext value={status}>{children}</SyncContext>
    </SyncControlContext>
  )
}
