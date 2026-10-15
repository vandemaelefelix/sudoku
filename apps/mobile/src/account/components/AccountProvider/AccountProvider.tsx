import { ClerkProvider, useAuth, useUser } from '@clerk/expo'
import { resourceCache } from '@clerk/expo/resource-cache'
import { tokenCache } from '@clerk/expo/token-cache'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { API_TOKEN_TEMPLATE } from '@/account/constants/account.constants'
import { AccountContext, UNCONFIGURED_ACCOUNT, type Account, type AccountStatus } from '@/account/hooks/useAccount'
import { readPublishableKey } from '@/account/utils/clerkConfig.utils'
import { readCachedOwner, writeCachedOwner } from '@/account/utils/ownerCache.utils'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { devWarn, errorMessage } from '@/utils/log.utils'

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
  const status: AccountStatus = !isLoaded ? 'loading' : isSignedIn ? 'signedIn' : 'signedOut'
  // ADR-028: this is the only writer of the owner. The game and the stats read it from storage.
  // Before Clerk loads, the owner is the cached Clerk user ID, so a game started offline keeps its owner.
  const [cachedOwner, setCachedOwner] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    void readCachedOwner().then(setCachedOwner)
  }, [])
  const signedInOwner = status === 'signedIn' ? (userId ?? null) : null
  useEffect(() => {
    if (status === 'loading') return
    void writeCachedOwner(signedInOwner)
  }, [status, signedInOwner])
  const owner = status === 'loading' ? (cachedOwner ?? null) : signedInOwner
  // The Keychain read is local and fast. Clerk can be slow or offline, so the app does not wait for it.
  const ready = cachedOwner !== undefined || status !== 'loading'
  const email = status === 'signedIn' ? (user?.primaryEmailAddress?.emailAddress ?? null) : null
  const getApiToken = useCallback(async () => {
    if (status !== 'signedIn') return null
    try {
      return await getToken({ template: API_TOKEN_TEMPLATE })
    } catch (error) {
      devWarn('account', `Clerk gave no API token: ${errorMessage(error)}`)
      return null
    }
  }, [status, getToken])
  const trySignOut = useCallback(async () => {
    try {
      await signOut()
      return true
    } catch (error) {
      devWarn('account', `Clerk did not sign out: ${errorMessage(error)}`)
      return false
    }
  }, [signOut])
  const account = useMemo<Account>(
    () => ({ status, email, signOut: trySignOut, getApiToken }),
    [status, email, trySignOut, getApiToken],
  )
  return (
    <AccountContext value={account}>
      <OwnerContext value={owner}>{ready ? children : null}</OwnerContext>
    </AccountContext>
  )
}
