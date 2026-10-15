import { ClerkProvider, useAuth, useUser } from '@clerk/expo'
import { resourceCache } from '@clerk/expo/resource-cache'
import { tokenCache } from '@clerk/expo/token-cache'
import { useCallback, useMemo, type ReactNode } from 'react'
import { API_TOKEN_TEMPLATE } from '@/account/constants/account.constants'
import { AccountContext, UNCONFIGURED_ACCOUNT, type Account, type AccountStatus } from '@/account/hooks/useAccount'
import { readPublishableKey } from '@/account/utils/clerkConfig.utils'
import { OwnerContext } from '@/storage/hooks/useOwner'
import { devWarn, errorMessage } from '@/utils/log.utils'

type AccountProviderProps = { publishableKey?: string | null; children: ReactNode }

/**
 * The account of the player and the owner of the games (ADR-028). The children always render, also while Clerk
 * loads or offline (SUD-01). Without a publishable key, Clerk does not start and the player stays signed out.
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
  const owner = status === 'signedIn' ? (userId ?? null) : null
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
  const account = useMemo<Account>(
    () => ({ status, email, signOut: async () => signOut(), getApiToken }),
    [status, email, signOut, getApiToken],
  )
  return (
    <AccountContext value={account}>
      <OwnerContext value={owner}>{children}</OwnerContext>
    </AccountContext>
  )
}
