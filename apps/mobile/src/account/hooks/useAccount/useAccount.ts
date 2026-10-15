import { createContext, useContext } from 'react'

/** unconfigured: the app variant has no Clerk key, so the account does not exist in this build. */
export type AccountStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn'

export type Account = {
  status: AccountStatus
  /** The primary email of the signed-in player. Null in every other status. */
  email: string | null
  signOut(): Promise<void>
  /** A fresh `sudoku-api` token for one request. Null when signed out, or when Clerk cannot give one. Never throws. */
  getApiToken(): Promise<string | null>
}

export const UNCONFIGURED_ACCOUNT: Account = {
  status: 'unconfigured',
  email: null,
  signOut: async () => undefined,
  getApiToken: async () => null,
}

export const AccountContext = createContext<Account>(UNCONFIGURED_ACCOUNT)

export function useAccount(): Account {
  return useContext(AccountContext)
}
