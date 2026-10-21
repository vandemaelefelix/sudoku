import { ClerkProvider, useAuth, useUser } from '@clerk/expo'
import { resourceCache } from '@clerk/expo/resource-cache'
import { tokenCache } from '@clerk/expo/token-cache'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resumePendingSignOut } from '@/account/accountLifecycle'
import { AccountContext, UNCONFIGURED_ACCOUNT, type Account, type AccountStatus } from '@/account/hooks/useAccount'
import { createClerkAdapter, trySignOut } from '@/account/utils/clerkAdapter.utils'
import { readPublishableKey } from '@/account/utils/clerkConfig.utils'
import { keychainOwnerCache } from '@/account/utils/ownerCache.utils'
import { OwnerContext } from '@/storage/hooks/useOwner'

type AccountProviderProps = { publishableKey?: string | null; children: ReactNode }

/**
 * The account of the player and the owner of the games (ADR-028). The children render after one local Keychain
 * read, never after Clerk, so play starts also offline (SUD-01). Without a publishable key, Clerk does not start
 * and the player stays signed out.
 */
export function AccountProvider({ publishableKey = readPublishableKey(), children }: AccountProviderProps) {
  if (publishableKey === null) return <AccountContext value={UNCONFIGURED_ACCOUNT}>{children}</AccountContext>
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      // The token cache is undefined only on the web, which the app does not ship.
      {...(tokenCache === undefined ? {} : { tokenCache })}
      // The cache lets Clerk start offline with the last signed-in user, so the owner survives a start without network.
      __experimental_resourceCache={resourceCache}
      telemetry={false}
    >
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  )
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth()
  const { user } = useUser()
  // After a confirmed deletion the session has no owner and no account, whatever Clerk still says (ADR-028).
  const [deleted, setDeleted] = useState(false)
  const clerkStatus: AccountStatus = !isLoaded ? 'loading' : isSignedIn ? 'signedIn' : 'signedOut'
  const status: AccountStatus = deleted ? 'signedOut' : clerkStatus
  // ADR-028: this is the only writer of the owner. The game and the stats read it from storage.
  // Before Clerk loads, the owner is the cached Clerk user ID, so a game started offline keeps its owner.
  const [cachedOwner, setCachedOwner] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    void keychainOwnerCache.read().then(setCachedOwner)
  }, [])
  const signedInOwner = status === 'signedIn' ? (userId ?? null) : null
  useEffect(() => {
    if (status === 'loading') return
    void keychainOwnerCache.write(signedInOwner)
  }, [status, signedInOwner])
  const owner = status === 'loading' ? (cachedOwner ?? null) : signedInOwner
  // The Keychain read is local and fast. Clerk can be slow or offline, so the app does not wait for it.
  const ready = cachedOwner !== undefined || status !== 'loading'
  const markDeleted = useCallback(() => setDeleted(true), [])
  const email = status === 'signedIn' ? (user?.primaryEmailAddress?.emailAddress ?? null) : null
  const clerk = useMemo(() => createClerkAdapter({ getToken, signOut }), [getToken, signOut])
  // The retry below depends on signOut only, so a new token function does not start a second sign-out.
  const signOutOfClerk = useCallback(() => trySignOut(signOut), [signOut])
  const getApiToken = useCallback<Account['getApiToken']>(
    async (options) => (status === 'signedIn' ? clerk.getApiToken(options) : null),
    [status, clerk],
  )
  // A start after a deleted account whose sign-out failed (ADR-028).
  useEffect(() => {
    if (clerkStatus === 'loading') return
    void resumePendingSignOut({
      ownerCache: keychainOwnerCache,
      clerk: { signOut: signOutOfClerk },
      clerkSignedOut: clerkStatus === 'signedOut',
      onPending: () => setDeleted(true),
    })
  }, [clerkStatus, signOutOfClerk])
  const account = useMemo<Account>(
    () => ({ status, email, signOut: signOutOfClerk, getApiToken, markDeleted }),
    [status, email, signOutOfClerk, getApiToken, markDeleted],
  )
  return (
    <AccountContext value={account}>
      <OwnerContext value={owner}>{ready ? children : null}</OwnerContext>
    </AccountContext>
  )
}
