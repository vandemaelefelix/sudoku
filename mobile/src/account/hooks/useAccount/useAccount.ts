import { createContext, useContext } from 'react'
import type { ClerkAdapter } from '@/account/utils/clerkAdapter.utils'

/** unconfigured: the app variant has no Clerk key, so the account does not exist in this build. */
export type AccountStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn'

export type Account = ClerkAdapter & {
  status: AccountStatus
  /** The primary email of the signed-in player. Null in every other status. */
  email: string | null
  /**
   * The account lifecycle calls this when the account is deleted (ADR-028). For this session the owner is null and the
   * status is signedOut, whatever Clerk says.
   */
  markDeleted(): void
}

export const UNCONFIGURED_ACCOUNT: Account = {
  status: 'unconfigured',
  email: null,
  signOut: async () => true,
  getApiToken: async () => null,
  markDeleted: () => undefined,
}

export const AccountContext = createContext<Account>(UNCONFIGURED_ACCOUNT)

export function useAccount(): Account {
  return useContext(AccountContext)
}
